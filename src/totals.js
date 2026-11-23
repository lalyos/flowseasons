export function totalRebuildStatements(env, year = 2026) {
  return [
    env.DB.prepare("DELETE FROM total_standings WHERE year = ?").bind(year),
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
    `).bind(year),
  ];
}

