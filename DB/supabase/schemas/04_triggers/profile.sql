CREATE OR REPLACE TRIGGER protect_own_profile
BEFORE UPDATE OF role, is_active ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION private.protect_own_profile();
