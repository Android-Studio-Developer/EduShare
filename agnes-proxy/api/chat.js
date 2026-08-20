// Vercel serverless function — proxies eduBot's AI requests server-side so
// the browser never talks to *.workers.dev directly. Deploy this folder to
// Vercel's free tier (no credit card needed), then point eduShare's
// AGNES_API_ENDPOINT at https://<your-project>.vercel.app/api/chat.
const UPSTREAM_URL = "https://chatgptian-api.chatgpt-ai-5-2o2.workers.dev/api/chat";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const upstreamResponse = await fetch(UPSTREAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body ?? {}),
    });
    const data = await upstreamResponse.json();
    res.status(upstreamResponse.status).json(data);
  } catch (error) {
    res.status(502).json({ error: "Could not reach the upstream AI service." });
  }
}
