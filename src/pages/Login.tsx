import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, ArrowLeft, CheckCircle, Lock, Mail, History } from 'lucide-react';
import zoproLogo from '@/assets/zopro-logo.png';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import PasswordStrength, { validatePassword } from '@/components/auth/PasswordStrength';
import { getLastVisitedPage, getPageName, clearLastVisitedPage } from '@/hooks/useLastVisitedPage';

type AuthView = 'auth' | 'forgot-password' | 'reset-success' | 'verify-email';

interface LockoutStatus {
  locked: boolean;
  failed_attempts: number;
  lockout_until?: string;
  minutes_remaining?: number;
  attempts_remaining?: number;
}

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<AuthView>('auth');
  const [lockoutStatus, setLockoutStatus] = useState<LockoutStatus | null>(null);
  const { signIn, signUp, signInWithGoogle, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the intended destination from location state, default to /dashboard
  const from = (location.state as { from?: string })?.from || '/dashboard';

  // Check lockout status when email changes
  const checkLockout = useCallback(async (emailToCheck: string) => {
    if (!emailToCheck || !emailToCheck.includes('@')) {
      setLockoutStatus(null);
      return null;
    }
    
    try {
      const { data, error } = await supabase.rpc('check_account_lockout', {
        check_email: emailToCheck.toLowerCase()
      });
      
      if (error) {
        console.error('Error checking lockout:', error);
        return null;
      }
      
      const status = data as unknown as LockoutStatus;
      setLockoutStatus(status);
      return status;
    } catch (err) {
      console.error('Lockout check failed:', err);
      return null;
    }
  }, []);

  // Record login attempt
  const recordAttempt = async (attemptEmail: string, success: boolean) => {
    try {
      await supabase.rpc('record_login_attempt', {
        attempt_email: attemptEmail.toLowerCase(),
        attempt_success: success,
        attempt_ip: null // IP tracking would require server-side implementation
      });
    } catch (err) {
      console.error('Failed to record login attempt:', err);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error.message);
    }
    setIsLoading(false);
  };

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      navigate(from);
    }
  }, [user, authLoading, navigate, from]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Check if account is locked
    const lockout = await checkLockout(email);
    if (lockout?.locked) {
      setError(`Account temporarily locked. Try again in ${lockout.minutes_remaining} minute(s).`);
      setIsLoading(false);
      return;
    }

    const { error } = await signIn(email, password);
    
    if (error) {
      // Record failed attempt
      await recordAttempt(email, false);
      
      // Re-check lockout status after failed attempt
      await checkLockout(email);
      
      // Handle specific error cases
      if (error.message.includes('Email not confirmed')) {
        setView('verify-email');
      } else if (error.message.includes('Invalid login credentials')) {
        const remaining = lockoutStatus?.attempts_remaining ?? 4;
        if (remaining <= 2) {
          setError(`Invalid credentials. ${remaining - 1} attempt(s) remaining before lockout.`);
        } else {
          setError('Invalid email or password');
        }
      } else {
        setError(error.message);
      }
    } else {
      // Record successful attempt
      await recordAttempt(email, true);
      toast.success('Welcome back!');
      
      // Check if there's a last visited page to offer
      const lastPage = getLastVisitedPage();
      if (from === '/dashboard' && lastPage && lastPage !== '/dashboard') {
        // Navigate to dashboard first, then offer to return to last page
        navigate('/dashboard');
        const pageName = getPageName(lastPage);
        toast(
          <div className="flex items-center gap-3">
            <History className="h-4 w-4 text-primary" />
            <span>Continue where you left off?</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigate(lastPage);
                toast.dismiss();
              }}
            >
              Go to {pageName}
            </Button>
          </div>,
          {
            duration: 8000,
            id: 'last-page-toast',
          }
        );
      } else {
        navigate(from);
      }
    }
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.errors[0]);
      setIsLoading(false);
      return;
    }

    // Validate full name
    if (fullName.trim().length < 2) {
      setError('Please enter your full name');
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(email, password, fullName.trim());
    
    if (error) {
      if (error.message.includes('already registered')) {
        setError('This email is already registered. Please sign in instead.');
      } else {
        setError(error.message);
      }
    } else {
      // Show email verification view
      setView('verify-email');
    }
    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email) {
      setError('Please enter your email address');
      setIsLoading(false);
      return;
    }

    const { PRODUCTION_DOMAIN } = await import('@/lib/authConfig');
    const redirectUrl = `${PRODUCTION_DOMAIN}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      setError(error.message);
    } else {
      setView('reset-success');
    }
    setIsLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-primary">
        <div className="text-primary-foreground">Loading...</div>
      </div>
    );
  }

  // Email verification required view
  if (view === 'verify-email') {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-primary p-4">
        <div className="w-full max-w-md animate-scale-in">
          <Card className="shadow-lg border-0">
            <CardHeader className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mx-auto mb-4">
                <Mail className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle>Verify Your Email</CardTitle>
              <CardDescription>
                We've sent a verification link to <strong>{email}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">Next steps:</p>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Check your email inbox (and spam folder)</li>
                  <li>Click the verification link in the email</li>
                  <li>Return here to sign in</li>
                </ol>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setView('auth');
                  setError('');
                }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Sign In
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Didn't receive the email?{' '}
                <Button
                  variant="link"
                  className="px-0 h-auto text-xs"
                  onClick={async () => {
                    const { error } = await supabase.auth.resend({
                      type: 'signup',
                      email: email,
                    });
                    if (error) {
                      toast.error(error.message);
                    } else {
                      toast.success('Verification email resent!');
                    }
                  }}
                >
                  Resend verification email
                </Button>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Password reset success view
  if (view === 'reset-success') {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-primary p-4">
        <div className="w-full max-w-md animate-scale-in">
          <Card className="shadow-lg border-0">
            <CardHeader className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle>Check Your Email</CardTitle>
              <CardDescription>
                We've sent a password reset link to <strong>{email}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Click the link in the email to reset your password. If you don't see it, check your spam folder.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setView('auth');
                  setEmail('');
                }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Forgot password view
  if (view === 'forgot-password') {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-primary p-4">
        <div className="w-full max-w-md animate-scale-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-card mb-4 shadow-lg overflow-hidden">
              <img src={zoproLogo} alt="ZoPro Logo" className="w-16 h-16 object-contain" />
            </div>
            <h1 className="text-3xl font-bold text-primary-foreground">Reset Password</h1>
            <p className="text-primary-foreground/80 mt-2">We'll send you a reset link</p>
          </div>

          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle>Forgot Password</CardTitle>
              <CardDescription>
                Enter your email address and we'll send you a link to reset your password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                <Button type="submit" className="w-full h-11" disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setView('auth');
                    setError('');
                  }}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-primary p-4">
      <div className="w-full max-w-md animate-scale-in">
        {/* Back to main site link */}
        <div className="mb-4">
          <a 
            href="https://zopro.app" 
            className="text-primary-foreground/80 hover:text-primary-foreground text-sm flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to zopro.app
          </a>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-card mb-4 shadow-lg overflow-hidden">
            <img src={zoproLogo} alt="ZoPro Logo" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-primary-foreground">ZoPro</h1>
          <p className="text-primary-foreground/80 mt-2">Field Service Management Platform</p>
        </div>

        <Card className="shadow-lg border-0">
          <Tabs defaultValue="signin" className="w-full">
            <CardHeader className="space-y-1 pb-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <TabsContent value="signin" className="mt-0">
                <CardDescription className="text-center mb-4">
                  Enter your credentials to access your account
                </CardDescription>
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password">Password</Label>
                      <Button
                        type="button"
                        variant="link"
                        className="px-0 h-auto text-sm"
                        onClick={() => {
                          setView('forgot-password');
                          setError('');
                        }}
                      >
                        Forgot password?
                      </Button>
                    </div>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>

                  <Button type="submit" className="w-full h-11" disabled={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        Or continue with
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <CardDescription className="text-center mb-4">
                  Create a new account to get started
                </CardDescription>
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Smith"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Create a strong password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11"
                    />
                    <PasswordStrength password={password} />
                  </div>

                  <Button type="submit" className="w-full h-11" disabled={isLoading}>
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        Or continue with
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* Customer Portal Link */}
        <Card className="mt-4 shadow-lg border-0">
          <CardContent className="py-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">Are you a customer?</p>
            <p className="text-xs text-muted-foreground mb-3">Access your invoices, quotes, and documents</p>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/customer-portal')}
            >
              Customer Portal
            </Button>
          </CardContent>
        </Card>

        {/* Legal Links */}
        <p className="text-xs text-center text-primary-foreground/70 mt-4">
          By signing in, you agree to our{' '}
          <Link to="/terms" className="underline hover:text-primary-foreground">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="underline hover:text-primary-foreground">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
