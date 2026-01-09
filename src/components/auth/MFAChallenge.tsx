import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Shield, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTrustedDevice } from '@/hooks/useTrustedDevice';
import { toast } from 'sonner';

interface MFAChallengeProps {
  onVerified: () => void;
  onCancel?: () => void;
}

const MFAChallenge = ({ onVerified, onCancel }: MFAChallengeProps) => {
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const { user, challengeAndVerifyMFA, signOut } = useAuth();
  const { trustDevice } = useTrustedDevice();

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setIsVerifying(true);
    try {
      const result = await challengeAndVerifyMFA(code);
      if (result.error) {
        toast.error(result.error.message || 'Invalid verification code');
        setCode('');
      } else {
        // If remember device is checked, trust this device
        if (rememberDevice && user?.id) {
          const trusted = await trustDevice(user.id);
          if (trusted) {
            toast.success('Device trusted for 90 days');
          }
        }
        toast.success('Verification successful');
        onVerified();
      }
    } catch (error: any) {
      toast.error(error.message || 'Verification failed');
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCancel = async () => {
    if (onCancel) {
      onCancel();
    } else {
      await signOut();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              onComplete={handleVerify}
              disabled={isVerifying}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember-device"
              checked={rememberDevice}
              onCheckedChange={(checked) => setRememberDevice(checked === true)}
              disabled={isVerifying}
            />
            <Label
              htmlFor="remember-device"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Remember this device for 90 days
            </Label>
          </div>

          <Button 
            onClick={handleVerify} 
            className="w-full" 
            disabled={code.length !== 6 || isVerifying}
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify'
            )}
          </Button>

          <Button
            variant="ghost"
            onClick={handleCancel}
            className="w-full text-muted-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out and try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default MFAChallenge;
