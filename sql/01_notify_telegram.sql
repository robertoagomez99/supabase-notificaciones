-- 1. Asegurar que la extensión http exista
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- 2. Crear o actualizar la función de notificación
CREATE OR REPLACE FUNCTION cleansed.notify_telegram()
RETURNS TRIGGER AS $$
DECLARE
  payload TEXT;
  http_request extensions.http_request;
  http_response extensions.http_response;
BEGIN
  -- Construimos el JSON con toda la información necesaria
  payload := json_build_object(
    'type', TG_OP,
    'schema', TG_TABLE_SCHEMA,
    'table', TG_TABLE_NAME,
    'record', CASE 
      WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) 
      ELSE row_to_json(NEW) 
    END
  )::TEXT;

  -- Configuramos la petición HTTP hacia tu API en Vercel
  http_request := ROW(
    'POST',
    'https://supabase-notificaciones.vercel.app/api/notify-telegram.js', -- Tu URL
    ARRAY[ROW('Content-Type', 'application/json')::extensions.http_header],
    'application/json',
    payload
  )::extensions.http_request;

  -- Enviamos la notificación de forma segura
  BEGIN
    SELECT * INTO http_response FROM extensions.http(http_request);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'No se pudo enviar la notificación a Telegram: %', SQLERRM;
  END;

  -- Retornar el registro para no bloquear la operación de la BD
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;