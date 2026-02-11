-- Ver todos los triggers en tu tabla
SELECT 
    tgname AS trigger_name,
    tgenabled AS enabled,
    pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid = 'cleansed.validated_bundles'::regclass
  AND tgname NOT LIKE 'pg_%';

-- Ver logs recientes de la base de datos
SELECT * FROM pg_stat_statements 
WHERE query LIKE '%notify_telegram%' 
ORDER BY calls DESC 
LIMIT 10;