import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle } from 'lucide-react';

export interface EmailInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string;
  onChange: (value: string) => void;
  showValidation?: boolean;
}

// Basic email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  if (!value || value.trim() === '') return true; // Empty is valid (not required)
  return emailRegex.test(value.trim());
}

const EmailInput = React.forwardRef<HTMLInputElement, EmailInputProps>(
  ({ className, value, onChange, showValidation = true, ...props }, ref) => {
    const [touched, setTouched] = React.useState(false);
    
    const isValid = isValidEmail(value);
    const showIcon = touched && value.length > 0;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setTouched(true);
      props.onBlur?.(e);
    };

    return (
      <div className="relative">
        <Input
          ref={ref}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="email@example.com"
          className={cn(
            showIcon && "pr-10",
            showIcon && !isValid && "border-destructive focus-visible:ring-destructive/30",
            showIcon && isValid && "border-success focus-visible:ring-success/30",
            className
          )}
          {...props}
        />
        {showValidation && showIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isValid ? (
              <CheckCircle2 className="w-4 h-4 text-success" />
            ) : (
              <XCircle className="w-4 h-4 text-destructive" />
            )}
          </div>
        )}
      </div>
    );
  }
);

EmailInput.displayName = 'EmailInput';

export { EmailInput };
