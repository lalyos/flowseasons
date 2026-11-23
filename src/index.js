import { canonicalCategory, processR2Notification } from "./import.js";

const YEAR = 2026;
const NO_STORE = { "Cache-Control": "no-store" };
const EVENT_ORDER = { Spring: 1, Summer: 2, Autumn: 3, Winter: 4 };

async function multipleCategoryAthletes(env) {
  const { results } = await env.DB.prepare(`
    SELECT al.flow_id, er.athlete_id, er.name, e.season, er.rank,
      er.entry_id, er.source_category, er.score_hundredths, yc.category AS year_category
    FROM events e
    JOIN imports i ON i.import_id = e.current_import_id
    JOIN event_results er ON er.import_id = i.import_id
    JOIN "athlete-linking" al ON al.athlete_id = er.athlete_id
    LEFT JOIN year_categories yc ON yc.year = e.year AND yc.flow_id = al.flow_id
    WHERE e.year = ?
    ORDER BY al.flow_id, CASE e.season
      WHEN 'Spring' THEN 1 WHEN 'Summer' THEN 2
      WHEN 'Autumn' THEN 3 WHEN 'Winter' THEN 4 ELSE 5
    END, er.rank IS NULL, er.rank, er.entry_id
  `).bind(YEAR).all();
  const athletes = new Map();

  for (const row of results) {
    const category = canonicalCategory(row.source_category);
    if (!category) continue;
    let athlete = athletes.get(row.flow_id);
    if (!athlete) {
      athlete = {
        flow_id: row.flow_id,
        name: null,
        year_category: row.year_category,
        athlete_ids: new Set(),
        categories: new Set(),
        sources: new Map(),
        latest_season: 0,
        latest_rank: Number.MAX_SAFE_INTEGER,
      };
      athletes.set(row.flow_id, athlete);
    }
    const seasonOrder = EVENT_ORDER[row.season] || 0;
    const rank = row.rank ?? Number.MAX_SAFE_INTEGER;
    if (seasonOrder > athlete.latest_season || (seasonOrder === athlete.latest_season && rank < athlete.latest_rank)) {
      athlete.name = row.name;
      athlete.latest_season = seasonOrder;
      athlete.latest_rank = rank;
    }
    if (row.year_category) athlete.year_category = row.year_category;
    athlete.athlete_ids.add(row.athlete_id);
    athlete.categories.add(category);
    const sourceKey = `${row.season}\0${row.athlete_id}\0${category}`;
    if (!athlete.sources.has(sourceKey)) {
      athlete.sources.set(sourceKey, {
        season: row.season,
        athlete_id: row.athlete_id,
        name: row.name,
        category,
        rank: row.rank,
        score: row.score_hundredths / 100,
      });
    }
  }

  return [...athletes.values()]
    .filter((athlete) => athlete.categories.size > 1)
    .map(({ latest_season, latest_rank, athlete_ids, categories, sources, ...athlete }) => ({
      ...athlete,
      issue_type: athlete_ids.size === 1 ? "category_change" : "identity_review",
      athlete_ids: [...athlete_ids],
      categories: [...categories],
      sources: [...sources.values()],
    }));
}

async function multipleRegistrations(env) {
  const { results } = await env.DB.prepare(`
    WITH multi_registration AS (
      SELECT flow_id
      FROM "athlete-linking"
      GROUP BY flow_id
      HAVING COUNT(DISTINCT athlete_id) > 1
    ), current_results AS (
      SELECT er.athlete_id, er.name, e.season, er.rank, er.entry_id, er.import_id, er.score_hundredths, er.source_category
      FROM events e
      JOIN imports i ON i.import_id = e.current_import_id
      JOIN event_results er ON er.import_id = i.import_id
      WHERE e.year = ?
    )
    SELECT al.flow_id, al.athlete_id, cr.name, cr.season, cr.rank, cr.entry_id, cr.import_id, cr.score_hundredths, cr.source_category
    FROM multi_registration mr
    JOIN "athlete-linking" al ON al.flow_id = mr.flow_id
    LEFT JOIN current_results cr ON cr.athlete_id = al.athlete_id
    ORDER BY al.flow_id, al.athlete_id, CASE cr.season
      WHEN 'Spring' THEN 1 WHEN 'Summer' THEN 2
      WHEN 'Autumn' THEN 3 WHEN 'Winter' THEN 4 ELSE 5
    END, cr.rank IS NULL, cr.rank, cr.entry_id
  `).bind(YEAR).all();
  const registrations = new Map();
  const linkedAthletes = new Map();

  for (const row of results) {
    let registration = registrations.get(row.flow_id);
    if (!registration) {
      registration = { flow_id: row.flow_id, name: null, athlete_ids: new Map(), latest_season: 0, latest_rank: Number.MAX_SAFE_INTEGER };
      registrations.set(row.flow_id, registration);
    }
    if (!registration.athlete_ids.has(row.athlete_id)) {
      const athlete = { athlete_id: row.athlete_id, sources: new Map() };
      registration.athlete_ids.set(row.athlete_id, athlete);
      linkedAthletes.set(row.athlete_id, athlete);
    }
    if (!row.season) continue;

    registration.athlete_ids.get(row.athlete_id).sources.set(row.season, {
      season: row.season,
      name: row.name,
      rank: row.rank,
      score: row.score_hundredths / 100,
      entry_id: row.entry_id,
      import_id: row.import_id,
      category: canonicalCategory(row.source_category) ?? row.source_category,
      ranking: false,
      startlist: false,
    });
    const seasonOrder = EVENT_ORDER[row.season] || 0;
    const rank = row.rank ?? Number.MAX_SAFE_INTEGER;
    if (seasonOrder > registration.latest_season || (seasonOrder === registration.latest_season && rank < registration.latest_rank)) {
      registration.name = row.name;
      registration.latest_season = seasonOrder;
      registration.latest_rank = rank;
    }
  }

  const { results: sourceFiles } = await env.DB.prepare(`
    SELECT i.r2_key, e.season
    FROM imports i
    JOIN events e ON e.event_pk = i.event_pk
    WHERE e.year = ?
    ORDER BY i.accepted_at
  `).bind(YEAR).all();
  for (const sourceFile of sourceFiles) {
    try {
      const object = await env.RAW_RESULTS.get(sourceFile.r2_key);
      if (!object) continue;
      const payload = await object.json();
      for (const [field, presence] of [["ranking", "ranking"], ["startlist", "startlist"]]) {
        for (const entry of Array.isArray(payload[field]) ? payload[field] : []) {
          const athlete = linkedAthletes.get(String(entry?.athlete_id));
          if (!athlete) continue;
          let source = athlete.sources.get(sourceFile.season);
          if (!source) {
            source = { season: sourceFile.season, name: null, rank: null, score: null, entry_id: null, import_id: null, category: null, ranking: false, startlist: false };
            athlete.sources.set(sourceFile.season, source);
          }
          if (typeof entry.name === "string") source.name = entry.name;
          const category = (Array.isArray(entry.custom_participant_fields) ? entry.custom_participant_fields : [])
            .map((field) => canonicalCategory(field?.value))
            .find(Boolean);
          if (category) source.category = category;
          source[presence] = true;
        }
      }
    } catch (error) {
      console.error(JSON.stringify({
        message: "Unable to read multi-registration source evidence",
        key: sourceFile.r2_key,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  return [...registrations.values()].map(({ latest_season, latest_rank, athlete_ids, ...registration }) => ({
    ...registration,
    athlete_ids: [...athlete_ids.values()].map((athlete) => ({
      athlete_id: athlete.athlete_id,
      sources: [...athlete.sources.values()]
        .sort((a, b) => (EVENT_ORDER[a.season] || 0) - (EVENT_ORDER[b.season] || 0))
        .map(({ ranking, startlist, ...source }) => ({
          ...source,
          presence: ranking && startlist ? "ranking_and_startlist" : ranking ? "ranking" : "startlist",
        })),
    })),
  }));
}

function collisionReasons(registration, topTenFlowIds) {
  const scored = registration.athlete_ids.flatMap((athlete) => athlete.sources
    .filter((source) => source.entry_id != null)
    .map((source) => ({ ...source, athlete_id: athlete.athlete_id })));
  const eventCounts = new Map();
  for (const source of scored) eventCounts.set(source.season, (eventCounts.get(source.season) || 0) + 1);
  const reasons = [];
  if ([...eventCounts.values()].some((count) => count > 1)) reasons.push("same_event_collision");

  let scoreDisparity = false;
  for (let i = 0; i < scored.length && !scoreDisparity; i++) {
    for (let j = i + 1; j < scored.length; j++) {
      if (
        scored[i].athlete_id !== scored[j].athlete_id &&
        scored[i].score > 0 && scored[j].score > 0 &&
        Math.max(scored[i].score, scored[j].score) >= 2 * Math.min(scored[i].score, scored[j].score)
      ) {
        scoreDisparity = true;
        break;
      }
    }
  }
  if (scoreDisparity) reasons.push("score_disparity");
  if (topTenFlowIds.has(registration.flow_id)) reasons.push("top_ten");
  return reasons;
}

async function collisionCases(env) {
  const registrations = await multipleRegistrations(env);
  const { results: topTenRows } = await env.DB.prepare(`
    WITH category_ranks AS (
      SELECT flow_id,
        RANK() OVER (PARTITION BY category ORDER BY score_hundredths DESC) AS category_rank
      FROM total_standings
      WHERE year = ?
    )
    SELECT flow_id FROM category_ranks WHERE category_rank <= 10
  `).bind(YEAR).all();
  const topTenFlowIds = new Set(topTenRows.map((row) => row.flow_id));
  const detected = registrations
    .map((registration) => ({ registration, reasons: collisionReasons(registration, topTenFlowIds) }))
    .filter(({ reasons }) => reasons.length);
  const now = new Date().toISOString();

  if (detected.length) {
    await env.DB.batch(detected.map(({ registration, reasons }) => {
      const athleteIds = registration.athlete_ids.map((athlete) => athlete.athlete_id).sort();
      const caseKey = `multi:${registration.flow_id}`;
      return env.DB.prepare(`
        INSERT INTO collision_cases (
          case_key, original_flow_id, athlete_ids_json, evidence_json, reasons_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(case_key) DO UPDATE SET
          resolution_json = CASE
            WHEN collision_cases.athlete_ids_json = excluded.athlete_ids_json
              THEN collision_cases.resolution_json
            ELSE NULL
          END,
          athlete_ids_json = excluded.athlete_ids_json,
          evidence_json = excluded.evidence_json,
          reasons_json = excluded.reasons_json,
          updated_at = excluded.updated_at
      `).bind(
        caseKey,
        registration.flow_id,
        JSON.stringify(athleteIds),
        JSON.stringify(registration),
        JSON.stringify(reasons),
        now,
      );
    }));
  }

  const { results } = await env.DB.prepare(`
    SELECT case_key, original_flow_id, athlete_ids_json, evidence_json,
      reasons_json, resolution_json, updated_at
    FROM collision_cases
    ORDER BY original_flow_id, case_key
  `).all();
  return results.map((row) => ({
    case_key: row.case_key,
    original_flow_id: row.original_flow_id,
    athlete_ids: JSON.parse(row.athlete_ids_json),
    evidence: JSON.parse(row.evidence_json),
    reasons: JSON.parse(row.reasons_json),
    resolution: row.resolution_json ? JSON.parse(row.resolution_json) : null,
    updated_at: row.updated_at,
  }));
}

async function resolveCollision(env, body) {
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.case_key !== "string") {
    return Response.json({ error: "case_key and action are required" }, { status: 400, headers: NO_STORE });
  }
  const collision = await env.DB.prepare(`
    SELECT case_key, original_flow_id, athlete_ids_json, evidence_json
    FROM collision_cases WHERE case_key = ?
  `).bind(body.case_key).first();
  if (!collision) return Response.json({ error: "collision case not found" }, { status: 404, headers: NO_STORE });

  const athleteIds = JSON.parse(collision.athlete_ids_json);
  const evidence = JSON.parse(collision.evidence_json);
  const now = new Date().toISOString();
  const resolution = { action: body.action, updated_at: now };
  const statements = [];

  if (body.action === "confirm_merge") {
    // The current links already represent the confirmed merge.
  } else if (body.action === "merge") {
    statements.push(env.DB.prepare(`
      UPDATE "athlete-linking" SET flow_id = ?
      WHERE athlete_id IN (${athleteIds.map(() => "?").join(",")})
    `).bind(collision.original_flow_id, ...athleteIds));
  } else if (body.action === "split") {
    if (typeof body.athlete_id !== "string" || !athleteIds.includes(body.athlete_id)) {
      return Response.json({ error: "athlete_id is not part of this collision" }, { status: 400, headers: NO_STORE });
    }
    const targetFlowId = `flow-${body.athlete_id}`;
    resolution.athlete_id = body.athlete_id;
    resolution.flow_id = targetFlowId;
    statements.push(
      env.DB.prepare('UPDATE "athlete-linking" SET flow_id = ? WHERE athlete_id = ?')
        .bind(targetFlowId, body.athlete_id),
      env.DB.prepare(`
        INSERT INTO year_categories (year, flow_id, category)
        SELECT ?, ?, category FROM year_categories WHERE year = ? AND flow_id = ?
        ON CONFLICT(year, flow_id) DO UPDATE SET category = excluded.category
      `).bind(YEAR, targetFlowId, YEAR, collision.original_flow_id),
    );
  } else if (body.action === "select_result") {
    const sources = evidence.athlete_ids.flatMap((athlete) => athlete.sources);
    const selected = sources.find((source) => source.entry_id === body.entry_id && source.import_id != null);
    const sameEventEntries = selected
      ? sources.filter((source) => source.season === selected.season && source.entry_id != null)
      : [];
    if (!selected || sameEventEntries.length < 2) {
      return Response.json({ error: "entry_id is not part of a same-event collision" }, { status: 400, headers: NO_STORE });
    }
    resolution.entry_id = selected.entry_id;
    resolution.import_id = selected.import_id;
    statements.push(env.DB.prepare(`
      INSERT INTO event_result_choices (import_id, flow_id, entry_id, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(import_id, flow_id) DO UPDATE SET
        entry_id = excluded.entry_id,
        updated_at = excluded.updated_at
    `).bind(selected.import_id, collision.original_flow_id, selected.entry_id, now));
  } else {
    return Response.json({ error: "action is invalid" }, { status: 400, headers: NO_STORE });
  }

  statements.push(env.DB.prepare(`
    UPDATE collision_cases SET resolution_json = ?, updated_at = ? WHERE case_key = ?
  `).bind(JSON.stringify(resolution), now, body.case_key));
  if (body.action !== "confirm_merge") statements.push(...totalRebuildStatements(env));
  await env.DB.batch(statements);
  return Response.json({ case_key: body.case_key, resolution }, { headers: NO_STORE });
}

function totalRebuildStatements(env) {
  return [
    env.DB.prepare("DELETE FROM total_standings WHERE year = ?").bind(YEAR),
    env.DB.prepare(`
      WITH event_scores AS (
        SELECT yc.year, yc.flow_id, yc.category, e.event_pk,
          CASE
            WHEN COUNT(er.entry_id) = 1 THEN MAX(er.score_hundredths)
            WHEN MAX(choice.entry_id) IS NOT NULL THEN
              MAX(CASE WHEN er.entry_id = choice.entry_id THEN er.score_hundredths END)
          END AS score_hundredths
        FROM year_categories yc
        JOIN "athlete-linking" al ON al.flow_id = yc.flow_id
        JOIN event_results er ON er.athlete_id = al.athlete_id
        JOIN imports i ON i.import_id = er.import_id
        JOIN events e ON e.event_pk = i.event_pk AND e.current_import_id = i.import_id
        LEFT JOIN event_result_choices choice
          ON choice.import_id = i.import_id AND choice.flow_id = yc.flow_id
        WHERE yc.year = ?
        GROUP BY yc.year, yc.flow_id, yc.category, e.event_pk
      ), ordered_scores AS (
        SELECT year, flow_id, category, event_pk, score_hundredths,
          ROW_NUMBER() OVER (
            PARTITION BY year, flow_id ORDER BY score_hundredths DESC, event_pk
          ) AS score_position,
          COUNT(*) OVER (PARTITION BY year, flow_id) AS event_count
        FROM event_scores
        WHERE score_hundredths IS NOT NULL
      ), scores AS (
        SELECT year, flow_id, category, SUM(score_hundredths) AS score_hundredths
        FROM ordered_scores
        WHERE event_count < 4 OR score_position <= 3
        GROUP BY year, flow_id, category
      ), ranked AS (
        SELECT year, flow_id, category, score_hundredths,
          RANK() OVER (ORDER BY score_hundredths DESC) AS rank
        FROM scores
      )
      INSERT INTO total_standings (year, flow_id, category, score_hundredths, rank)
      SELECT year, flow_id, category, score_hundredths, rank FROM ranked
    `).bind(YEAR),
  ];
}

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

    if (url.pathname === "/xxxadmin") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
      }
      return env.ASSETS.fetch(new Request(new URL("/xxxadmin.html", url), {
        method: request.method,
        headers: request.headers,
      }));
    }

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

    if (url.pathname === "/api/admin/collisions") {
      if (request.method !== "GET" && request.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, POST" } });
      }
      if (url.searchParams.get("year") !== String(YEAR)) {
        return Response.json({ error: "year must be 2026" }, { status: 400, headers: NO_STORE });
      }

      try {
        if (request.method === "GET") {
          return Response.json({ year: YEAR, collisions: await collisionCases(env) }, { headers: NO_STORE });
        }
        let body;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "request body must be JSON" }, { status: 400, headers: NO_STORE });
        }
        return resolveCollision(env, body);
      } catch (error) {
        console.error(JSON.stringify({
          message: "Collision admin request failed",
          error: error instanceof Error ? error.message : String(error),
        }));
        return Response.json({ error: "Unable to process collision" }, { status: 500, headers: NO_STORE });
      }
    }

    if (url.pathname === "/api/admin/multi-registrations") {
      if (request.method !== "GET") {
        return new Response("Method not allowed", { status: 405, headers: { Allow: "GET" } });
      }
      if (url.searchParams.get("year") !== String(YEAR)) {
        return Response.json({ error: "year must be 2026" }, { status: 400, headers: NO_STORE });
      }

      try {
        return Response.json({ year: YEAR, registrations: await multipleRegistrations(env) }, { headers: NO_STORE });
      } catch (error) {
        console.error(JSON.stringify({
          message: "Multi-registration admin request failed",
          error: error instanceof Error ? error.message : String(error),
        }));
        return Response.json({ error: "Unable to load multi-registrations" }, { status: 500, headers: NO_STORE });
      }
    }

    if (url.pathname === "/api/admin/year-categories") {
      if (request.method !== "GET" && request.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, POST" } });
      }
      if (url.searchParams.get("year") !== String(YEAR)) {
        return Response.json({ error: "year must be 2026" }, { status: 400, headers: NO_STORE });
      }

      try {
        const athletes = await multipleCategoryAthletes(env);
        if (request.method === "GET") {
          return Response.json({ year: YEAR, athletes }, { headers: NO_STORE });
        }

        let body;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "request body must be JSON" }, { status: 400, headers: NO_STORE });
        }
        if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.flow_id !== "string") {
          return Response.json({ error: "flow_id and category are required" }, { status: 400, headers: NO_STORE });
        }
        const candidate = athletes.find((athlete) => athlete.flow_id === body.flow_id);
        if (!candidate) {
          return Response.json({ error: "athlete is not currently in the multiple-category list" }, { status: 404, headers: NO_STORE });
        }
        const category = canonicalCategory(body.category);
        if (!category) {
          return Response.json({ error: "category is invalid" }, { status: 400, headers: NO_STORE });
        }

        // shortcut: POC admin writes are unauthenticated; add external access control before general release.
        await env.DB.batch([
          env.DB.prepare(`
            INSERT INTO year_categories (year, flow_id, category) VALUES (?, ?, ?)
            ON CONFLICT(year, flow_id) DO UPDATE SET category = excluded.category
          `).bind(YEAR, candidate.flow_id, category),
          ...totalRebuildStatements(env),
        ]);
        return Response.json({ flow_id: candidate.flow_id, category }, { headers: NO_STORE });
      } catch (error) {
        console.error(JSON.stringify({
          message: "Year category admin request failed",
          error: error instanceof Error ? error.message : String(error),
        }));
        return Response.json({ error: "Unable to process year category change" }, { status: 500, headers: NO_STORE });
      }
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
