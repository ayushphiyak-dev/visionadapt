'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserRole } from './types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const stored = localStorage.getItem('eduwatch_user');
    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored) as User;
    } catch {
      localStorage.removeItem('eduwatch_user');
      return null;
    }
  });

  const login = async (email: string, password: string) => {
    void password;
    // Mock login - in production this would call an API
    const mockUser: User = {
      id: '1',
      email,
      name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      role: 'student',
      createdAt: new Date().toISOString(),
    };
    setUser(mockUser);
    localStorage.setItem('eduwatch_user', JSON.stringify(mockUser));
  };

  const signup = async (email: string, password: string, name: string, role: UserRole) => {
    void password;
    const mockUser: User = {
      id: Date.now().toString(),
      email,
      name,
      role,
      createdAt: new Date().toISOString(),
    };
    setUser(mockUser);
    localStorage.setItem('eduwatch_user', JSON.stringify(mockUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('eduwatch_user');
  };

  const switchRole = (role: UserRole) => {
    if (user) {
      const updated = { ...user, role };
      setUser(updated);
      localStorage.setItem('eduwatch_user', JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        switchRole,
      }}
    >
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
