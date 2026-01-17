import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfiles() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url');
      
      if (!error && data) {
        setProfiles(data);
      }
      setLoading(false);
    }
    
    fetchProfiles();
  }, []);

  const getProfile = (userId: string | null) => {
    if (!userId) return null;
    return profiles.find(p => p.id === userId) || null;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return { profiles, loading, getProfile, getInitials };
}
