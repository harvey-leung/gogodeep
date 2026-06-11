const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WHALE_CREDIT_LIMIT = 100;
const MAX_MESSAGES_PER_MINUTE = 3;

// Variable cost: 8–15 credits based on message length, giving uneven %
function messageCost(text: string): number {
  return 8 + Math.min(Math.floor(text.length / 60), 7);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

  try {
    const { messages, stepContext } = await req.json();

    // ── Auth & credit check ──────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization");
    const jwt = authHeader?.replace("Bearer ", "");

    let userId: string | null = null;
    let plan = "free";
    const today = new Date().toISOString().split("T")[0];
    const currentMinute = Math.floor(Date.now() / 60000);

    if (jwt) {
      // Identify user from JWT
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { "Authorization": `Bearer ${jwt}`, "apikey": SERVICE_KEY },
      });
      const userData = await userRes.json();
      userId = userData?.id ?? null;
    }

    // Require authentication — no guest chat (prevents anonymous AI-budget drain).
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "unauthorized", message: "Please sign in to chat with Blue." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the plan (only non-deep users are rate limited).
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=plan`,
      { headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY } }
    );
    const profiles = await profileRes.json();
    plan = (Array.isArray(profiles) ? profiles[0]?.plan : null) ?? "free";

    const lastMessage = messages[messages.length - 1]?.content ?? "";
    const cost = messageCost(lastMessage);

    // Atomically check + reserve the per-minute throttle and daily credit budget
    // BEFORE spending any AI budget (consume_whale_chat locks the profile row, so
    // concurrent requests can't both slip past). Deep plan is unlimited.
    let creditsUsed = 0;
    if (plan !== "deep") {
      const rlRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_whale_chat`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          p_user_id: userId, p_cost: cost, p_minute: currentMinute, p_today: today,
          p_minute_limit: MAX_MESSAGES_PER_MINUTE, p_credit_limit: WHALE_CREDIT_LIMIT,
        }),
      });
      if (!rlRes.ok) {
        console.error("consume_whale_chat failed:", rlRes.status, await rlRes.text());
        return new Response(
          JSON.stringify({ error: "Could not verify your chat limit. Please try again." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const rows = await rlRes.json();
      const row = Array.isArray(rows) ? rows[0] : rows;

      if (row?.status === "rate_limited") {
        return new Response(
          JSON.stringify({ error: "rate_limited", message: "You're sending messages too quickly. Please wait a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (row?.status === "daily_limit_reached") {
        return new Response(
          JSON.stringify({ error: "daily_limit_reached", creditsUsed: row?.credits_used ?? WHALE_CREDIT_LIMIT, creditsLimit: WHALE_CREDIT_LIMIT }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      creditsUsed = row?.credits_used ?? cost;
    }

    // ── AI call ──────────────────────────────────────────────────────────────
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 420,
        system: `You are Whal-E, a study assistant inside Gogodeep. Format every response clearly:

FORMATTING RULES:
- Use # for a short section header when helpful (e.g. # Key Idea)
- Use - for bullet lists
- Use **word** to highlight key terms (they render bold and colored)
- Use $...$ for inline LaTeX math, $$...$$ for display math
- No em dashes. Use a comma or colon instead.
- No preamble, no filler like "Great question!" or "Sure!".
- Maximum 180 words. Short sentences.

Answer academic questions (maths, physics, chemistry, biology, etc.) using the scan context provided. Redirect off-topic messages back to studying.${stepContext ? `\n\nScan context:\n${stepContext}` : ""}`,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: data.error?.message ?? "AI request failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reply = data.content?.[0]?.text ?? "";

    // Credits were already reserved atomically before the AI call.
    return new Response(
      JSON.stringify({
        reply,
        creditsUsed: plan === "deep" ? 0 : creditsUsed,
        creditsLimit: WHALE_CREDIT_LIMIT,
        showPracticeButton: !!stepContext,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
