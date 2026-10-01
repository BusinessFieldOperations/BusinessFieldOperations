CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  first_name DEFAULT 'User' TEXT NOT NULL,
  last_name DEFAULT 'Default' TEXT NOT NULL,
  ci TEXT UNIQUE,
  role public.user_role DEFAULT 'promoter' NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);