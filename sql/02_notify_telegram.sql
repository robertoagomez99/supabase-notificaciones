create schema if not exists extensions;
create extension if not exists http with schema extensions;
create or replace function cleansed.notify_telegram()
returns trigger as $$
declare
  payload text;
  http_request extensions.http_request;
  http_response extensions.http_response;
  record_id_value text;
  user_email_value text := 'system';
  client_ip_value text := 'n/a';
  
  -- automatic database and project information
  database_name_value text;
  project_ref_value text;
  db_user_value text;
  db_host_value text;
  
begin
  -- 1. get database information automatically
  begin
    database_name_value := current_database();
    db_user_value := current_user;
    db_host_value := inet_server_addr()::text;
    
    -- attempt to retrieve the supabase project reference
    begin
      project_ref_value := current_setting('app.settings.project_ref', true);
      if project_ref_value is null then
         -- manually set your project ref here if current_setting returns null
         project_ref_value := 'your-project-ref-here'; 
      end if;
    exception when others then
      -- fallback: use the first part of the host if not available
      project_ref_value := split_part(db_host_value, '.', 1);
    end;
    
  exception when others then
    database_name_value := 'unknown';
    project_ref_value := 'unknown';
    db_user_value := 'unknown';
    db_host_value := 'unknown';
  end;

  -- 2. retrieve the record id
  begin
    record_id_value := coalesce(
      (case when tg_op = 'DELETE' then old.id else new.id end)::text,
      'n/a'
    );
  exception when others then
    record_id_value := 'n/a';
  end;

  -- 3. attempt to get the current user's email
  begin
    user_email_value := coalesce(
      current_setting('request.jwt.claims', true)::json->>'email',
      current_setting('request.jwt.claims', true)::json->>'sub',
      current_user
    );
  exception when others then
    user_email_value := current_user;
  end;

  -- 4. attempt to get the client's ip address
  begin
    client_ip_value := coalesce(
      current_setting('request.headers', true)::json->>'x-forwarded-for',
      inet_client_addr()::text,
      'n/a'
    );
  exception when others then
    client_ip_value := 'n/a';
  end;

  -- 5. build the payload with all required information
  payload := json_build_object(
    'type', tg_op,
    'table', tg_table_name,
    'schema', tg_table_schema,
    'record_id', record_id_value,
    'user_email', user_email_value,
    'client_ip', client_ip_value,
    
    -- project and database metadata
    'project_ref', project_ref_value,
    'database_name', database_name_value,
    'db_user', db_user_value,
    'db_host', db_host_value,
    
    -- record data
    'record', case 
      when tg_op = 'DELETE' then row_to_json(old) 
      else row_to_json(new) 
    end,
    'old_record', case 
      when tg_op = 'UPDATE' then row_to_json(old) 
      else null 
    end
  )::text;

  -- 6. configure the http request
  -- remember to update the url and the secret token
  http_request := row(
    'POST',
    'https://supabase-notificaciones.vercel.app/api/notify-telegram',
    array[
      row('Content-Type', 'application/json')::extensions.http_header,
      row('x-api-secret', 'YOUR_SECRET_TOKEN_HERE')::extensions.http_header
    ],
    'application/json',
    payload
  )::extensions.http_request;

  -- 7. execute the http request
  begin
    select * into http_response from extensions.http(http_request);
    raise notice '✅ notification sent: %', http_response.status;
  exception when others then
    raise warning '❌ error sending notification: %', sqlerrm;
  end;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$ language plpgsql security definer;
