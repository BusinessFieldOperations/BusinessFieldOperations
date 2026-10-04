import type {Database} from '@/lib/database.types';
import {supabase} from '@/lib/supabase';

export type UserRole = Database['public']['Enums']['user_role'];
export type UserProfile = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'first_name' | 'last_name' | 'role' | 'is_active'
>;

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const {data, error} = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, is_active')
    .eq('id', userId)
    .maybeSingle<UserProfile>();

  if (error) throw error;

  return data;
}
