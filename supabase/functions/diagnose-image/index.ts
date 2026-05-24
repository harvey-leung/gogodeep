const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MATH = `
MATHEMATICAL NOTATION: Express all math using LaTeX delimiters — inline as $...$ and display as $$...$$. Use LaTeX for all variables, fractions (\\frac{}{}), integrals (\\int), exponents, Greek letters, square roots (\\sqrt{}), etc. Never write math in plain text.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { image, mimeType, mode = "identify", text, practice_count, topic, start_id, what_happened, complexity = 2 } = body;
    console.log("diagnose-image invoked, mode:", mode, "text:", !!text);

    function complexityInstruction(level: number): string {
      if (level === 1) return " Complexity level: SIMPLE. Use very plain everyday language a 14-year-old could follow. No jargon. Break every step into the smallest possible sub-steps. Use analogies instead of formulas where possible.";
      if (level === 3) return " Complexity level: ADVANCED. Use precise IB/AP/A-Level academic terminology throughout. Reference standard theorems and rules by name. Keep steps concise — assume solid foundational knowledge.";
      if (level === 4) return " Complexity level: EXPERT. Use full university-level rigour and formal notation. Be dense and precise. Cite theorems, proofs, and edge cases where relevant. Assume deep mathematical maturity.";
      return " Complexity level: STANDARD. Use clear, accessible language with standard high-school terminology.";
    }

    function stepsDescription(level: number): string {
      const common = " CRITICAL: Every step must work with the SPECIFIC numbers, variables, and conditions from THIS question — never describe the general method or technique. Forbidden openings: 'Identify...', 'Recall...', 'Use the formula for...', 'Apply the rule...', 'Note that...' — these are method descriptions, not solution steps. Instead, substitute the actual values immediately and show the arithmetic/algebra. Never output an introduction or summary step. Never output an empty string. $...$ for inline math, $$...$$ for display equations.";
      if (level === 1) return `Complete step-by-step solution in plain language for a beginner. Each sub-step does one concrete thing with the actual numbers from the question. Prefer words over formulas where possible.${common}`;
      if (level === 3) return `Complete step-by-step solution using precise academic terminology. Each step names the rule AND immediately applies it to the question's specific values.${common}`;
      if (level === 4) return `Rigorous step-by-step solution with full formal notation. Each step applies theorems directly to the question's values — concise and dense.${common}`;
      return `Complete step-by-step solution. Each step substitutes the actual values from the question and shows concrete working.${common}`;
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    async function callAnthropic(payload: object) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 8096, ...payload }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error("Anthropic error:", res.status, err);
        if (res.status === 429) throw new Error("Rate limited. Please try again in a moment.");
        throw new Error("AI analysis failed");
      }
      return res.json();
    }

    // ── guide_steps: steps + metadata only, no concept or practice ──────────
    if (mode === "guide_steps") {
      const data = await callAnthropic({
        system: `You are an expert STEM tutor. Solve the student's specific question step by step. If the image is NOT a STEM question or is too blurry, set input_status accordingly. You MUST use the guide_steps tool. CRITICAL RULE: Every step must solve THIS specific question using its actual numbers and values — never explain the general method. A step like "Use the quadratic formula" is forbidden; write "x = (-3 ± √(9−4·2·1)) / (2·2)" instead. Do NOT produce steps that merely introduce, name, or describe what follows. Do NOT produce empty steps. BOUNDARY CONDITION RULE: If the original question specifies an interval with ≤ or ≥ (inclusive), check those boundary values explicitly. Do NOT change ≤ to < or ≥ to >. Check x=0, x=360, or any other boundary value if the interval is inclusive.${complexityInstruction(complexity)}${MATH}`,
        messages: [{
          role: "user",
          content: text
            ? [{ type: "text", text: `Walk me through this step by step.\n\nQuestion: ${text}` }]
            : [
                { type: "image", source: { type: "base64", media_type: mimeType || "image/png", data: image } },
                { type: "text", text: "Walk me through this question step by step." },
              ],
        }],
        tools: [{
          name: "guide_steps",
          description: "Return step-by-step solution and metadata for the student's question.",
          input_schema: {
            type: "object",
            properties: {
              concept_label: { type: "string", description: "2-3 word label for the concept, e.g. 'Quadratic Formula'" },
              question_summary: { type: "string", description: "One sentence describing what the question asks." },
              what_happened: { type: "string", description: "1-2 sentences. Describe exactly what this problem asks the student to find or do. Reference key numbers, variables, AND interval/domain constraints from the question (e.g., '0° ≤ x ≤ 360°'). Under 50 words. Do NOT mention student errors or working." },
              steps: {
                type: "array", items: { type: "string" },
                description: stepsDescription(complexity) + " If the question has interval constraints (e.g. 0° ≤ x ≤ 360°), check boundary values explicitly in your steps.",
              },
              practice_problems: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
                    question: { type: "string", description: "A practice question on the same concept." },
                    answer: { type: "string", description: "The correct answer. Use a plain value (number, expression, short phrase). $...$ for math." },
                    options: {
                      type: "array", items: { type: "string" }, minItems: 4, maxItems: 4,
                      description: "Exactly 4 answer choices. options[0] is the CORRECT answer. ALL 4 must be the same type and format — if the answer is a plain number, all options are plain numbers; if the answer has units, all options have the same units; if an expression, all are expressions. Wrong options must be plausible but clearly distinct. No mixing of formats.",
                    },
                  },
                  required: ["id", "question", "answer", "options"],
                },
                description: "Exactly 3 practice problems on the same concept. Each has 4 MC options of identical format.",
              },
              input_status: { type: "string", enum: ["ok", "blurry", "not_stem"], description: "Input quality check." },
            },
            required: ["concept_label", "question_summary", "what_happened", "steps", "practice_problems", "input_status"],
          },
        }],
        tool_choice: { type: "tool", name: "guide_steps" },
      });
      const tool = data.content?.find((b: any) => b.type === "tool_use");
      if (!tool) return new Response(JSON.stringify({ error: "AI did not return structured output" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ ...tool.input, mode: "guide" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── guide_concept: concept explanation only (text-only, fast) ────────────
    if (mode === "guide_concept") {
      const contextText = what_happened ? `Problem context: ${what_happened}\n\n` : "";
      const data = await callAnthropic({
        system: `You are a friendly STEM tutor explaining to a 12-year-old. Use simple everyday analogies and plain language — no jargon. Use LaTeX: $...$ inline, $$...$$ display.`,
        messages: [{ role: "user", content: [{ type: "text", text: `${contextText}Topic: ${topic ?? "STEM"}\n\nExplain the underlying concept like the student is 5 years old, using a simple analogy. Then give a recognition cue.` }] }],
        tools: [{
          name: "concept_explanation",
          description: "Return the concept explanation and recognition cue.",
          input_schema: {
            type: "object",
            properties: {
              core_concept: { type: "string", description: "2-3 sentences explaining the concept using a simple everyday analogy a child could understand. No jargon. No reference to this specific problem. Under 60 words." },
              recognition_cue: { type: "string", description: "2 sentences. Begin with 'When you see...' — state the signal and the first step to take. Plain language. Under 50 words." },
            },
            required: ["core_concept", "recognition_cue"],
          },
        }],
        tool_choice: { type: "tool", name: "concept_explanation" },
      });
      const tool = data.content?.find((b: any) => b.type === "tool_use");
      return new Response(JSON.stringify(tool?.input ?? {}), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── more_practice: generate N practice problems on a topic ───────────────
    if (mode === "more_practice") {
      const count = practice_count ?? 2;
      const idStart = start_id ?? 1;
      const data = await callAnthropic({
        system: `You are an expert STEM tutor. Generate original practice problems. Use LaTeX: $...$ inline, $$...$$ display.`,
        messages: [{ role: "user", content: [{ type: "text", text: `Generate ${count} practice problems on: ${topic ?? "STEM"}` }] }],
        tools: [{
          name: "generate_practice",
          description: "Return practice problems.",
          input_schema: {
            type: "object",
            properties: {
              practice_problems: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
                    question: { type: "string" },
                    answer: { type: "string" },
                    options: {
                      type: "array", items: { type: "string" }, minItems: 4, maxItems: 4,
                      description: "Exactly 4 MC options. options[0] is correct. All options must be same type/format. No mixing formats.",
                    },
                  },
                  required: ["id", "question", "answer", "options"],
                },
                description: `Exactly ${count} problems. Start IDs at ${idStart}. $...$ LaTeX for all math. Answers must be whole numbers, simple fractions, or short text. Each has 4 MC options of identical format.`,
              },
            },
            required: ["practice_problems"],
          },
        }],
        tool_choice: { type: "tool", name: "generate_practice" },
      });
      const tool = data.content?.find((b: any) => b.type === "tool_use");
      return new Response(JSON.stringify(tool?.input ?? { practice_problems: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── guide / identify: legacy full-response modes (backwards compat) ──────
    const isGuide = mode === "guide";
    const practiceCount = practice_count ?? 3;

    const systemPrompt = isGuide
      ? `You are an expert STEM tutor. Break down the student's question step by step. For core_concept: explain using a simple everyday analogy a child could understand — no jargon, plain language only. If the image is NOT a STEM question or is too blurry, set input_status accordingly. You MUST use the guide_question tool. BOUNDARY CONDITION RULE: If the question specifies an interval with ≤ or ≥ (inclusive), preserve this notation throughout. Check boundary values (like x=0 or x=360) explicitly if the interval is inclusive. Do NOT change ≤ to < or ≥ to >.${MATH}`
      : `You are an expert STEM tutor specializing in diagnosing errors in student work. Identify the EXACT point where the logic breaks down. For core_concept: explain using a simple everyday analogy a child could understand — no jargon, plain language only. If the image is NOT STEM student working or is too blurry, set input_status accordingly. You MUST use the diagnose_error tool. BOUNDARY CONDITION RULE: If the question specifies an interval with ≤ or ≥ (inclusive), preserve this notation throughout. Check boundary values (like x=0 or x=360) explicitly if the interval is inclusive. Do NOT change ≤ to < or ≥ to >.${MATH}`;

    const tools = isGuide ? [{
      name: "guide_question",
      description: "Return a structured step-by-step guide with concept and practice.",
      input_schema: {
        type: "object",
        properties: {
          concept_label: { type: "string", description: "2-3 word concept label." },
          question_summary: { type: "string", description: "One sentence describing the question." },
          what_happened: { type: "string", description: "2-3 sentences about this specific problem. Reference actual numbers/expressions." },
          core_concept: { type: "string", description: "2-3 sentences explaining the concept using a simple everyday analogy a child could understand. No jargon. Plain language only. Under 60 words." },
          recognition_cue: { type: "string", description: "2 sentences. 'When you see...' signal, first step, top trap." },
          steps: { type: "array", items: { type: "string" }, description: "Step-by-step solution. $...$ inline math, $$...$$ display. If the question has interval constraints (e.g. 0° ≤ x ≤ 360°), check boundary values explicitly." },
          practice_problems: {
            type: "array",
            items: { type: "object", properties: { id: { type: "number" }, question: { type: "string" }, answer: { type: "string" } }, required: ["id", "question", "answer"] },
            description: `Exactly ${practiceCount} practice problems. $...$ LaTeX. Answers must be whole numbers, simple fractions, or short text.`,
          },
          input_status: { type: "string", enum: ["ok", "blurry", "not_stem"] },
        },
        required: ["concept_label", "question_summary", "what_happened", "core_concept", "recognition_cue", "steps", "practice_problems", "input_status"],
      },
    }] : [{
      name: "diagnose_error",
      description: "Return a structured diagnosis with concept and practice.",
      input_schema: {
        type: "object",
        properties: {
          error_category: { type: "string", enum: ["Conceptual", "Procedural", "Computational", "Notational", "Correct"] },
          error_tag: { type: "string", description: "Short label, e.g. 'Sign Error'. Use 'All correct' if correct." },
          explanation: { type: "string", description: "2-3 sentences: where and why the logic broke down." },
          what_happened: { type: "string", description: "2-3 sentences about this specific problem. Reference actual numbers/steps." },
          core_concept: { type: "string", description: "2-3 sentences explaining the concept using a simple everyday analogy a child could understand. No jargon. Plain language only. Under 60 words." },
          recognition_cue: { type: "string", description: "2 sentences. 'When you see...' signal, first step, top trap." },
          practice_problems: {
            type: "array",
            items: { type: "object", properties: { id: { type: "number" }, question: { type: "string" }, answer: { type: "string" } }, required: ["id", "question", "answer"] },
            description: `Exactly ${practiceCount} practice problems targeting this weakness. $...$ LaTeX. Answers must be whole numbers, simple fractions, or short text.`,
          },
          input_status: { type: "string", enum: ["ok", "blurry", "not_stem"] },
        },
        required: ["error_category", "error_tag", "explanation", "what_happened", "core_concept", "recognition_cue", "practice_problems", "input_status"],
      },
    }];

    const toolName = isGuide ? "guide_question" : "diagnose_error";
    const userText = isGuide
      ? "Walk me through this question step by step with concept and practice problems."
      : "Analyze this student's work: find the error, explain the concept, and generate targeted practice.";

    const data = await callAnthropic({
      system: systemPrompt,
      messages: [{
        role: "user",
        content: text
          ? [{ type: "text", text: `${userText}\n\nQuestion: ${text}` }]
          : [
              { type: "image", source: { type: "base64", media_type: mimeType || "image/png", data: image } },
              { type: "text", text: userText },
            ],
      }],
      tools,
      tool_choice: { type: "tool", name: toolName },
    });

    const toolUse = data.content?.find((block: any) => block.type === "tool_use");
    if (!toolUse) {
      return new Response(JSON.stringify({ error: "AI did not return structured output" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ...toolUse.input, mode }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: unknown) {
    console.error("diagnose-image error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("Rate limited") ? 429 : 500;
    return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
