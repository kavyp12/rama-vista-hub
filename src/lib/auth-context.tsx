import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// API URL Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

type AppRole = 'admin' | 'sales_manager' | 'sales_agent';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  role: AppRole | null;
  login: (token: string, userData: User) => void;
  logout: () => void;
}

interface Permissions {
  isAdmin: boolean;
  isManager: boolean;
  isAgent: boolean;
  canManageTeam: boolean;
  canAssignLeads: boolean;
  canDeleteRecords: boolean;
  canViewAllLeads: boolean;
  canCreateProjects: boolean;
  canManagePayments: boolean;
  canManageMarketing: boolean;
  canViewReports: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('accessToken'));
  const [loading, setLoading] = useState(true);

  const role = user?.role || null;

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('accessToken');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${storedToken}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          setToken(storedToken);
        } else {
          logout();
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
        logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = (newToken: string, userData: User) => {
    localStorage.setItem('accessToken', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    setToken(null);
    setUser(null);
    window.location.href = '/auth';
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      role, 
      login, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ✅ NEW: Permission Helper Hook
export function usePermissions(): Permissions {
  const { user } = useAuth();
  
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'sales_manager';
  const isAgent = user?.role === 'sales_agent';
  
  return {
    isAdmin,
    isManager,
    isAgent,
    
    // Team Management
    canManageTeam: isAdmin || isManager,
    
    // Lead Management
    canAssignLeads: isAdmin || isManager,
    canViewAllLeads: isAdmin || isManager,
    
    // Records Management
    canDeleteRecords: isAdmin,
    
    // Projects & Properties
    canCreateProjects: isAdmin || isManager,
    
    // Financial
    canManagePayments: isAdmin || isManager,
    
    // Marketing
    canManageMarketing: isAdmin || isManager,
    
    // Reports
    canViewReports: isAdmin || isManager,
  };
}