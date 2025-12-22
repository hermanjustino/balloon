WITH contestant_stats AS (
  SELECT 
    COUNT(*) as total_contestants,
    AVG(age) as avg_age,
    COUNTIF(LOWER(gender) = 'male') as male_count,
    COUNTIF(LOWER(gender) = 'female') as female_count,
    COUNT(DISTINCT episode_id) as episodes_count
  FROM `${project_id}.balloon_dataset.contestants`
),
couple_stats AS (
  SELECT COUNT(*) * 2 as matched_contestants
  FROM `${project_id}.balloon_dataset.couples`
)
SELECT
  cs.episodes_count as episodesAnalyzed,
  ROUND(SAFE_DIVIDE(cp.matched_contestants, cs.total_contestants) * 100, 2) as overallMatchRate,
  ROUND(cs.avg_age, 1) as avgAge,
  cs.total_contestants as totalParticipants,
  ROUND(SAFE_DIVIDE(cs.male_count, cs.total_contestants) * 100, 0) as malePercentage,
  ROUND(SAFE_DIVIDE(cs.female_count, cs.total_contestants) * 100, 0) as femalePercentage,
  CURRENT_TIMESTAMP() as lastUpdated
FROM contestant_stats cs, couple_stats cp
