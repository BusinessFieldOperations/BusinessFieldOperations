DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('merchant', 'promoter', 'administrator');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;