CREATE OR REPLACE TRIGGER set_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION private.set_updated_at();
