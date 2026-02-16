import { Bell, Volume2, Smartphone, VolumeX } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useHaptic } from '@/hooks/useHaptic';
import { NOTIFICATION_TYPES } from '@/lib/notificationTypes';

const Alerts = () => {
  const { 
    isTypeEnabled, 
    isSoundEnabled, 
    isHapticEnabled,
    toggleTypeEnabled,
    toggleSoundEnabled,
    toggleHapticEnabled,
  } = useNotificationPreferences();
  
  const { settings, updateSettings } = useUserSettings();
  const { isHapticSupported } = useHaptic();

  return (
    <PageContainer width="narrow">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Alert Preferences</h1>
          <p className="text-muted-foreground">Manage your notification and alert settings</p>
        </div>

        {/* Notification Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Types
            </CardTitle>
            <CardDescription>
              Choose which notifications you want to receive and how you want to be alerted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {NOTIFICATION_TYPES.map((typeConfig) => {
              const enabled = isTypeEnabled(typeConfig.type);
              const soundEnabled = isSoundEnabled(typeConfig.type);
              const hapticEnabled = isHapticEnabled(typeConfig.type);
              
              return (
                <div key={typeConfig.type} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{typeConfig.icon}</span>
                      <div>
                        <Label className="font-medium">{typeConfig.label}</Label>
                        <p className="text-xs text-muted-foreground">{typeConfig.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={() => toggleTypeEnabled(typeConfig.type)}
                    />
                  </div>
                  
                  {enabled && (
                    <div className="flex items-center gap-6 pt-2 pl-9">
                      <div className="flex items-center gap-2">
                        {soundEnabled ? (
                          <Volume2 className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <VolumeX className="w-4 h-4 text-muted-foreground" />
                        )}
                        <Label className="text-xs">Sound</Label>
                        <Switch
                          checked={soundEnabled}
                          onCheckedChange={() => toggleSoundEnabled(typeConfig.type)}
                          className="scale-75"
                        />
                      </div>
                      
                      {isHapticSupported && (
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-muted-foreground" />
                          <Label className="text-xs">Vibrate</Label>
                          <Switch
                            checked={hapticEnabled}
                            onCheckedChange={() => toggleHapticEnabled(typeConfig.type)}
                            className="scale-75"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Global Sound & Haptics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Sound & Haptics
            </CardTitle>
            <CardDescription>
              Global settings for sound and haptic feedback across the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-muted-foreground" />
                <div>
                  <Label className="font-medium">Master Sound</Label>
                  <p className="text-xs text-muted-foreground">Enable or disable all notification sounds</p>
                </div>
              </div>
              <Switch
                checked={settings?.sound_enabled ?? true}
                onCheckedChange={(checked) => updateSettings.mutate({ sound_enabled: checked })}
              />
            </div>
            
            {isHapticSupported && (
              <>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <Label className="font-medium">Master Haptics</Label>
                      <p className="text-xs text-muted-foreground">Enable or disable all vibration feedback</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings?.haptic_feedback_enabled ?? true}
                    onCheckedChange={(checked) => updateSettings.mutate({ haptic_feedback_enabled: checked })}
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <Label className="font-medium">Navigation Haptics</Label>
                      <p className="text-xs text-muted-foreground">Vibrate when tapping navigation buttons</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings?.haptic_navigation_enabled ?? true}
                    onCheckedChange={(checked) => updateSettings.mutate({ haptic_navigation_enabled: checked })}
                    disabled={!settings?.haptic_feedback_enabled}
                  />
                </div>
              </>
            )}
            
            {!isHapticSupported && (
              <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                <p>Haptic feedback is not supported on this device.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
};

export default Alerts;
