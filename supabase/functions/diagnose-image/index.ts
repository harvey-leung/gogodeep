import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MATH = `
MATHEMATICAL NOTATION: Express all math using LaTeX delimiters — inline as $...$ and display as $$...$$. Use LaTeX for all variables, fractions (\\frac{}{}), integrals (\\int), exponents, Greek letters, square roots (\\sqrt{}), etc. Never write math in plain text.`;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TURNSTILE_SECRET_KEY = Deno.env.get("TURNSTILE_SECRET_KEY");

// Modes that represent a real "scan" (the expensive vision/primary calls).
// Guests must pass Turnstile + the per-IP cap on these; the cheaper follow-up
// modes (guide_concept, more_practice) are not gated for guests.
const PRIMARY_MODES = new Set(["guide_steps", "guide", "identify"]);

// Server-side image payload ceilings (base64 string length, not bytes).
// Guests are capped tighter than authenticated users.
const GUEST_MAX_IMAGE_B64 = 2_800_000; // ~2 MB of binary
const USER_MAX_IMAGE_B64 = 9_000_000;  // ~6.5 MB of binary
const GUEST_SCAN_LIMIT = 2;            // free guest scans per IP per day

// Master kill-switch parity with src/lib/featureFlags.ts. When set, skip all
// per-user credit enforcement (everyone unlimited).
const FREE_FOR_ALL = Deno.env.get("FREE_FOR_ALL") === "true";

const BodySchema = z.object({
  image: z.string().max(USER_MAX_IMAGE_B64).optional(),
  mimeType: z.string().max(100).optional(),
  mode: z.enum(["identify", "guide", "guide_steps", "guide_concept", "more_practice"]).default("identify"),
  text: z.string().max(8000).optional(),
  practice_count: z.number().int().min(1).max(10).optional(),
  topic: z.string().max(500).optional(),
  start_id: z.number().int().min(0).max(100000).optional(),
  what_happened: z.string().max(2000).optional(),
  complexity: z.number().int().min(1).max(4).optional().default(2),
  turnstileToken: z.string().max(4000).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Verify a Cloudflare Turnstile token. Fails CLOSED: any error, missing secret,
// or unsuccessful verification returns false so the guest scan is rejected.
async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  if (!TURNSTILE_SECRET_KEY) return false;
  try {
    const form = new URLSearchParams();
    form.set("secret", TURNSTILE_SECRET_KEY);
    form.set("response", token);
    if (ip) form.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const data = await res.json();
    return data?.success === true;
  } catch (e) {
    console.error("Turnstile verify failed:", e);
    return false;
  }
}

// Resolve the user id from the bearer token, or null for guests (the client
// sends the anon key as the bearer when logged out, which has no user).
async function getUserId(jwt: string | undefined): Promise<string | null> {
  if (!jwt) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${jwt}`, apikey: SERVICE_KEY },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return json({ error: "invalid_request", detail: parsed.error.issues?.[0]?.message ?? "Invalid request body." }, 400);
    }
    const { image, mimeType, mode, text, practice_count, topic, start_id, what_happened, complexity, turnstileToken } = parsed.data;
    console.log("diagnose-image invoked, mode:", mode, "text:", !!text);

    // ── Authentication & guest gating ─────────────────────────────────────────
    const authHeader = req.headers.get("authorization");
    const jwt = authHeader?.replace("Bearer ", "").trim();
    const userId = await getUserId(jwt);
    const today = new Date().toISOString().split("T")[0];

    if (userId) {
      // Authenticated: enforce the authenticated image ceiling.
      if (typeof image === "string" && image.length > USER_MAX_IMAGE_B64) {
        return json({ error: "Image is too large. Please use a smaller photo." }, 413);
      }

      // Atomically check + decrement the user's scan credits server-side before
      // spending any AI budget. Only the expensive primary scan modes consume.
      if (PRIMARY_MODES.has(mode) && !FREE_FOR_ALL) {
        const creditRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_scan_credit`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SERVICE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ p_user_id: userId }),
        });
        if (!creditRes.ok) {
          console.error("consume_scan_credit failed:", creditRes.status, await creditRes.text());
          return json({ error: "Could not verify your scan credits. Please try again." }, 503);
        }
        const rows = await creditRes.json();
        const row = Array.isArray(rows) ? rows[0] : rows;
        if (!row?.allowed) {
          return json({ error: "daily_limit_reached", message: "You've used all your scans for today." }, 429);
        }
      }
    } else {
      // Guest path. Require a verified Turnstile token; fail closed.
      if (!TURNSTILE_SECRET_KEY) {
        console.error("TURNSTILE_SECRET_KEY not configured — rejecting guest scan (fail closed).");
        return json({ error: "Verification is temporarily unavailable. Please sign in to continue." }, 503);
      }
      if (typeof turnstileToken !== "string" || !turnstileToken) {
        return json({ error: "verification_required", message: "Please complete the verification to scan." }, 401);
      }
      const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "").trim();
      const verified = await verifyTurnstile(turnstileToken, ip);
      if (!verified) {
        return json({ error: "verification_failed", message: "Verification failed. Please try again or sign in." }, 403);
      }

      // Tighter guest image ceiling.
      if (typeof image === "string" && image.length > GUEST_MAX_IMAGE_B64) {
        return json({ error: "Image is too large for a guest scan. Please sign in or use a smaller photo." }, 413);
      }

      // Per-IP daily cap on the expensive primary scan modes only.
      if (PRIMARY_MODES.has(mode)) {
        const ipHash = await sha256Hex(`${ip}|${SERVICE_KEY}`);
        const capRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_guest_scan`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SERVICE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ p_ip_hash: ipHash, p_day: today, p_limit: GUEST_SCAN_LIMIT }),
        });
        if (!capRes.ok) {
          console.error("consume_guest_scan failed:", capRes.status, await capRes.text());
          return json({ error: "Could not verify your scan allowance. Please sign in to continue." }, 503);
        }
        const rows = await capRes.json();
        const row = Array.isArray(rows) ? rows[0] : rows;
        if (!row?.allowed) {
          return json({ error: "guest_limit_reached", message: "You've used your free scans. Sign up for more." }, 429);
        }
      }
    }

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
