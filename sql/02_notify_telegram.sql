CREATE OR REPLACE FUNCTION cleansed.notify_telegram()
RETURNS TRIGGER AS $$
DECLARE
  payload TEXT;
  http_request extensions.http_request;
  http_response extensions.http_response;
  record_id_value TEXT;
  user_email_value TEXT := 'Sistema';
  client_ip_value TEXT := 'N/A';
  
  -- INFORMACIÓN AUTOMÁTICA DE SUPABASE/POSTGRES
  database_name_value TEXT;
  project_ref_value TEXT;
  db_user_value TEXT;
  db_host_value TEXT;
  
BEGIN
  -- Obtener información de la base de datos automáticamente
  BEGIN
    database_name_value := current_database();
    db_user_value := current_user;
    db_host_value := inet_server_addr()::TEXT;
    
    -- Intentar obtener el project reference de Supabase
    BEGIN
      project_ref_value := current_setting('app.settings.project_ref', true);
    EXCEPTION WHEN OTHERS THEN
      -- Si no está disponible, usar parte del host
      project_ref_value := split_part(db_host_value, '.', 1);
    END;
    
  EXCEPTION WHEN OTHERS THEN
    database_name_value := 'unknown';
    project_ref_value := 'unknown';
    db_user_value := 'unknown';
    db_host_value := 'unknown';
  END;

  -- Obtener el ID del registro
  BEGIN
    record_id_value := COALESCE(
      (CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END)::TEXT,
      'N/A'
    );
  EXCEPTION WHEN OTHERS THEN
    record_id_value := 'N/A';
  END;

  -- Intentar obtener email del usuario actual
  BEGIN
    user_email_value := COALESCE(
      current_setting('request.jwt.claims', true)::json->>'email',
      current_setting('request.jwt.claims', true)::json->>'sub',
      current_user
    );
  EXCEPTION WHEN OTHERS THEN
    user_email_value := current_user;
  END;

  -- Intentar obtener IP del cliente
  BEGIN
    client_ip_value := COALESCE(
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      inet_client_addr()::TEXT,
      'N/A'
    );
  EXCEPTION WHEN OTHERS THEN
    client_ip_value := 'N/A';
  END;

  -- Construir payload con TODA la información
  payload := json_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record_id', record_id_value,
    'user_email', user_email_value,
    'client_ip', client_ip_value,
    
    -- INFORMACIÓN DEL PROYECTO/BASE DE DATOS
    'project_ref', project_ref_value,
    'database_name', database_name_value,
    'db_user', db_user_value,
    'db_host', db_host_value,
    
    -- Datos del registro
    'record', CASE 
      WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) 
      ELSE row_to_json(NEW) 
    END,
    'old_record', CASE 
      WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) 
      ELSE NULL 
    END
  )::TEXT;

  -- Configurar request HTTP
  http_request := ROW(
    'POST',
    'https://supabase-notificaciones.vercel.app/api/notify-telegram',
    ARRAY[
      ROW('Content-Type', 'application/json')::extensions.http_header,
      ROW('x-api-secret', 'TU_CLAVE_SECRETA')::extensions.http_header
    ],
    'application/json',
    payload
  )::extensions.http_request;

  -- Ejecutar request
  BEGIN
    SELECT * INTO http_response FROM extensions.http(http_request);
    RAISE NOTICE '✅ Notificación enviada: %', http_response.status;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ Error enviando notificación: %', SQLERRM;
  END;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;