import { supabase } from "@/lib/supabase";

export async function isUserSignedIn(): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return false;
  }

  return Boolean(data.user);
}
