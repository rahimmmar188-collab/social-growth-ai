import {
  AgentType,
  getAgentConfig,
  streamGemini,
  streamGroq,
  refineWithGemini,
  evaluateQuality,
} from "./model-router";

// Sentinel string injected into the stream to signal Pass 2 refined data
export const REFINED_SENTINEL = "\n\n__REFINED__:";

// ─── Main streaming response with dual-pass ────────────────────────────────────
export function createDualPassStream(
  agentType: AgentType,
  systemPrompt: string,
  userMessage: string
): Response {
  const encoder = new TextEncoder();
  const config = getAgentConfig(agentType);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (text: string) =>
        controller.enqueue(encoder.encode(text));

      try {
        // ── PASS 1: Generate ─────────────────────────────────────────────────
        let pass1Text = "";
        const onChunk = (chunk: string) => {
          pass1Text += chunk;
          send(chunk);
        };

        let attempts = 0;
        let pass1Success = false;

        while (attempts < 2 && !pass1Success) {
          try {
            pass1Text = "";
            if (config.generator === "groq") {
              await streamGroq(systemPrompt, userMessage, onChunk);
            } else if (config.generator === "gemini-flash") {
              await streamGemini("gemini-2.5-flash", systemPrompt, userMessage, onChunk);
            } else if (config.generator === "gemini-pro") {
              await streamGemini("gemini-2.5-pro", systemPrompt, userMessage, onChunk);
            }
            pass1Success = true;
          } catch (genErr) {
            attempts++;
            if (attempts >= 2) {
              // Final fallback: try Gemini Flash regardless of config
              try {
                pass1Text = "";
                await streamGemini("gemini-2.5-flash", systemPrompt, userMessage, onChunk);
                pass1Success = true;
              } catch {
                throw genErr;
              }
            }
          }
        }

        // ── Extract JSON from Pass 1 ─────────────────────────────────────────
        const jsonMatch = pass1Text.match(/\{[\s\S]*\}/);
        const rawJson = jsonMatch ? jsonMatch[0] : "";

        // ── PASS 2: Refine (if configured and quality is low) ─────────────────
        if (config.refiner === "gemini-pro" && rawJson) {
          const quality = evaluateQuality(rawJson);

          if (quality === "low") {
            try {
              const refined = await refineWithGemini(rawJson);
              // Validate refined JSON before sending
              JSON.parse(refined);
              send(REFINED_SENTINEL + refined);
            } catch {
              // Pass 2 failed — silently skip, Pass 1 already streamed
            }
          }
        }

        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send(`\n\n[ERROR]: ${msg}`);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}

// ─── Legacy export kept for any old imports (redirects to dual-pass) ──────────
export function createStreamingResponse(
  systemPrompt: string,
  userMessage: string
): Response {
  // Fallback: just stream via Gemini Flash without agent-specific routing
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await streamGemini("gemini-2.5-flash", systemPrompt, userMessage, (chunk) =>
          controller.enqueue(encoder.encode(chunk))
        );
        controller.close();
      } catch (err) {
        controller.enqueue(
          encoder.encode(`\n\n[ERROR]: ${err instanceof Error ? err.message : String(err)}`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
