CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users (id) ON DELETE CASCADE PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT 'User',
  last_name TEXT NOT NULL DEFAULT 'Default',
  -- Copy of auth.users.email (auth is not exposed through the API), so
  -- administrators can list it. Filled when the user is created; the app does
  -- not change it afterwards.
  email TEXT,
  ci TEXT UNIQUE,
  role public.user_role DEFAULT 'promoter' NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,

  -- A blank ci must be NULL: '' would count as a duplicate of the next blank one.
  CONSTRAINT profiles_ci_not_blank CHECK (ci IS NULL OR length(btrim(ci)) > 0)
);
