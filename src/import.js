const YEAR = 2026;
const MAX_BIND_PARAMS = 100;
const CATEGORIES = new Map([
  ["hobbi-ferfi", "Hobbi - Férfi"],
  ["hobbi-noi", "Hobbi - Női"],
  ["kezdo-ferfi", "Kezdő - Férfi"],
  ["kezdo-noi", "Kezdő - Női"],
  ["nyilt-ferfi", "Nyílt - Férfi"],
  ["nyilt-noi", "Nyílt - Női"],
  ["senior-ferfi", "Senior - Férfi"],
  ["senior-noi", "Senior - Női"],
]);

export function normalizeCategory(value) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/gu, "");
}

export function canonicalCategory(value) {
  return typeof value === "string" ? CATEGORIES.get(normalizeCategory(value)) ?? null : null;
}

function identifier(value) {
  if (typeof value === "string" && value.length > 0 && value === value.trim()) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  return null;
}

export function scoreToHundredths(value) {
  if (typeof value !== "number" && typeof value !== "string") return 0;
  const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(String(value).trim());
  if (!match) return 0;

  const exponent = Number(match[4] || 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100) return 0;

  const digits = BigInt(`${match[2]}${match[3] || ""}`);
  const decimalShift = 2 - (match[3] || "").length + exponent;
  let cents;

  if (decimalShift >= 0) {
    cents = digits * 10n ** BigInt(decimalShift);
  } else {
    const divisor = 10n ** BigInt(-decimalShift);
    cents = digits / divisor;
    if ((digits % divisor) * 2n >= divisor) cents++;
  }

  if (match[1] === "-") cents = -cents;
  const result = Number(cents);
  return Number.isSafeInteger(result) ? result : 0;
}

function seasonFromEvent(value) {
  if (typeof value !== "string") return null;
  const event = value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/gu, "");
  for (const [suffix, season] of Object.entries({
    tavasz: "Spring", spring: "Spring",
    nyar: "Summer", summer: "Summer",
    osz: "Autumn", autumn: "Autumn",
    tel: "Winter", winter: "Winter",
  })) {
    if (event.endsWith(suffix)) return season;
  }
  return null;
}

export function parseUpload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("JSON root must be an object");
  }

  const eventId = identifier(payload.event_id);
  const id = identifier(payload.id);
  if (!eventId || !id) throw new Error("missing or invalid event_id/id");

  const season = seasonFromEvent(payload.event);
  if (!season) throw new Error("unrecognized event season");

  const status = typeof payload.status === "string" ? payload.status.trim().toLowerCase() : "";
  if (status !== "active" && status !== "finished") throw new Error("unrecognized event status");
  if (!Array.isArray(payload.ranking)) throw new Error("ranking must be an array");

  const rows = payload.ranking.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("ranking entry must be an object");
    }

    const sourceCategories = (Array.isArray(entry.custom_participant_fields) ? entry.custom_participant_fields : [])
      .map((field) => field?.value)
      .filter((value) => typeof value === "string" && CATEGORIES.has(normalizeCategory(value)));
    const distinctCategories = [...new Set(sourceCategories.map(normalizeCategory))];
    if (distinctCategories.length !== 1) throw new Error("missing or ambiguous category in ranking entry");

    const sourceCategory = sourceCategories[0];
    const athleteId = identifier(entry.athlete_id);
    const rank = Number.isSafeInteger(entry.rank) ? entry.rank : null;

    return {
      athlete_id: athleteId,
      name: typeof entry.name === "string" ? entry.name : null,
      firstname: typeof entry.firstname === "string" ? entry.firstname : null,
      lastname: typeof entry.lastname === "string" ? entry.lastname : null,
      rank,
      source_category: sourceCategory,
      category: canonicalCategory(sourceCategory),
      score_hundredths: scoreToHundredths(entry.score),
    };
  });

  return { year: YEAR, event_id: eventId, id, season, status, rows };
}

function stamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function uploadToken(sourceKey, etag) {
  const bytes = new TextEncoder().encode(`${sourceKey}\0${etag}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 12);
}

function identifiersFrom(payload) {
  if (!payload || typeof payload !== "object") return null;
  const eventId = identifier(payload.event_id);
  const id = identifier(payload.id);
  return eventId && id ? { event_id: eventId, id } : null;
}

function archiveKey(ids, timestamp, token) {
  const prefix = ids
    ? `${encodeURIComponent(ids.event_id)}-${encodeURIComponent(ids.id)}`
    : "unidentified";
  return `raw-results/${prefix}-${timestamp}-${token}.json`;
}

async function receipt(env, sourceKey, etag) {
  return env.DB.prepare(
    "SELECT r2_key FROM upload_receipts WHERE source_key = ? AND source_etag = ?",
  ).bind(sourceKey, etag).first();
}

async function saveRejected(env, sourceKey, etag, r2Key, reason) {
  await env.DB.prepare(`
    INSERT INTO upload_receipts (source_key, source_etag, r2_key, status, rejection_reason, processed_at)
    VALUES (?, ?, ?, 'rejected', ?, ?)
  `).bind(sourceKey, etag, r2Key, reason, new Date().toISOString()).run();
}

function chunks(values, size) {
  const result = [];
  for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size));
  return result;
}

async function importAccepted(env, upload, r2Key, sourceKey, etag) {
  const known = await env.DB.prepare(
    "SELECT event_pk FROM imports WHERE event_id = ? AND id = ? LIMIT 1",
  ).bind(upload.event_id, upload.id).first();
  const slot = await env.DB.prepare(
    "SELECT event_pk, current_import_id FROM events WHERE year = ? AND season = ?",
  ).bind(upload.year, upload.season).first();

  if (known && (!slot || known.event_pk !== slot.event_pk)) {
    throw new Error("source result set is already linked to a different event slot");
  }
  if (!known && slot) throw new Error("event season slot is already occupied by another source result set");

  const eventPk = slot?.event_pk ?? (await env.DB.prepare(
    "SELECT COALESCE(MAX(event_pk), 0) + 1 AS next_id FROM events",
  ).first()).next_id;
  const importId = (await env.DB.prepare(
    "SELECT COALESCE(MAX(import_id), 0) + 1 AS next_id FROM imports",
  ).first()).next_id;
  const athleteIds = [...new Set(upload.rows.map((row) => row.athlete_id).filter(Boolean))];
  const existingLinks = athleteIds.length
    ? await env.DB.prepare('SELECT athlete_id, flow_id FROM "athlete-linking"').all()
    : { results: [] };
  const flowByAthlete = new Map((existingLinks.results || []).map((row) => [row.athlete_id, row.flow_id]));
  for (const athleteId of athleteIds) {
    if (!flowByAthlete.has(athleteId)) flowByAthlete.set(athleteId, `flow-${athleteId}`);
  }

  const categoryByFlow = new Map();
  for (const row of upload.rows) {
    if (row.athlete_id) categoryByFlow.set(flowByAthlete.get(row.athlete_id), row.category);
  }

  const statements = [];
  if (!slot) {
    statements.push(env.DB.prepare(
      "INSERT INTO events (event_pk, year, season) VALUES (?, ?, ?)",
    ).bind(eventPk, upload.year, upload.season));
  }
  if (slot?.current_import_id != null) {
    statements.push(env.DB.prepare("DELETE FROM event_results WHERE import_id = ?")
      .bind(slot.current_import_id));
  }
  statements.push(env.DB.prepare(`
    INSERT INTO imports (import_id, event_pk, event_id, id, r2_key, status, accepted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(importId, eventPk, upload.event_id, upload.id, r2Key, upload.status, new Date().toISOString()));

  for (const group of chunks(athleteIds, MAX_BIND_PARAMS / 2)) {
    const placeholders = group.map(() => "(?, ?)").join(",");
    const values = group.flatMap((athleteId) => [athleteId, flowByAthlete.get(athleteId)]);
    statements.push(env.DB.prepare(`
      INSERT OR IGNORE INTO "athlete-linking" (athlete_id, flow_id) VALUES ${placeholders}
    `).bind(...values));
  }

  for (const group of chunks(upload.rows, Math.floor(MAX_BIND_PARAMS / 8))) {
    const placeholders = group.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(",");
    const values = group.flatMap((row) => [importId, row.athlete_id, row.name, row.firstname, row.lastname, row.rank, row.source_category, row.score_hundredths]);
    statements.push(env.DB.prepare(`
      INSERT INTO event_results (import_id, athlete_id, name, firstname, lastname, rank, source_category, score_hundredths)
      VALUES ${placeholders}
    `).bind(...values));
  }

  const categoryRows = [...categoryByFlow.entries()];
  for (const group of chunks(categoryRows, Math.floor(MAX_BIND_PARAMS / 3))) {
    const placeholders = group.map(() => "(?, ?, ?)").join(",");
    const values = group.flatMap(([flowId, category]) => [upload.year, flowId, category]);
    statements.push(env.DB.prepare(`
      INSERT INTO year_categories (year, flow_id, category) VALUES ${placeholders}
      ON CONFLICT (year, flow_id) DO UPDATE SET category = excluded.category
    `).bind(...values));
  }

  statements.push(
    env.DB.prepare("UPDATE events SET current_import_id = ? WHERE event_pk = ?")
      .bind(importId, eventPk),
    env.DB.prepare("DELETE FROM total_standings WHERE year = ?").bind(upload.year),
    env.DB.prepare(`
      WITH scores AS (
        SELECT yc.year, yc.flow_id, yc.category, SUM(er.score_hundredths) AS score_hundredths
        FROM year_categories yc
        JOIN "athlete-linking" al ON al.flow_id = yc.flow_id
        JOIN event_results er ON er.athlete_id = al.athlete_id
        JOIN imports i ON i.import_id = er.import_id
        JOIN events e ON e.event_pk = i.event_pk AND e.current_import_id = i.import_id
        WHERE yc.year = ?
        GROUP BY yc.year, yc.flow_id, yc.category
      ), ranked AS (
        SELECT year, flow_id, category, score_hundredths,
          RANK() OVER (ORDER BY score_hundredths DESC) AS rank
        FROM scores
      )
      INSERT INTO total_standings (year, flow_id, category, score_hundredths, rank)
      SELECT year, flow_id, category, score_hundredths, rank FROM ranked
    `).bind(upload.year),
    env.DB.prepare(`
      INSERT INTO upload_receipts (source_key, source_etag, r2_key, status, processed_at)
      VALUES (?, ?, ?, 'accepted', ?)
    `).bind(sourceKey, etag, r2Key, new Date().toISOString()),
  );

  await env.DB.batch(statements);
}

export async function processR2Notification(event, env) {
  if (
    !event || event.bucket !== "flowseasons" ||
    typeof event.object?.key !== "string" || !event.object.key.startsWith("incoming/") ||
    !event.object.key.endsWith(".json") || typeof event.object.eTag !== "string" || !event.object.eTag
  ) return;

  const sourceKey = event.object.key;
  const etag = event.object.eTag;
  if (await receipt(env, sourceKey, etag)) {
    await env.RAW_RESULTS.delete(sourceKey);
    return;
  }

  const object = await env.RAW_RESULTS.get(sourceKey);
  if (!object) throw new Error(`incoming object not found: ${sourceKey}`);
  const raw = await object.text();
  const token = await uploadToken(sourceKey, etag);
  const eventDate = new Date(event.eventTime || NaN);
  const timestamp = stamp(Number.isNaN(eventDate.getTime()) ? object.uploaded : eventDate);

  let payload;
  let upload;
  let rejectionReason;
  try {
    payload = JSON.parse(raw);
    upload = parseUpload(payload);
  } catch (error) {
    rejectionReason = error instanceof Error ? error.message : String(error);
  }

  const r2Key = archiveKey(identifiersFrom(payload), timestamp, token);
  await env.RAW_RESULTS.put(r2Key, raw, { httpMetadata: { contentType: "application/json" } });

  if (rejectionReason) {
    await saveRejected(env, sourceKey, etag, r2Key, rejectionReason);
  } else {
    try {
      await importAccepted(env, upload, r2Key, sourceKey, etag);
    } catch (error) {
      if (error instanceof Error && /already linked|slot is already occupied/.test(error.message)) {
        await saveRejected(env, sourceKey, etag, r2Key, error.message);
      } else {
        throw error;
      }
    }
  }

  await env.RAW_RESULTS.delete(sourceKey);
}
