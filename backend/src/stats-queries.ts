import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.PROJECT_ID || 'balloon-87473';
const DS = `\`${PROJECT_ID}.balloon_dataset\``;
const bigquery = new BigQuery({ projectId: PROJECT_ID });

async function q(sql: string): Promise<any[]> {
    const [rows] = await bigquery.query({ query: sql });
    return rows;
}

// ---------------------------------------------------------------------------
// Outcome Breakdown
// Returns counts per role × outcome. Filters out the "Host" noise record.
// ---------------------------------------------------------------------------
export async function getOutcomes() {
    return q(`
        SELECT
            JSON_VALUE(data, '$.role')    AS role,
            JSON_VALUE(data, '$.outcome') AS outcome,
            COUNT(*)                      AS count
        FROM ${DS}.contestants_raw_latest
        WHERE JSON_VALUE(data, '$.role')    IN ('Lineup', 'Contestant')
          AND JSON_VALUE(data, '$.outcome') NOT IN ('Host', 'No Match')
          AND JSON_VALUE(data, '$.outcome') IS NOT NULL
        GROUP BY role, outcome
        ORDER BY role, count DESC
    `);
}

// ---------------------------------------------------------------------------
// Kids Stats
// Filters corrupt count values (e.g. Gemini hallucination ≥ 1e20).
// ---------------------------------------------------------------------------
export async function getKidsStats() {
    const rows = await q(`
        SELECT
            COUNTIF(
                JSON_VALUE(data, '$.kids.hasKids') = 'true'
            ) AS has_kids_count,
            COUNT(*) AS total_with_data,
            ROUND(AVG(
                CASE
                    WHEN JSON_VALUE(data, '$.kids.hasKids') = 'true'
                     AND SAFE_CAST(JSON_VALUE(data, '$.kids.count') AS FLOAT64) < 20
                    THEN SAFE_CAST(JSON_VALUE(data, '$.kids.count') AS FLOAT64)
                    ELSE NULL
                END
            ), 1) AS avg_kid_count
        FROM ${DS}.contestants_raw_latest
        WHERE JSON_QUERY(data, '$.kids') IS NOT NULL
    `);
    const r = rows[0];
    return {
        totalWithData: Number(r.total_with_data),
        hasKidsCount: Number(r.has_kids_count),
        pctWithKids: r.total_with_data > 0
            ? Math.round((Number(r.has_kids_count) / Number(r.total_with_data)) * 100)
            : 0,
        avgKidCount: r.avg_kid_count != null ? Number(r.avg_kid_count) : null,
    };
}

// ---------------------------------------------------------------------------
// Religion Breakdown
// Groups religion values, collapses rare entries (<3 occurrences) into Other.
// ---------------------------------------------------------------------------
export async function getReligionBreakdown() {
    return q(`
        SELECT
            JSON_VALUE(data, '$.religion') AS religion,
            COUNT(*)                       AS count
        FROM ${DS}.contestants_raw_latest
        WHERE JSON_VALUE(data, '$.religion') IS NOT NULL
          AND JSON_VALUE(data, '$.religion') NOT IN ('null', '', 'Unknown', 'N/A', 'None')
        GROUP BY religion
        HAVING count >= 3
        ORDER BY count DESC
        LIMIT 12
    `);
}

// ---------------------------------------------------------------------------
// Age Gaps in Matched Couples
// Joins couples → contestants twice to compute the gap between partners.
// ---------------------------------------------------------------------------
export async function getAgeGaps() {
    return q(`
        WITH couples AS (
            SELECT
                JSON_VALUE(data, '$.contestant1Id') AS c1_id,
                JSON_VALUE(data, '$.contestant2Id') AS c2_id
            FROM ${DS}.couples_raw_latest
            WHERE JSON_VALUE(data, '$.contestant1Id') IS NOT NULL
              AND JSON_VALUE(data, '$.contestant2Id') IS NOT NULL
        ),
        ages AS (
            SELECT
                document_id,
                SAFE_CAST(JSON_VALUE(data, '$.age') AS INT64) AS age
            FROM ${DS}.contestants_raw_latest
            WHERE SAFE_CAST(JSON_VALUE(data, '$.age') AS INT64) BETWEEN 18 AND 80
        )
        SELECT
            CASE
                WHEN ABS(c1.age - c2.age) <= 2  THEN '0-2 yrs'
                WHEN ABS(c1.age - c2.age) <= 5  THEN '3-5 yrs'
                WHEN ABS(c1.age - c2.age) <= 10 THEN '6-10 yrs'
                ELSE '10+ yrs'
            END AS age_range,
            COUNT(*) AS count,
            CASE
                WHEN ABS(c1.age - c2.age) <= 2  THEN 1
                WHEN ABS(c1.age - c2.age) <= 5  THEN 2
                WHEN ABS(c1.age - c2.age) <= 10 THEN 3
                ELSE 4
            END AS sort_order
        FROM couples cp
        JOIN ages c1 ON cp.c1_id = c1.document_id
        JOIN ages c2 ON cp.c2_id = c2.document_id
        GROUP BY age_range, sort_order
        ORDER BY sort_order
    `);
}

// ---------------------------------------------------------------------------
// Geographic Match Patterns
// Cross-references state of both partners in every matched couple.
// ---------------------------------------------------------------------------
export async function getGeoMatches() {
    const rows = await q(`
        WITH couples AS (
            SELECT
                JSON_VALUE(data, '$.contestant1Id') AS c1_id,
                JSON_VALUE(data, '$.contestant2Id') AS c2_id
            FROM ${DS}.couples_raw_latest
            WHERE JSON_VALUE(data, '$.contestant1Id') IS NOT NULL
              AND JSON_VALUE(data, '$.contestant2Id') IS NOT NULL
        ),
        states AS (
            SELECT
                document_id,
                NULLIF(TRIM(COALESCE(
                    JSON_VALUE(data, '$.location.state'), ''
                )), '') AS state
            FROM ${DS}.contestants_raw_latest
        )
        SELECT
            COUNTIF(
                c1.state IS NOT NULL
                AND c2.state IS NOT NULL
                AND c1.state NOT IN ('Unknown', 'N/A')
                AND c2.state NOT IN ('Unknown', 'N/A')
                AND c1.state = c2.state
            ) AS same_state,
            COUNTIF(
                c1.state IS NOT NULL
                AND c2.state IS NOT NULL
                AND c1.state NOT IN ('Unknown', 'N/A')
                AND c2.state NOT IN ('Unknown', 'N/A')
                AND c1.state != c2.state
            ) AS diff_state,
            COUNTIF(
                c1.state IS NULL OR c2.state IS NULL
                OR c1.state IN ('Unknown', 'N/A')
                OR c2.state IN ('Unknown', 'N/A')
            ) AS unknown_state,
            COUNT(*) AS total
        FROM couples cp
        JOIN states c1 ON cp.c1_id = c1.document_id
        JOIN states c2 ON cp.c2_id = c2.document_id
    `);
    const r = rows[0];
    const known = Number(r.same_state) + Number(r.diff_state);
    return {
        sameState: Number(r.same_state),
        diffState: Number(r.diff_state),
        unknownState: Number(r.unknown_state),
        total: Number(r.total),
        pctSameState: known > 0 ? Math.round((Number(r.same_state) / known) * 100) : 0,
    };
}

// ---------------------------------------------------------------------------
// Best Episodes
// Ranked by matchRate DESC. dramaScore populated only for enriched episodes.
// ---------------------------------------------------------------------------
export async function getBestEpisodes() {
    return q(`
        SELECT
            COALESCE(
                JSON_VALUE(data, '$.episodeNumber'),
                JSON_VALUE(data, '$.episode_number')
            ) AS episode_number,
            COALESCE(
                JSON_VALUE(data, '$.episodeTitle'),
                JSON_VALUE(data, '$.episode_title')
            ) AS episode_title,
            ROUND(SAFE_CAST(COALESCE(
                JSON_VALUE(data, '$.matchRate.float'),
                JSON_VALUE(data, '$.matchRate.integer'),
                JSON_VALUE(data, '$.matchRate'),
                JSON_VALUE(data, '$.match_rate')
            ) AS FLOAT64), 1) AS match_rate,
            SAFE_CAST(JSON_VALUE(data, '$.dramaScore') AS FLOAT64) AS drama_score,
            COALESCE(
                JSON_VALUE(data, '$.videoUrl'),
                JSON_VALUE(data, '$.video_url')
            ) AS video_url
        FROM ${DS}.analyses_raw_latest
        WHERE COALESCE(
            JSON_VALUE(data, '$.episodeNumber'),
            JSON_VALUE(data, '$.episode_number')
        ) IS NOT NULL
        ORDER BY match_rate DESC NULLS LAST
        LIMIT 20
    `);
}

// ---------------------------------------------------------------------------
// Industry Distribution  (Phase 2 — requires backfill)
// ---------------------------------------------------------------------------
export async function getIndustries() {
    return q(`
        WITH base AS (
            SELECT
                JSON_VALUE(data, '$.industry') AS industry,
                JSON_VALUE(data, '$.outcome')  AS outcome
            FROM ${DS}.contestants_raw_latest
            WHERE JSON_VALUE(data, '$.industry') IS NOT NULL
              AND JSON_VALUE(data, '$.industry') NOT IN ('null', '', 'Unknown')
              AND JSON_VALUE(data, '$.role') IN ('Lineup', 'Contestant')
        )
        SELECT
            industry,
            COUNT(*)                               AS total,
            COUNTIF(outcome = 'Matched')           AS matched,
            ROUND(SAFE_DIVIDE(
                COUNTIF(outcome = 'Matched') * 100.0,
                COUNT(*)
            ), 1)                                  AS match_rate
        FROM base
        GROUP BY industry
        HAVING total >= 3
        ORDER BY total DESC
        LIMIT 12
    `);
}

// ---------------------------------------------------------------------------
// Dealbreakers  (Phase 2 — requires backfill)
// ---------------------------------------------------------------------------
export async function getDealbreakers() {
    return q(`
        SELECT
            COALESCE(
                JSON_VALUE(data, '$.popCategory'), 'Other'
            )                                  AS category,
            JSON_VALUE(data, '$.popReason')    AS reason,
            COUNT(*)                           AS count
        FROM ${DS}.contestants_raw_latest
        WHERE JSON_VALUE(data, '$.outcome') = 'Popped'
          AND JSON_VALUE(data, '$.popReason') IS NOT NULL
          AND JSON_VALUE(data, '$.popReason') NOT IN ('null', '', 'Unknown')
        GROUP BY category, reason
        ORDER BY count DESC
        LIMIT 20
    `);
}

// ---------------------------------------------------------------------------
// Drama Scores  (Phase 2 — requires backfill)
// ---------------------------------------------------------------------------
export async function getDramaScores() {
    return q(`
        SELECT
            COALESCE(
                JSON_VALUE(data, '$.episodeNumber'),
                JSON_VALUE(data, '$.episode_number')
            ) AS episode_number,
            COALESCE(
                JSON_VALUE(data, '$.episodeTitle'),
                JSON_VALUE(data, '$.episode_title')
            ) AS episode_title,
            SAFE_CAST(JSON_VALUE(data, '$.dramaScore') AS FLOAT64)     AS drama_score,
            JSON_VALUE(data, '$.memorableMoment')                       AS memorable_moment
        FROM ${DS}.analyses_raw_latest
        WHERE JSON_VALUE(data, '$.dramaScore') IS NOT NULL
        ORDER BY drama_score DESC
        LIMIT 20
    `);
}

// ---------------------------------------------------------------------------
// Age Match Rates
// ---------------------------------------------------------------------------
export async function getAgeMatchRate() {
    return q(`
        SELECT
            SAFE_CAST(JSON_VALUE(data, '$.age') AS INT64) AS age,
            COUNT(*) AS total,
            COUNTIF(JSON_VALUE(data, '$.outcome') = 'Matched') AS matched,
            ROUND(SAFE_DIVIDE(
                COUNTIF(JSON_VALUE(data, '$.outcome') = 'Matched') * 100.0,
                COUNT(*)
            ), 1) AS match_rate
        FROM ${DS}.contestants_raw_latest
        WHERE SAFE_CAST(JSON_VALUE(data, '$.age') AS INT64) BETWEEN 18 AND 65
          AND JSON_VALUE(data, '$.role') IN ('Lineup', 'Contestant')
          AND JSON_VALUE(data, '$.outcome') IS NOT NULL
          AND JSON_VALUE(data, '$.outcome') NOT IN ('Host', 'No Match')
        GROUP BY age
        HAVING total >= 3
        ORDER BY age
    `);
}
