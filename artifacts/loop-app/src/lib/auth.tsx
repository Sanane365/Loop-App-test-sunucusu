import { createContext, useContext, useEffect, ReactNode } from "react";
import { getGetMeQueryKey, useGetMe, User } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, error } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
      staleTime: 30_000,
    },
  });
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (error && !['/login', '/register', '/loops', '/notebook', '/notebook/calismalari', '/settings'].includes(location)) {
      setLocation('/login');
    }
  }, [error, location, setLocation]);

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
