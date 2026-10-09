import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

type UserRole = "admin" | "teacher" | "system_admin" | null;

interface AuthUser {
  user: User;
  role: UserRole;
  profile: {
    name: string;
    username: string;
    subject: string | null;
    status: string;
  } | null;
}

interface AuthContextType {
  authUser: AuthUser | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);
  const initialLoadDone = useRef(false);

  const fetchUserData = async (user: User): Promise<AuthUser | null> => {
    try {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const { data: profileData } = await supabase
        .from("profiles")
        .select("name, username, subject, status")
        .eq("user_id", user.id)
        .single();

      if (profileData?.status !== "active") {
        await supabase.auth.signOut();
        return null;
      }

      return {
        user,
        role: (roleData?.role as UserRole) ?? null,
        profile: profileData,
      };
    } catch {
      return { user, role: null, profile: null };
    }
  };

  useEffect(() => {
    isMounted.current = true;

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted.current) return;
      if (session?.user) {
        const userData = await fetchUserData(session.user);
        if (isMounted.current) {
          setAuthUser(userData);
        }
      }
      if (isMounted.current) {
        initialLoadDone.current = true;
        setLoading(false);
      }
    });

    // Listen for auth changes (login/logout after initial load)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted.current) return;
        // Skip if initial load hasn't completed yet
        if (!initialLoadDone.current) return;

        if (session?.user) {
          const userData = await fetchUserData(session.user);
          if (isMounted.current) {
            setAuthUser(userData);
          }
        } else {
          if (isMounted.current) {
            setAuthUser(null);
          }
        }
      }
    );

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (username: string, password: string) => {
    const u = username.trim().toLowerCase();
    const email = u.includes("@") ? u : `${u}@nafes.app`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
  };

  return (
    <AuthContext.Provider value={{ authUser, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
