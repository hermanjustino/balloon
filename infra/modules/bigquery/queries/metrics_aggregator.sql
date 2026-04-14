WITH contestant_data AS (
  SELECT
    SAFE_CAST(JSON_VALUE(data, '$.age') AS INT64) as age,
    JSON_VALUE(data, '$.gender') as gender,
    COALESCE(JSON_VALUE(data, '$.episodeId'), JSON_VALUE(data, '$.episode_id')) as episode_id
  FROM `${project_id}.balloon_dataset.contestants_raw_latest`
),
couple_data AS (
  SELECT 1
  FROM `${project_id}.balloon_dataset.couples_raw_latest`
),
contestant_stats AS (
  SELECT 
    COUNT(*) as total_contestants,
    AVG(CAST(age AS FLOAT64)) as avg_age,
    COUNTIF(LOWER(gender) = 'male') as male_count,
    COUNTIF(LOWER(gender) = 'female') as female_count,
    COUNT(DISTINCT REGEXP_REPLACE(episode_id, r'_pt\d+$', '')) as episodes_count
  FROM contestant_data
),
couple_stats AS (
  SELECT COUNT(*) * 2 as matched_contestants
  FROM couple_data
)
SELECT
  COALESCE(cs.episodes_count, 0) as episodesAnalyzed,
  ROUND(SAFE_DIVIDE(COALESCE(cp.matched_contestants, 0), NULLIF(cs.total_contestants, 0)) * 100, 2) as overallMatchRate,
  ROUND(COALESCE(cs.avg_age, 0), 1) as avgAge,
  COALESCE(cs.total_contestants, 0) as totalParticipants,
  ROUND(SAFE_DIVIDE(COALESCE(cs.male_count, 0), NULLIF(cs.male_count + cs.female_count, 0)) * 100, 0) as malePercentage,
  100 - ROUND(SAFE_DIVIDE(COALESCE(cs.male_count, 0), NULLIF(cs.male_count + cs.female_count, 0)) * 100, 0) as femalePercentage,
  CURRENT_TIMESTAMP() as lastUpdated
FROM contestant_stats cs, couple_stats cp