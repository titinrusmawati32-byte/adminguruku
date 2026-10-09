import { User as FirebaseUser } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '../services/authService';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  role: UserRole;
  isAdmin: boolean;
  isGuru: boolean;
  loading: boolean;
  loginWithUsername: (u: string, p: string) => Promise<UserProfile>;
  loginWithGoogle: () => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    return authService.getCurrentLocalSession();
  });
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (uid: string) => {
    try {
      const p = await authService.getUserProfile(uid);
      if (p) setProfile(p);
    } catch (err) {
      console.warn('Error fetching user profile:', err);
    }
  };

  useEffect(() => {
    let resolved = false;

    // Safety timeout: ensure loading screen NEVER hangs beyond 600ms!
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setLoading(false);
      }
    }, 600);

    const unsubscribe = authService.onAuthState(async (user) => {
      resolved = true;
      clearTimeout(timer);
      setFirebaseUser(user);

      if (user) {
        try {
          await fetchProfile(user.uid);
        } catch {}
      } else {
        // If no firebase user, check if we have local session
        const local = authService.getCurrentLocalSession();
        if (local) {
          setProfile(local);
        } else {
          setProfile(null);
        }
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const loginWithUsername = async (u: string, p: string) => {
    setLoading(true);
    try {
      const prof = await authService.loginWithUsername(u, p);
      setProfile(prof);
      return prof;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const prof = await authService.loginWithGoogle();
      setProfile(prof);
      return prof;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
      setProfile(null);
      setFirebaseUser(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (firebaseUser) {
      await fetchProfile(firebaseUser.uid);
    } else if (profile?.uid) {
      await fetchProfile(profile.uid);
    }
  };

  const role: UserRole = profile?.role || 'guru';
  const isAdmin = role === 'admin';
  const isGuru = role === 'guru';

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        role,
        isAdmin,
        isGuru,
        loading,
        loginWithUsername,
        loginWithGoogle,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
