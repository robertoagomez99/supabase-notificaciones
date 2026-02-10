CREATE OR REPLACE FUNCTION cleansed.notify_telegram()
RETURNS TRIGGER AS $$
DECLARE
  payload TEXT;
  user_email TEXT;
  client_ip TEXT;
  record_id TEXT;
  pk_column TEXT;
  secret_token TEXT := ''; -- USA LA MISMA QUE EN VERCEL
  http_request extensions.http_request;
  http_response extensions.http_response;
BEGIN
  -- 1. IDENTIFICAR LLAVE PRIMARIA
  SELECT a.attname INTO pk_column
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
  WHERE i.indrelid = TG_RELID AND i.indisprimary LIMIT 1;

  record_id := CASE 
    WHEN pk_column IS NOT NULL THEN (row_to_json(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END)->>pk_column)
    ELSE 'N/A'
  END;

  -- 2. BUSCAR EL EMAIL (Mejorado para Dashboard)
  -- Intentamos obtener el email. Si sale vacío, ponemos 'Admin/Dashboard'
  user_email := coalesce(
    nullif(current_setting('request.jwt.claims', true)::json->>'email', ''),
    nullif(auth.jwt()->>'email', ''),
    'Admin/Dashboard'
  );

  -- 3. OBTENER IP
  client_ip := coalesce(
    nullif(current_setting('request.headers', true)::json->>'x-forwarded-for', ''),
    inet_client_addr()::text,
    'Interna'
  );

  -- 4. PAYLOAD
  payload := json_build_object(
    'type', TG_OP,
    'schema', TG_TABLE_SCHEMA,
    'table', TG_TABLE_NAME,
    'record_id', record_id,
    'user_email', user_email,
    'client_ip', client_ip
  )::TEXT;

  -- 5. ENVÍO CON CABECERA DE SEGURIDAD
  BEGIN
    http_request := ROW(
      'POST',
      'https://supabase-notificaciones.vercel.app/api/notify-telegram.js',
      ARRAY[
        ROW('Content-Type', 'application/json')::extensions.http_header,
        ROW('x-api-secret', secret_token)::extensions.http_header -- EL TOKEN DE SEGURIDAD
      ],
      'application/json',
      payload
    )::extensions.http_request;

    SELECT * INTO http_response FROM extensions.http(http_request);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error: %', SQLERRM;
  END;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;