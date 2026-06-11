import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  topics: z.array(z.string().max(200)).min(1).max(20),
  goal: z.string().max(500).optional(),
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "invalid_request", detail: parsed.error.issues?.[0]?.message ?? "Invalid request body." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { topics, goal } = parsed.data;

    // ── Authentication & rate limit check ────────────────────────────────────
    const authHeader = req.headers.get("authorization");
    const jwt = authHeader?.replace("Bearer ", "");

    let userId: string | null = null;
    let plan = "free";
    const today = new Date().toISOString().split("T")[0];
    let lastQuizDate: string | null = null;

    if (jwt) {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { "Authorization": `Bearer ${jwt}`, "apikey": SERVICE_KEY },
      });
      const userData = await userRes.json();
      userId = userData?.id ?? null;

      if (userId) {
        const profileRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=plan,last_quiz_date`,
          { headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY } }
        );
        const profiles = await profileRes.json();
        const profile = Array.isArray(profiles) ? profiles[0] : null;

        if (profile) {
          plan = profile.plan ?? "free";
          lastQuizDate = profile.last_quiz_date;
        }
      }
    }

    // Require authentication — no guest access (prevents anonymous AI-budget drain).
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "unauthorized", message: "Please sign in to generate a quiz." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atomically claim today's quiz slot BEFORE spending AI budget. consume_quiz_credit
    // does a single conditional UPDATE, so concurrent requests can't both claim it.
    // Deep plan is unlimited.
    let quizClaimed = false;
    if (plan !== "deep") {
      const claimRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_quiz_credit`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ p_user_id: userId, p_today: today }),
      });
      if (!claimRes.ok) {
        console.error("consume_quiz_credit failed:", claimRes.status, await claimRes.text());
        return new Response(JSON.stringify({ error: "Could not verify your quiz allowance. Please try again." }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const allowed = await claimRes.json();
      if (allowed !== true) {
        return new Response(JSON.stringify({
          error: "daily_quiz_limit",
          message: "You've already generated a quiz today. Come back tomorrow!",
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      quizClaimed = true;
    }

    // Release the claimed slot if generation fails, so a transient error doesn't
    // burn the user's one daily quiz.
    const releaseQuiz = async () => {
      if (!quizClaimed) return;
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
          method: "PATCH",
          headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY, "Content-Type": "application/json", "Prefer": "return=minimal" },
          body: JSON.stringify({ last_quiz_date: null }),
        });
      } catch { /* best effort */ }
    };

    const topicList = (topics as string[]).slice(0, 5).join(", ");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: `You are a STEM tutor generating short recap quiz questions. Always use the generate_quiz tool to return your answer.`,
        messages: [
          {
            role: "user",
            content: typeof goal === "string" && goal.trim()
              ? `The student's overall learning goal is: "${goal.trim()}". Generate one multiple-choice quiz question for each of these sub-topics, with every question framed as a real, concrete problem related to "${goal.trim()}" — not generic or abstract, even if a sub-topic name sounds generic: ${topicList}. Each question should test core understanding.`
              : `Generate one multiple-choice quiz question for each of these STEM concepts: ${topicList}. Each question should test core understanding.`,
          },
        ],
        tools: [
          {
            name: "generate_quiz",
            description: "Return a list of multiple-choice quiz questions.",
            input_schema: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      topic: { type: "string" },
                      question: { type: "string" },
                      options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                      correct: { type: "number", description: "0-indexed position of the correct option" },
                      explanation: { type: "string" },
                    },
                    required: ["topic", "question", "options", "correct", "explanation"],
                  },
                },
              },
              required: ["questions"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "generate_quiz" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      await releaseQuiz();
      return new Response(JSON.stringify({ error: "Failed to generate quiz", detail: errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolUse = data.content?.find((block: any) => block.type === "tool_use");

    if (!toolUse) {
      console.error("No tool_use block in response:", JSON.stringify(data));
      await releaseQuiz();
      return new Response(JSON.stringify({ error: "AI did not return quiz data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Slot was already claimed atomically before the AI call.
    return new Response(JSON.stringify(toolUse.input), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-quiz error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
