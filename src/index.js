import { canonicalCategory, processR2Notification } from "./import.js";

const YEAR = 2026;
const NO_STORE = { "Cache-Control": "no-store" };

export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      console.log(JSON.stringify({ message: "R2 import event", key: message.body?.object?.key }));
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

    if (url.pathname === "/api/health") {
      if (request.method !== "GET") {
        return new Response("Method not allowed", { status: 405, headers: { Allow: "GET" } });
      }
      const checks = await Promise.allSettled([
        Promise.resolve().then(() => env.DB.prepare("SELECT 1").first()),
        Promise.resolve().then(() => env.RAW_RESULTS.list({ limit: 1 })),
      ]);
      const d1 = checks[0].status === "fulfilled";
      const r2 = checks[1].status === "fulfilled";
      const ok = d1 && r2;
      return Response.json({ ok, d1, r2 }, { status: ok ? 200 : 503, headers: NO_STORE });
    }

    if (url.pathname !== "/api/results") return new Response("Not found", { status: 404 });
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET" } });
    }

    if (url.searchParams.get("year") !== String(YEAR)) {
      return Response.json({ error: "year must be 2026" }, { status: 400, headers: NO_STORE });
    }

    try {
      const [eventRows, totalRows] = await Promise.all([
        env.DB.prepare(`
          SELECT e.season, i.status, er.entry_id, er.athlete_id, al.flow_id,
            er.rank, er.name, er.source_category, er.score_hundredths
          FROM events e
          JOIN imports i ON i.import_id = e.current_import_id
          LEFT JOIN event_results er ON er.import_id = i.import_id
          LEFT JOIN "athlete-linking" al ON al.athlete_id = er.athlete_id
          WHERE e.year = ?
          ORDER BY CASE e.season
            WHEN 'Spring' THEN 1 WHEN 'Summer' THEN 2
            WHEN 'Autumn' THEN 3 WHEN 'Winter' THEN 4 ELSE 5
          END, er.rank, er.entry_id
        `).bind(YEAR).all(),
        env.DB.prepare(`
          WITH names AS (
            SELECT al.flow_id, er.name,
              ROW_NUMBER() OVER (
                PARTITION BY al.flow_id
                ORDER BY CASE e.season
                  WHEN 'Spring' THEN 1 WHEN 'Summer' THEN 2
                  WHEN 'Autumn' THEN 3 WHEN 'Winter' THEN 4 ELSE 5
                END DESC, er.rank IS NULL, er.rank, er.entry_id
              ) AS position
            FROM "athlete-linking" al
            JOIN event_results er ON er.athlete_id = al.athlete_id
            JOIN imports i ON i.import_id = er.import_id
            JOIN events e ON e.event_pk = i.event_pk AND e.current_import_id = i.import_id
            WHERE e.year = ?
          )
          SELECT ts.flow_id, ts.rank, names.name, ts.category, ts.score_hundredths
          FROM total_standings ts
          JOIN names ON names.flow_id = ts.flow_id AND names.position = 1
          WHERE ts.year = ?
          ORDER BY ts.rank, ts.flow_id
        `).bind(YEAR, YEAR).all(),
      ]);

      const totalResults = totalRows.results.map((row) => ({
        flow_id: row.flow_id,
        rank: row.rank,
        name: row.name,
        category: row.category,
        score: row.score_hundredths / 100,
      }));
      const events = new Map();
      for (const row of eventRows.results) {
        let event = events.get(row.season);
        if (!event) {
          event = { season: row.season, status: row.status, results: [] };
          events.set(row.season, event);
        }
        if (row.entry_id !== null) {
          event.results.push({
            athlete_id: row.athlete_id,
            flow_id: row.flow_id,
            rank: row.rank,
            name: row.name,
            category: canonicalCategory(row.source_category) ?? row.source_category,
            score: row.score_hundredths / 100,
          });
        }
      }

      const eventList = [...events.values()];
      const total = {
        status: eventList.some((event) => event.status === "active") ? "active" : "finished",
        results: totalResults,
      };
      return Response.json({ year: YEAR, total, events: eventList }, { headers: NO_STORE });
    } catch (error) {
      console.error(JSON.stringify({
        message: "Results query failed",
        year: YEAR,
        error: error instanceof Error ? error.message : String(error),
      }));
      return Response.json({ error: "Unable to load results" }, { status: 500, headers: NO_STORE });
    }
  },
};
