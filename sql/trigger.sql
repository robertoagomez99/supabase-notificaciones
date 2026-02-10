DO $$ 
DECLARE 
    _schema TEXT;
    _table RECORD;
    -- DEFINICIÓN DE TUS ESQUEMAS
    target_schemas TEXT[] := ARRAY['operational', 'raw_voice', 'raw_vision', 'artifacts', 'reporting']; 
BEGIN
    -- Iterar por cada esquema de la lista
    FOREACH _schema IN ARRAY target_schemas
    LOOP
        -- Buscar todas las tablas del esquema actual
        FOR _table IN (
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = _schema 
            AND table_type = 'BASE TABLE'
        ) LOOP
            
            -- 1. Eliminar el trigger si ya existe para evitar duplicados
            EXECUTE format('DROP TRIGGER IF EXISTS notify_telegram_trigger ON %I.%I', 
                           _schema, _table.table_name);

            -- 2. Crear el nuevo trigger vinculado a tu función
            EXECUTE format('CREATE TRIGGER notify_telegram_trigger
                            AFTER INSERT OR UPDATE OR DELETE
                            ON %I.%I
                            FOR EACH ROW
                            EXECUTE FUNCTION cleansed.notify_telegram();', 
                           _schema, _table.table_name);
                           
            RAISE NOTICE '✅ Trigger configurado en: %.%', _schema, _table.table_name;
        END LOOP;
    END LOOP;
END $$;