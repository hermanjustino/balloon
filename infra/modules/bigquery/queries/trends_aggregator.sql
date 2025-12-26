SELECT
  CASE 
    WHEN COALESCE(JSON_VALUE(data, '$.episodeNumber'), JSON_VALUE(data, '$.episode_number')) IS NOT NULL 
    THEN CONCAT('Ep ', COALESCE(JSON_VALUE(data, '$.episodeNumber'), JSON_VALUE(data, '$.episode_number')), ': ', COALESCE(JSON_VALUE(data, '$.episodeTitle'), JSON_VALUE(data, '$.episode_title')))
    ELSE COALESCE(JSON_VALUE(data, '$.episodeTitle'), JSON_VALUE(data, '$.episode_title'))
  END as name,
  COALESCE(
    CAST(JSON_VALUE(data, '$.matchRate.float') AS FLOAT64), 
    CAST(JSON_VALUE(data, '$.matchRate.integer') AS FLOAT64),
    CAST(JSON_VALUE(data, '$.match_rate') AS FLOAT64)
  ) as rate,
  CAST(COALESCE(JSON_VALUE(data, '$.dateAnalyzed'), JSON_VALUE(data, '$.date_analyzed')) AS TIMESTAMP) as dateAnalyzed
FROM `${project_id}.balloon_dataset.analyses_raw_latest`
ORDER BY dateAnalyzed DESC
LIMIT 20