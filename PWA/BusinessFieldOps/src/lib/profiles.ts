import type {Database} from '@/lib/database.types';
import {supabase} from '@/lib/supabase';
import {db} from '@/lib/offline/db';

export type UserRole = Database['public']['Enums']['user_role'];
export type UserProfile = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'first_name' | 'last_name' | 'role' | 'is_active'
>;

export async function getCachedProfile(
  userId: string,
): Promise<UserProfile | null> {
  const profile = await db.reference('profiles').get(userId);

  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    first_name: profile.first_name,
    last_name: profile.last_name,
    role: profile.role,
    is_active: profile.is_active,
  };
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const {data, error} = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return null;
  }

  try {
    await db.reference('profiles').put(data);
  } catch (cacheError) {
    console.warn('Failed to cache profile:', cacheError);
  }

  return {
    id: data.id,
    first_name: data.first_name,
    last_name: data.last_name,
    role: data.role,
    is_active: data.is_active,
  };
}
