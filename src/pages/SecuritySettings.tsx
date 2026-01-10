import PageContainer from '@/components/layout/PageContainer';
import SecuritySettingsContent from '@/components/settings/SecuritySettingsContent';

const SecuritySettings = () => {
  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="shrink-0">
          <h1 className="text-2xl sm:text-3xl font-bold">Security Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Manage your account security and connected accounts
          </p>
        </div>
        <SecuritySettingsContent showAdminControls={false} />
      </div>
    </PageContainer>
  );
};

export default SecuritySettings;
