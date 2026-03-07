import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

export function useProfiles() {
  const { token } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfiles() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setProfiles(data.map((u: any) => ({
            id: u.id,
            full_name: u.fullName,
            email: u.email,
            avatar_url: u.avatarUrl
          })));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchProfiles();
  }, [token]);

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
