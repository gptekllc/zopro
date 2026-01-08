import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Shield, Loader2, CheckCircle2, QrCode } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface MFAEnrollmentProps {
  onComplete: () => void;
  onCancel?: () => void;
}

type EnrollmentStep = 'intro' | 'qr' | 'verify' | 'success';

const MFAEnrollment = ({ onComplete, onCancel }: MFAEnrollmentProps) => {
  const [step, setStep] = useState<EnrollmentStep>('intro');
  const [isLoading, setIsLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string>('');
  const [factorId, setFactorId] = useState<string>('');
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const { enrollMFA, verifyMFAEnrollment } = useAuth();

  const handleStartEnrollment = async () => {
    setIsLoading(true);
    try {
      const result = await enrollMFA();
      if (result.error) {
        toast.error(result.error.message || 'Failed to start enrollment');
        return;
      }
      if (result.data) {
        setQrCode(result.data.totp.qr_code);
        setFactorId(result.data.id);
        setStep('qr');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to start enrollment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setIsVerifying(true);
    try {
      const result = await verifyMFAEnrollment(factorId, code);
      if (result.error) {
        toast.error(result.error.message || 'Invalid verification code');
        setCode('');
      } else {
        setStep('success');
      }
    } catch (error: any) {
      toast.error(error.message || 'Verification failed');
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  if (step === 'intro') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Set Up Two-Factor Authentication</CardTitle>
          <CardDescription>
            Add an extra layer of security to your account using an authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>You'll need an authenticator app like:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Google Authenticator</li>
              <li>Authy</li>
              <li>1Password</li>
              <li>Microsoft Authenticator</li>
            </ul>
          </div>
          <Button onClick={handleStartEnrollment} className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <QrCode className="mr-2 h-4 w-4" />
                Set Up 2FA
              </>
            )}
          </Button>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} className="w-full">
              Cancel
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (step === 'qr') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle>Scan QR Code</CardTitle>
          <CardDescription>
            Scan this QR code with your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center bg-white p-4 rounded-lg">
            <img src={qrCode} alt="QR Code for MFA setup" className="w-48 h-48" />
          </div>

          <Button onClick={() => setStep('verify')} className="w-full">
            Continue
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'verify') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle>Verify Setup</CardTitle>
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
              'Verify and Enable'
            )}
          </Button>

          <Button variant="ghost" onClick={() => setStep('qr')} className="w-full">
            Back to QR code
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
        </div>
        <CardTitle>Two-Factor Authentication Enabled</CardTitle>
        <CardDescription>
          Your account is now protected with an extra layer of security
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onComplete} className="w-full">
          Done
        </Button>
      </CardContent>
    </Card>
  );
};

export default MFAEnrollment;
