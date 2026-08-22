const AGNES_ENDPOINT = "https://apihub.agnes-ai.com/v1/chat/completions";
const DEFAULT_MODEL = "agnes-2.5-flash";

export async function askAgnes(payload, apiKey, model = DEFAULT_MODEL) {
  if (!apiKey) {
    return { status: 500, body: { error: "AGNES_API_KEY is not configured on the server." } };
  }

  const message = typeof payload?.message === "string" ? payload.message.trim() : "";
  const preamble = typeof payload?.preamble === "string" ? payload.preamble.trim() : "";
  const requestedTemperature = Number(payload?.temperature);
  const temperature = Number.isFinite(requestedTemperature)
    ? Math.min(2, Math.max(0, requestedTemperature))
    : 0.7;

  if (!message) {
    return { status: 400, body: { error: "A message is required." } };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(AGNES_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(preamble ? [{ role: "system", content: preamble }] : []),
          { role: "user", content: message.slice(0, 4_000) },
        ],
        temperature,
        max_tokens: 512,
        stream: false,
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const upstreamMessage = data?.error?.message ?? data?.error ?? "Agnes AI request failed.";
      return { status: response.status, body: { error: String(upstreamMessage) } };
    }

    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      return { status: 502, body: { error: "Agnes AI returned an empty response." } };
    }

    return { status: 200, body: { text: text.trim() } };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "Agnes AI timed out."
      : "Could not reach Agnes AI.";
    return { status: 502, body: { error: message } };
  } finally {
    clearTimeout(timeout);
  }
}
