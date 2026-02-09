import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

type UserRole = "admin" | "teacher" | null;

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

  const fetchUserData = async (user: User) => {
    try {
      // Fetch role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      // Fetch profile
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const userData = await fetchUserData(session.user);
          setAuthUser(userData);
        } else {
          setAuthUser(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const userData = await fetchUserData(session.user);
        setAuthUser(userData);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (username: string, password: string) => {
    const email = `${username}@nafes.app`;
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
