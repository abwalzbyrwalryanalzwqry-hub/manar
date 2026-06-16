import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  country: string | null;
  city: string | null;
  preferred_language: string;
  plan: string;
  created_at: string;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isGuest: boolean;
  signInEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpEmail: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signInGoogle: () => Promise<{ error?: string }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  enableGuest: () => void;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<{ error?: string }>;
};

const Ctx = createContext<AuthCtx | null>(null);

const GUEST_KEY = "manar-guest-mode";

function arabicAuthError(msg: string | undefined): string {
  if (!msg) return "حدث خطأ غير متوقع";
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
  if (m.includes("email not confirmed")) return "يرجى تأكيد بريدك الإلكتروني أولاً";
  if (m.includes("user already registered")) return "هذا البريد مسجّل بالفعل";
  if (m.includes("password should be")) return "كلمة المرور قصيرة جداً (٦ أحرف على الأقل)";
  if (m.includes("rate limit")) return "محاولات كثيرة، حاول لاحقاً";
  if (m.includes("network")) return "تحقق من اتصالك بالإنترنت";
  return msg;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem(GUEST_KEY) === "1",
  );

  const loadProfile = async (uid: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (data) setProfile(data as Profile);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        localStorage.removeItem(GUEST_KEY);
        setIsGuest(false);
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadProfile(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInEmail: AuthCtx["signInEmail"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: arabicAuthError(error.message) } : {};
  };

  const signUpEmail: AuthCtx["signUpEmail"] = async (email, password, fullName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/home`,
        data: { full_name: fullName },
      },
    });
    return error ? { error: arabicAuthError(error.message) } : {};
  };

  const signInGoogle: AuthCtx["signInGoogle"] = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/home" });
    if (r.error) return { error: arabicAuthError(r.error.message) };
    return {};
  };

  const resetPassword: AuthCtx["resetPassword"] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return error ? { error: arabicAuthError(error.message) } : {};
  };

  const updatePassword: AuthCtx["updatePassword"] = async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    return error ? { error: arabicAuthError(error.message) } : {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(GUEST_KEY);
    setIsGuest(false);
  };

  const enableGuest = () => {
    localStorage.setItem(GUEST_KEY, "1");
    setIsGuest(true);
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  const updateProfile: AuthCtx["updateProfile"] = async (patch) => {
    if (!user) return { error: "يجب تسجيل الدخول" };
    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    if (error) return { error: arabicAuthError(error.message) };
    await loadProfile(user.id);
    return {};
  };

  return (
    <Ctx.Provider
      value={{
        user, session, profile, loading, isGuest,
        signInEmail, signUpEmail, signInGoogle, resetPassword, updatePassword,
        signOut, enableGuest, refreshProfile, updateProfile,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
