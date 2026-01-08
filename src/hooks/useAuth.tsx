import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, Factor } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  company_id: string | null;
  phone: string | null;
  avatar_url: string | null;
  hourly_rate: number;
  role: string;
  employment_status: 'active' | 'on_leave' | 'terminated' | null;
}

interface UserRole {
  role: 'admin' | 'technician' | 'super_admin' | 'manager' | 'customer';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: UserRole[];
  isLoading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isSuperAdmin: boolean;
  // MFA properties
  mfaFactors: Factor[];
  aal: { currentLevel: string; nextLevel: string } | null;
  hasMFA: boolean;
  needsMFAChallenge: boolean;
  // Auth functions
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  // MFA functions
  listMFAFactors: () => Promise<Factor[]>;
  enrollMFA: () => Promise<{ data: any; error: Error | null }>;
  verifyMFAEnrollment: (factorId: string, code: string) => Promise<{ data: any; error: Error | null }>;
  challengeAndVerifyMFA: (code: string) => Promise<{ data: any; error: Error | null }>;
  unenrollMFA: (factorId: string) => Promise<{ data: any; error: Error | null }>;
  refreshMFAStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mfaFactors, setMFAFactors] = useState<Factor[]>([]);
  const [aal, setAAL] = useState<{ currentLevel: string; nextLevel: string } | null>(null);

  const isAdmin = roles.some(r => r.role === 'admin');
  const isManager = roles.some(r => r.role === 'manager');
  const isSuperAdmin = roles.some(r => r.role === 'super_admin');
  const hasMFA = mfaFactors.some(f => f.status === 'verified');
  const needsMFAChallenge = hasMFA && aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2';

  const fetchProfile = async (userId: string) => {
    const { data, error } = await (supabase as any)
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data as Profile | null;
  };

  const fetchRoles = async (userId: string): Promise<UserRole[]> => {
    const { data, error } = await (supabase as any)
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error fetching roles:', error);
      return [];
    }
    return (data || []) as UserRole[];
  };

  const listMFAFactors = async (): Promise<Factor[]> => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      console.error('Error listing MFA factors:', error);
      return [];
    }
    const factors = data?.totp || [];
    setMFAFactors(factors);
    return factors;
  };

  const refreshMFAStatus = async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data) {
      setAAL({
        currentLevel: data.currentLevel,
        nextLevel: data.nextLevel,
      });
    }
    await listMFAFactors();
  };

  const enrollMFA = async () => {
    // First, unenroll any existing unverified factors to avoid conflicts
    const factors = await supabase.auth.mfa.listFactors();
    if (factors.data?.totp) {
      for (const factor of factors.data.totp) {
        if (factor.status !== 'verified') {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }
    }
    
    const result = await supabase.auth.mfa.enroll({ 
      factorType: 'totp',
      friendlyName: 'Authenticator App'
    });
    return result;
  };

  const verifyMFAEnrollment = async (factorId: string, code: string) => {
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      return { data: null, error: challenge.error };
    }
    
    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code,
    });
    
    if (!verify.error) {
      await refreshMFAStatus();
    }
    
    return verify;
  };

  const challengeAndVerifyMFA = async (code: string) => {
    const factors = await supabase.auth.mfa.listFactors();
    const totpFactor = factors.data?.totp?.find(f => f.status === 'verified');
    
    if (!totpFactor) {
      return { data: null, error: new Error('No verified TOTP factor found') };
    }
    
    const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
    if (challenge.error) {
      return { data: null, error: challenge.error };
    }
    
    const verify = await supabase.auth.mfa.verify({
      factorId: totpFactor.id,
      challengeId: challenge.data.id,
      code,
    });
    
    if (!verify.error) {
      await refreshMFAStatus();
    }
    
    return verify;
  };

  const unenrollMFA = async (factorId: string) => {
    const result = await supabase.auth.mfa.unenroll({ factorId });
    if (!result.error) {
      await refreshMFAStatus();
    }
    return result;
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer Supabase calls with setTimeout
        if (session?.user) {
          setTimeout(async () => {
            const profileData = await fetchProfile(session.user.id);
            setProfile(profileData);
            const rolesData = await fetchRoles(session.user.id);
            setRoles(rolesData);
            // Fetch MFA status
            await refreshMFAStatus();
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setMFAFactors([]);
          setAAL(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const profileData = await fetchProfile(session.user.id);
        setProfile(profileData);
        const rolesData = await fetchRoles(session.user.id);
        setRoles(rolesData);
        // Fetch MFA status
        await refreshMFAStatus();
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      return { error };
    }
    
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { PRODUCTION_DOMAIN } = await import('@/lib/authConfig');
    const redirectUrl = `${PRODUCTION_DOMAIN}/dashboard`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    
    if (error) {
      return { error };
    }
    
    return { error: null };
  };

  const signInWithGoogle = async () => {
    const { PRODUCTION_DOMAIN } = await import('@/lib/authConfig');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${PRODUCTION_DOMAIN}/dashboard`,
      },
    });
    
    if (error) {
      return { error };
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setMFAFactors([]);
    setAAL(null);
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
      const rolesData = await fetchRoles(user.id);
      setRoles(rolesData);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        isLoading,
        isAdmin,
        isManager,
        isSuperAdmin,
        mfaFactors,
        aal,
        hasMFA,
        needsMFAChallenge,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        refreshProfile,
        listMFAFactors,
        enrollMFA,
        verifyMFAEnrollment,
        challengeAndVerifyMFA,
        unenrollMFA,
        refreshMFAStatus,
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
