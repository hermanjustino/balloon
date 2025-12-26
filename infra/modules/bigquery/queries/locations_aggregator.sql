SELECT
  COALESCE(JSON_VALUE(data, '$.location.city'), JSON_VALUE(data, '$.city')) as location,
  COUNT(*) as count
FROM `${project_id}.balloon_dataset.contestants_raw_latest`
WHERE COALESCE(JSON_VALUE(data, '$.location.city'), JSON_VALUE(data, '$.city')) IS NOT NULL 
  AND COALESCE(JSON_VALUE(data, '$.location.city'), JSON_VALUE(data, '$.city')) != 'Unknown'
GROUP BY 1
ORDER BY 2 DESC
LIMIT 10