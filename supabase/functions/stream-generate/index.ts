const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Actions:
//   validate_goal     - given goal string, return whether it's specific enough to build on
//   intake_questions  - given goal string, return 3 intake questions
//   program           - given goal + intake answers, return curriculum
//   diagnostic        - given goal + program topics, return 6 questions at levels 1-10
//   practice          - given goal + level + topics, return 6 questions spanning easy-hard around that level

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { action, goal, intakeAnswers, topics, level } = await req.json();

    // Auth check
    const authHeader = req.headers.get("authorization");
    const jwt = authHeader?.replace("Bearer ", "");
    let plan = "free";

    if (jwt) {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { "Authorization": `Bearer ${jwt}`, "apikey": SERVICE_KEY },
      });
      const userData = await userRes.json();
      const userId = userData?.id ?? null;
      if (userId) {
        const profileRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=plan`,
          { headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY } }
        );
        const profiles = await profileRes.json();
        plan = profiles?.[0]?.plan ?? "free";
      }
    }

    const anthropicCall = async (systemPrompt: string, userContent: string, toolName: string, toolSchema: object) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }],
          tools: [{ name: toolName, description: "Return structured data.", input_schema: toolSchema }],
          tool_choice: { type: "tool", name: toolName },
        }),
      });
      if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);
      const data = await res.json();
      const toolUse = data.content?.find((b: any) => b.type === "tool_use");
      if (!toolUse) throw new Error("No tool_use in response");
      return toolUse.input;
    };

    if (action === "validate_goal") {
      const result = await anthropicCall(
        "You are Blue, a friendly study whale. Decide whether a student's stated learning goal is specific enough to build a real curriculum and generate concrete practice questions from. Reject goals that are too vague, generic, or contentless to plan around (e.g. 'get smarter', 'school stuff', 'math', 'be better', 'idk', random text). Accept goals that name a subject, skill, exam, or topic — even broad ones like 'algebra' or 'Spanish' are fine as long as they point to an actual field of study.",
        `Student's stated learning goal: "${goal}"\n\nIs this specific enough to build a personalized study plan and real, concrete practice questions around? Respond with valid=true/false. If false, give a short, friendly one-sentence reason plus an example of a clearer goal.`,
        "validate_goal",
        {
          type: "object",
          properties: {
            valid: { type: "boolean" },
            reason: { type: "string", description: "If invalid, a short friendly message telling the student their goal is too vague and how to clarify it. Empty string if valid." },
          },
          required: ["valid", "reason"],
        }
      );
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "intake_questions") {
      const result = await anthropicCall(
        "You are Blue, a friendly study whale. Generate 3 short intake questions to understand the student's context for their learning goal. Questions should be easy to answer quickly.",
        `Student's learning goal: "${goal}"\n\nGenerate 3 follow-up intake questions. Mix types: some multiple choice (4 options), one short text. Focus on: their current level, available time, specific sub-topic interests.`,
        "intake_questions",
        {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  question: { type: "string" },
                  type: { type: "string", enum: ["mc", "text"] },
                  options: { type: "array", items: { type: "string" } },
                },
                required: ["id", "question", "type"],
              },
              minItems: 3,
              maxItems: 3,
            },
          },
          required: ["questions"],
        }
      );
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "program") {
      const answersText = Object.entries(intakeAnswers ?? {})
        .map(([q, a]) => `Q: ${q}\nA: ${a}`)
        .join("\n\n");

      const result = await anthropicCall(
        "You are Blue, a study whale building a personal learning program. Create a clear, structured curriculum based on the student's goal and intake answers. Keep it focused and achievable.",
        `Goal: "${goal}"\n\nStudent answers:\n${answersText}\n\nCreate a complete learning program with 4-6 units.`,
        "generate_program",
        {
          type: "object",
          properties: {
            title: { type: "string", description: "Short catchy stream title (3-6 words)" },
            tagline: { type: "string", description: "One-line description of what this stream covers" },
            estimatedWeeks: { type: "number" },
            units: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  topics: { type: "array", items: { type: "string" } },
                  estimatedTime: { type: "string" },
                },
                required: ["name", "topics", "estimatedTime"],
              },
              minItems: 3,
              maxItems: 6,
            },
          },
          required: ["title", "tagline", "estimatedWeeks", "units"],
        }
      );
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "diagnostic") {
      const topicList = (topics ?? []).slice(0, 6).join(", ");
      const result = await anthropicCall(
        `You are Blue, generating diagnostic questions to pinpoint a student's level. Questions MUST be directly and specifically about the student's goal — not generic. Use real, concrete problems from that subject. Level 1 = the most basic possible question a total beginner could attempt (e.g. for algebra: "Solve x + 2 = 5"). Level 8-9 = genuinely hard, advanced problems that require deep understanding (e.g. for algebra: "Find all real solutions to 2x² − 3x − 5 = 0"). Each question should be distinctly harder than the previous. Never use vague or abstract questions — always use actual subject-specific problems.`,
        `Student's goal: "${goal}"\nSubject topics: ${topicList}\n\nGenerate 8 diagnostic questions spanning levels 1 through 8. They must be real, concrete questions about "${goal}" — not generic academic questions.`,
        "generate_diagnostic",
        {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                  correct: { type: "number", description: "0-indexed" },
                  explanation: { type: "string" },
                  level: { type: "number", description: "1-10 difficulty" },
                  topic: { type: "string" },
                },
                required: ["question", "options", "correct", "explanation", "level", "topic"],
              },
              minItems: 6,
              maxItems: 8,
            },
          },
          required: ["questions"],
        }
      );
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "practice") {
      const topicList = (topics ?? []).slice(0, 6).join(", ");
      const targetLevel = level ?? 5;
      const lo = Math.max(1, targetLevel - 2);
      const hi = Math.min(10, targetLevel + 2);
      const result = await anthropicCall(
        `You are Blue, generating personalized practice questions. Questions MUST be specific, real problems about the student's subject — not vague or generic. The set should progress from EASY to HARD, spanning levels ${lo} to ${hi}, centered around the student's level (${targetLevel}/10). Level 1 = very basic, level 10 = expert. Use concrete, subject-specific problems. Sort the questions from easiest (lowest level) to hardest (highest level).`,
        `Goal: "${goal}"\nTopics: ${topicList}\nStudent level: ${targetLevel}/10\n\nGenerate 6 practice questions about "${goal}" that progress from easy to hard, spanning levels ${lo} through ${hi} (assign each question a "level" in that range, with at least one question at each end of the range). Mix the topics. Each question must be real, specific, and answerable with a clear correct answer. Order the questions from easiest to hardest.`,
        "generate_practice",
        {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                  correct: { type: "number", description: "0-indexed" },
                  explanation: { type: "string" },
                  level: { type: "number" },
                  topic: { type: "string" },
                },
                required: ["question", "options", "correct", "explanation", "level", "topic"],
              },
              minItems: 6,
              maxItems: 6,
            },
          },
          required: ["questions"],
        }
      );
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("stream-generate error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
