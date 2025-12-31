import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Building2, Users, UserCircle, ArrowRight, LogOut, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface OnboardingChoiceProps {
  onChooseCreateCompany: () => void;
  onChooseJoinCompany: () => void;
  onChooseContinueAsCustomer: () => void;
}

const OnboardingChoice = ({ 
  onChooseCreateCompany, 
  onChooseJoinCompany, 
  onChooseContinueAsCustomer 
}: OnboardingChoiceProps) => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const options = [
    {
      id: 'create',
      title: 'Create a New Company',
      description: 'Start your own service business. You\'ll be the admin with full control over your company.',
      icon: Building2,
      color: 'from-primary to-primary/80',
      onClick: onChooseCreateCompany,
    },
    {
      id: 'join',
      title: 'Join an Existing Company',
      description: 'Enter a join code from your employer to request access to their company.',
      icon: Users,
      color: 'from-emerald-500 to-emerald-600',
      onClick: onChooseJoinCompany,
    },
    {
      id: 'customer',
      title: 'Continue as Customer',
      description: 'Access the customer portal to view quotes, invoices, and service history.',
      icon: UserCircle,
      color: 'from-amber-500 to-amber-600',
      onClick: onChooseContinueAsCustomer,
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center gradient-primary p-4">
      {user && (
        <div className="absolute top-4 right-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-primary-foreground text-primary text-xs">
                    {getInitials(profile?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-primary-foreground text-sm font-medium hidden sm:inline">
                  {profile?.full_name || profile?.email || 'User'}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="w-4 h-4 mr-2" />
                Edit Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      <div className="w-full max-w-3xl animate-scale-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-primary-foreground">Welcome!</h1>
          <p className="text-primary-foreground/80 mt-2 text-lg">How would you like to get started?</p>
        </div>

        <div className="grid gap-4 md:grid-cols-1">
          {options.map((option) => {
            const Icon = option.icon;
            const isHovered = hoveredOption === option.id;
            
            return (
              <Card 
                key={option.id}
                className={`cursor-pointer transition-all duration-300 hover:shadow-xl border-2 ${
                  isHovered ? 'border-primary scale-[1.02]' : 'border-transparent'
                }`}
                onMouseEnter={() => setHoveredOption(option.id)}
                onMouseLeave={() => setHoveredOption(null)}
                onClick={option.onClick}
              >
                <CardContent className="flex items-center gap-4 p-6">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${option.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-grow">
                    <CardTitle className="text-xl mb-1">{option.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {option.description}
                    </CardDescription>
                  </div>
                  <ArrowRight className={`w-6 h-6 text-muted-foreground transition-transform ${
                    isHovered ? 'translate-x-1 text-primary' : ''
                  }`} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OnboardingChoice;
