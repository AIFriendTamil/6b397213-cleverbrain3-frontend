'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, CurrentUserResponse } from '../services/auth';

export interface AuthContextType {
  user: CurrentUserResponse | null;
  loading: boolean;
  refetchUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refetchUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  fallback?: React.ReactNode;
  fetchUser?: () => Promise<CurrentUserResponse>;
}

/**
 * Protected route guard component that intercepts unauthenticated access attempts
 * and redirects users to the login route.
 */
export function ProtectedRoute({
  children,
  redirectTo = '/login',
  fallback,
  fetchUser = getCurrentUser,
}: ProtectedRouteProps) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUserResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchUserRef = useRef(fetchUser);
  useEffect(() => {
    fetchUserRef.current = fetchUser;
  }, [fetchUser]);

  const verifySession = async () => {
    try {
      setLoading(true);
      const currentUser = await fetchUserRef.current();
      setUser(currentUser);
    } catch {
      setUser(null);
      router.push(redirectTo);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function check() {
      try {
        setLoading(true);
        const currentUser = await fetchUserRef.current();
        if (isMounted) {
          setUser(currentUser);
        }
      } catch {
        if (isMounted) {
          setUser(null);
          router.push(redirectTo);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    check();

    return () => {
      isMounted = false;
    };
  }, [redirectTo, router]);

  if (loading) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <div
        data-testid="protected-route-loading"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '200px',
          padding: '24px',
          fontFamily: 'DM Sans, sans-serif',
          color: '#59452b',
        }}
      >
        <span>Loading session...</span>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, loading, refetchUser: verifySession }}>
      {children}
    </AuthContext.Provider>
  );
}

export default ProtectedRoute;
