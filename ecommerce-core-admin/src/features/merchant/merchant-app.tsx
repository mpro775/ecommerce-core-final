import { MerchantDashboard } from './merchant-dashboard';
import { MerchantLogin } from './merchant-login';
import { useMerchantSession } from './use-merchant-session';
import { useLocalStorageState } from '../../lib/use-local-storage-state';

export function MerchantApp() {
  const [session, setSession] = useMerchantSession();
  const [themeMode, setThemeMode] = useLocalStorageState('admin.theme.mode.v1', 'light');
  const resolvedThemeMode = themeMode === 'dark' ? 'dark' : 'light';

  if (!session) {
    return <MerchantLogin onLoggedIn={setSession} />;
  }

  return (
    <MerchantDashboard
      session={session}
      onSessionUpdate={setSession}
      themeMode={resolvedThemeMode}
      onToggleThemeMode={() => setThemeMode(resolvedThemeMode === 'dark' ? 'light' : 'dark')}
      onSignedOut={() => setSession(null)}
    />
  );
}
