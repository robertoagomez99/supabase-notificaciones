CREATE OR REPLACE FUNCTION cleansed.notify_telegram()
RETURNS TRIGGER AS $$
DECLARE
  payload TEXT;
  user_email TEXT;
  client_ip TEXT;
  record_id TEXT;
  http_request extensions.http_request;
  http_response extensions.http_response;
BEGIN
  -- 1. BUSCAR EL EMAIL DEL MIEMBRO DEL EQUIPO (Dashboard)
  -- Intentamos obtenerlo de los claims del JWT de la sesión actual
  user_email := coalesce(
    current_setting('request.jwt.claims', true)::json->>'email',
    auth.jwt()->>'email',
    'Admin (vía SQL Editor / Sistema)'
  );

  -- 2. OBTENER LA IP REAL
  client_ip := coalesce(
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    inet_client_addr()::text,
    'IP Interna'
  );

  -- 3. OBTENER EL ID DEL REGISTRO (Dinámico)
  record_id := coalesce(
    (row_to_json(NEW)->>'id'),
    (row_to_json(OLD)->>'id'),
    'N/A'
  );

  -- 4. CONSTRUIR EL PAYLOAD PARA VERCEL
  payload := json_build_object(
    'type', TG_OP,
    'schema', TG_TABLE_SCHEMA,
    'table', TG_TABLE_NAME,
    'record_id', record_id,
    'user_email', user_email,
    'client_ip', client_ip
  )::TEXT;

  -- 5. ENVÍO A VERCEL
  BEGIN
    http_request := ROW(
      'POST',
      'https://supabase-notificaciones.vercel.app/api/notify-telegram.js',
      ARRAY[ROW('Content-Type', 'application/json')::extensions.http_header],
      'application/json',
      payload
    )::extensions.http_request;

    SELECT * INTO http_response FROM extensions.http(http_request);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error en bot Telegram: %', SQLERRM;
  END;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;