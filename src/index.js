import { processR2Notification } from "./import.js";

export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        await processR2Notification(message.body, env);
        message.ack();
      } catch (error) {
        console.error(JSON.stringify({
          message: "R2 result import failed",
          key: message.body?.object?.key,
          attempts: message.attempts,
          error: error instanceof Error ? error.message : String(error),
        }));
        message.retry({ delaySeconds: 30 });
      }
    }
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/api/health") {
      return new Response("Not found", { status: 404 });
    }
    if (request.method !== "GET") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "GET" },
      });
    }

    const checks = await Promise.allSettled([
      Promise.resolve().then(() => env.DB.prepare("SELECT 1").first()),
      Promise.resolve().then(() => env.RAW_RESULTS.list({ limit: 1 })),
    ]);
    const d1 = checks[0].status === "fulfilled";
    const r2 = checks[1].status === "fulfilled";
    const ok = d1 && r2;

    return Response.json(
      { ok, d1, r2 },
      {
        status: ok ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  },
};
