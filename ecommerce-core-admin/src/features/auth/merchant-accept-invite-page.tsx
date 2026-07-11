import { Visibility, VisibilityOff } from '../../components/icons';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { requestJson } from '../../lib/http';
import { ADMIN_TOKENS } from '../../theme/tokens';
import { EcommerceCoreLoader } from '../merchant/components/ui';
import { readStoredApiBaseUrl } from '../merchant/session-storage';
import type { AuthResult, InviteValidation, MerchantSession, UserProfile } from '../merchant/types';

interface MerchantAcceptInvitePageProps {
  onAccepted: (session: MerchantSession) => void;
  onBackHome: () => void;
  onSignIn: () => void;
}

type InviteState =
  | { status: 'loading' }
  | { status: 'missing-token' }
  | { status: 'invalid' }
  | { status: 'ready'; invite: InviteValidation }
  | { status: 'error'; message: string };

export function MerchantAcceptInvitePage({
  onAccepted,
  onBackHome,
  onSignIn,
}: MerchantAcceptInvitePageProps) {
  const theme = useTheme();
  const token = useMemo(() => new URLSearchParams(window.location.search).get('token')?.trim() ?? '', []);
  const [inviteState, setInviteState] = useState<InviteState>({ status: 'loading' });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let isActive = true;

    async function validateInvite(): Promise<void> {
      if (!token) {
        setInviteState({ status: 'missing-token' });
        return;
      }

      const apiBaseUrl = readStoredApiBaseUrl();
      if (!apiBaseUrl) {
        setInviteState({ status: 'error', message: 'API base URL is not configured.' });
        return;
      }

      try {
        const result = await requestJson<InviteValidation>(`${apiBaseUrl}/auth/invite/validate`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (!isActive) {
          return;
        }

        if (!result?.valid) {
          setInviteState({ status: 'invalid' });
          return;
        }

        setInviteState({ status: 'ready', invite: result });
      } catch (validateError) {
        if (!isActive) {
          return;
        }
        setInviteState({
          status: 'error',
          message:
            validateError instanceof Error
              ? validateError.message
              : 'Failed to validate invite.',
        });
      }
    }

    validateInvite().catch(() => undefined);
    return () => {
      isActive = false;
    };
  }, [token]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (inviteState.status !== 'ready') {
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    const apiBaseUrl = readStoredApiBaseUrl();
    if (!apiBaseUrl) {
      setError('API base URL is not configured.');
      return;
    }

    setBusy(true);
    setError('');
    setSuccessMessage('');

    try {
      await requestJson<UserProfile>(`${apiBaseUrl}/auth/invite/accept`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const loginResult = await requestJson<AuthResult>(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: inviteState.invite.email,
          password,
        }),
      });

      if (!loginResult) {
        throw new Error('Account created, but automatic sign in failed.');
      }

      onAccepted({
        apiBaseUrl,
        accessToken: loginResult.accessToken,
        refreshToken: loginResult.refreshToken,
        user: loginResult.user,
      });
    } catch (acceptError) {
      const message =
        acceptError instanceof Error ? acceptError.message : 'Failed to accept invitation.';
      if (message.toLowerCase().includes('automatic sign in')) {
        setSuccessMessage('Account created. Please sign in with your email and password.');
        setPassword('');
        setConfirmPassword('');
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      component="section"
      dir="rtl"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        px: { xs: 2, md: 4 },
        background:
          isDark
            ? `linear-gradient(145deg, ${theme.palette.background.default} 0%, ${alpha(theme.palette.common.white, 0.035)} 52%, ${alpha(theme.palette.primary.main, 0.045)} 100%)`
            : `linear-gradient(145deg, #f7f5fb 0%, ${alpha(theme.palette.primary.light, 0.2)} 48%, #e8f6f9 100%)`,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 620, mx: 'auto', py: { xs: 4, md: 8 } }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: ADMIN_TOKENS.radius.hero,
            border: '1px solid',
            borderColor: isDark
              ? alpha(theme.palette.common.white, 0.12)
              : alpha(theme.palette.primary.main, 0.12),
            background: isDark ? ADMIN_TOKENS.surfaces.glassDark : ADMIN_TOKENS.surfaces.glassLight,
            boxShadow: isDark
              ? '0 24px 52px rgba(9, 7, 16, 0.24), inset 0 1px 0 rgba(255,255,255,0.04)'
              : ADMIN_TOKENS.elevation.glass,
            backdropFilter: 'blur(26px)',
          }}
        >
          <Stack spacing={2.5}>
            <Stack spacing={0.8}>
              <Chip
                label="Ecommerce Core Stores"
                color="primary"
                variant="outlined"
                sx={{
                  alignSelf: 'flex-start',
                  bgcolor: isDark
                    ? alpha(theme.palette.common.white, 0.07)
                    : alpha(theme.palette.primary.main, 0.07),
                  fontWeight: 900,
                }}
              />
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                Accept team invitation
              </Typography>
              <Typography color="text.secondary">
                Set your password to join the store team and open the admin dashboard.
              </Typography>
            </Stack>

            {renderInviteState(inviteState, onBackHome, onSignIn)}

            {inviteState.status === 'ready' ? (
              <Box component="form" onSubmit={onSubmit}>
                <Stack spacing={2}>
                  <Alert severity="info">
                    Invited as {inviteState.invite.fullName} ({inviteState.invite.email})
                    {inviteState.invite.storeName ? ` to ${inviteState.invite.storeName}` : ''}.
                  </Alert>

                  {error ? <Alert severity="error">{error}</Alert> : null}
                  {successMessage ? (
                    <Alert
                      severity="success"
                      action={
                        <Button color="inherit" size="small" onClick={onSignIn}>
                          Sign in
                        </Button>
                      }
                    >
                      {successMessage}
                    </Alert>
                  ) : null}

                  <TextField
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    inputProps={{ minLength: 8 }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword((prev) => !prev)} edge="end">
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    label="Confirm password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    inputProps={{ minLength: 8 }}
                  />
                  <Button type="submit" variant="contained" size="large" disabled={busy}>
                    {busy ? 'Accepting invitation...' : 'Accept invitation'}
                  </Button>
                </Stack>
              </Box>
            ) : null}

            <Stack direction="row" spacing={1} justifyContent="space-between">
              <Button variant="text" onClick={onBackHome}>
                Back home
              </Button>
              <Button variant="text" onClick={onSignIn}>
                I already have an account
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}

function renderInviteState(
  inviteState: InviteState,
  onBackHome: () => void,
  onSignIn: () => void,
) {
  if (inviteState.status === 'loading') {
    return (
      <Stack direction="row" spacing={1.5} alignItems="center">
        <EcommerceCoreLoader size="sm" label="" compact />
        <Typography color="text.secondary">Checking invitation...</Typography>
      </Stack>
    );
  }

  if (inviteState.status === 'missing-token') {
    return (
      <Alert severity="error" action={<Button onClick={onBackHome}>Home</Button>}>
        Invitation link is missing a token.
      </Alert>
    );
  }

  if (inviteState.status === 'invalid') {
    return (
      <Alert severity="warning" action={<Button onClick={onSignIn}>Sign in</Button>}>
        This invitation is invalid, expired, or already accepted.
      </Alert>
    );
  }

  if (inviteState.status === 'error') {
    return <Alert severity="error">{inviteState.message}</Alert>;
  }

  return null;
}
