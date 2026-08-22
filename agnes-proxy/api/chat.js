// Optional Vercel serverless entrypoint. The key belongs in the deployment's
// environment settings, never in source code or a VITE_* variable.
import { askAgnes } from "../agnes.mjs";

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

  const result = await askAgnes(req.body ?? {}, process.env.AGNES_API_KEY, process.env.AGNES_MODEL);
  res.status(result.status).json(result.body);
}
