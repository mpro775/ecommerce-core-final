import {
  AdminPanelSettingsIcon,
  BlockIcon,
  PeopleIcon,
  PersonAddIcon,
  VerifiedUserIcon,
} from '../../../../components/icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import type { MerchantRequester } from '../../merchant-dashboard.types';
import type { StaffInvite, StoreRole, StoreRolePreset, TeamRole, UserProfile } from '../../types';

interface StaffPanelProps {
  request: MerchantRequester;
}

const DEFAULT_TEAM_ROLE: TeamRole = 'manager';

const PERMISSION_LABELS: Record<string, string> = {
  '*': 'وصول كامل',
  'store:read': 'قراءة إعدادات المتجر',
  'store:write': 'تعديل إعدادات المتجر',
  'users:read': 'عرض الفريق',
  'users:write': 'إدارة الفريق',
  'categories:read': 'عرض التصنيفات',
  'categories:write': 'إدارة التصنيفات',
  'brands:read': 'عرض العلامات',
  'brands:write': 'إدارة العلامات',
  'products:read': 'عرض المنتجات',
  'products:write': 'إدارة المنتجات',
  'inventory:read': 'عرض المخزون',
  'inventory:write': 'إدارة المخزون',
  'attributes:read': 'عرض الخصائص',
  'attributes:write': 'إدارة الخصائص',
  'filters:read': 'عرض الفلاتر',
  'filters:write': 'إدارة الفلاتر',
  'media:write': 'رفع الوسائط',
  'orders:read': 'عرض الطلبات',
  'orders:write': 'إدارة الطلبات',
  'customers:read': 'عرض العملاء',
  'customers:write': 'إدارة العملاء والدعم',
  'affiliates:read': 'عرض التسويق بالعمولة',
  'affiliates:write': 'إدارة التسويق بالعمولة',
  'loyalty:read': 'عرض الولاء',
  'loyalty:write': 'إدارة الولاء',
  'loyalty:adjust': 'تعديل نقاط الولاء',
};

const PERMISSION_GROUPS = [
  {
    title: 'المتجر',
    permissions: ['store:read', 'store:write'],
  },
  {
    title: 'فريق العمل',
    permissions: ['users:read', 'users:write'],
  },
  {
    title: 'المنتجات والكتالوج',
    permissions: [
      'products:read',
      'products:write',
      'categories:read',
      'categories:write',
      'brands:read',
      'brands:write',
      'attributes:read',
      'attributes:write',
      'filters:read',
      'filters:write',
      'media:write',
    ],
  },
  {
    title: 'الطلبات والمخزون',
    permissions: ['orders:read', 'orders:write', 'inventory:read', 'inventory:write'],
  },
  {
    title: 'العملاء والدعم',
    permissions: ['customers:read', 'customers:write'],
  },
  {
    title: 'الولاء',
    permissions: ['loyalty:read', 'loyalty:write', 'loyalty:adjust'],
  },
  {
    title: 'التسويق بالعمولة',
    permissions: ['affiliates:read', 'affiliates:write'],
  },
] as const;

export function StaffPanel({ request }: StaffPanelProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invites, setInvites] = useState<StaffInvite[]>([]);
  const [rolePresets, setRolePresets] = useState<StoreRolePreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState({
    text: '',
    type: 'info' as 'info' | 'success' | 'error',
  });

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>(DEFAULT_TEAM_ROLE);
  const [invitePermissions, setInvitePermissions] = useState<string[]>([]);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [editRole, setEditRole] = useState<TeamRole>(DEFAULT_TEAM_ROLE);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);

  const rolePresetByCode = useMemo(
    () => new Map(rolePresets.map((preset) => [preset.code, preset])),
    [rolePresets],
  );

  useEffect(() => {
    loadAll().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const [usersData, invitesData, presetsData] = await Promise.all([
        request<UserProfile[]>('/users', { method: 'GET' }),
        request<StaffInvite[]>('/users/invites', { method: 'GET' }),
        request<StoreRolePreset[]>('/users/role-presets', { method: 'GET' }),
      ]);

      const presets = presetsData ?? [];
      setUsers(usersData ?? []);
      setInvites(invitesData ?? []);
      setRolePresets(presets);

      const firstPreset = presets[0];
      if (firstPreset && invitePermissions.length === 0) {
        setInviteRole(firstPreset.code);
        setInvitePermissions(firstPreset.defaultPermissions);
      }
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'تعذر تحميل بيانات الفريق',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  async function sendInvite(): Promise<void> {
    setMessage({ text: '', type: 'info' });
    if (!inviteEmail || !inviteFullName) {
      setMessage({ text: 'البريد الإلكتروني والاسم الكامل مطلوبان', type: 'error' });
      return;
    }

    setActionLoading(true);
    try {
      const result = await request<StaffInvite>('/users/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail,
          fullName: inviteFullName,
          role: inviteRole,
          permissions: normalizePermissions(invitePermissions),
        }),
      });
      if (result) {
        if (result.inviteToken) {
          setMessage({
            text: `تم إنشاء الدعوة بنجاح. رابط القبول: ${window.location.origin}/accept-invite?token=${result.inviteToken}`,
            type: 'success',
          });
        } else {
          setMessage({ text: `تم إرسال دعوة إلى ${result.email} بنجاح.`, type: 'success' });
        }
      }
      setInviteEmail('');
      setInviteFullName('');
      setInvitePermissions(getPreset(inviteRole)?.defaultPermissions ?? []);
      setShowInviteForm(false);
      await loadAll();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'تعذر إرسال الدعوة', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function updateRole(): Promise<void> {
    if (!selectedUserId) return;

    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request(`/users/${selectedUserId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({
          role: editRole,
          permissions: normalizePermissions(editPermissions),
        }),
      });
      await loadAll();
      setMessage({ text: 'تم تحديث صلاحيات المستخدم بنجاح', type: 'success' });
      setSelectedUserId('');
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'تعذر تحديث دور المستخدم',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function toggleUserStatus(userId: string, currentIsActive: boolean): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request(`/users/${userId}/${currentIsActive ? 'disable' : 'enable'}`, {
        method: 'PATCH',
      });
      await loadAll();
      setMessage({
        text: `تم ${currentIsActive ? 'إيقاف' : 'تفعيل'} المستخدم بنجاح`,
        type: 'success',
      });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'تعذر تغيير حالة المستخدم',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  }

  function selectUser(user: UserProfile): void {
    if (user.role === 'owner') {
      return;
    }
    const role = coerceTeamRole(user.role);
    setSelectedUserId(user.id);
    setEditRole(role);
    setEditPermissions(clampPermissions(role, user.permissions));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleRoleChange(nextRole: TeamRole, mode: 'invite' | 'edit'): void {
    const preset = getPreset(nextRole);
    const nextPermissions = preset?.defaultPermissions ?? [];
    if (mode === 'invite') {
      setInviteRole(nextRole);
      setInvitePermissions(nextPermissions);
      return;
    }

    setEditRole(nextRole);
    setEditPermissions(nextPermissions);
  }

  function togglePermission(permission: string, mode: 'invite' | 'edit'): void {
    const role = mode === 'invite' ? inviteRole : editRole;
    const allowed = new Set(getPreset(role)?.allowedPermissions ?? []);
    if (!allowed.has(permission)) {
      return;
    }

    const updater = (previous: string[]) =>
      previous.includes(permission)
        ? previous.filter((item) => item !== permission)
        : [...previous, permission];

    if (mode === 'invite') {
      setInvitePermissions(updater);
      return;
    }
    setEditPermissions(updater);
  }

  function setPresetPermissions(mode: 'invite' | 'edit', scope: 'default' | 'all' | 'none'): void {
    const role = mode === 'invite' ? inviteRole : editRole;
    const preset = getPreset(role);
    const permissions =
      scope === 'default'
        ? preset?.defaultPermissions ?? []
        : scope === 'all'
          ? preset?.allowedPermissions ?? []
          : [];

    if (mode === 'invite') {
      setInvitePermissions(permissions);
      return;
    }
    setEditPermissions(permissions);
  }

  function getPreset(role: TeamRole): StoreRolePreset | undefined {
    return rolePresetByCode.get(role);
  }

  function clampPermissions(role: TeamRole, permissions: string[]): string[] {
    const allowed = new Set(getPreset(role)?.allowedPermissions ?? []);
    return normalizePermissions(permissions).filter((permission) => allowed.has(permission));
  }

  const activeMode = selectedUserId ? 'edit' : 'invite';
  const activeRole = selectedUserId ? editRole : inviteRole;
  const activePermissions = selectedUserId ? editPermissions : invitePermissions;
  const activePreset = getPreset(activeRole);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }} dir="rtl">
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          mb: 1,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            فريق العمل
          </Typography>
          <Typography color="text.secondary">
            المالك هو منشئ المتجر فقط. أضف أعضاء الفريق بأدوار محددة وصلاحيات داخل سقف كل دور.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" onClick={() => loadAll().catch(() => undefined)} disabled={loading}>
            تحديث القائمة
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<PersonAddIcon />}
            onClick={() => {
              setSelectedUserId('');
              setShowInviteForm(!showInviteForm);
            }}
            size="large"
            sx={{ borderRadius: 2 }}
            disableElevation
          >
            {showInviteForm ? 'إلغاء' : 'دعوة عضو جديد'}
          </Button>
        </Stack>
      </Box>

      <Alert severity="info" sx={{ borderRadius: 2 }}>
        المسوقون بالعمولة ليسوا من فريق العمل ولا يملكون دخولًا للوحة التحكم. أضفهم من قسم
        التسويق بالعمولة.
      </Alert>

      {message.text && (
        <Alert severity={message.type} sx={{ borderRadius: 2 }}>
          {message.text}
        </Alert>
      )}

      {(showInviteForm || selectedUserId) && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3 },
            borderRadius: 2,
            border: '1px solid',
            borderColor: selectedUserId ? 'secondary.main' : 'primary.main',
            bgcolor: 'background.paper',
          }}
        >
          <Stack spacing={3}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              {selectedUserId ? (
                <AdminPanelSettingsIcon color="secondary" />
              ) : (
                <PersonAddIcon color="primary" />
              )}
              <Box>
                <Typography variant="h6" fontWeight={800}>
                  {selectedUserId ? 'تعديل صلاحيات عضو الفريق' : 'دعوة عضو إلى فريق العمل'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  اختر الدور أولًا، ثم خصص الصلاحيات المتاحة ضمن سقفه.
                </Typography>
              </Box>
            </Stack>

            {showInviteForm && !selectedUserId && (
              <Box
                sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}
              >
                <TextField
                  type="email"
                  label="البريد الإلكتروني"
                  fullWidth
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="staff@example.com"
                  inputProps={{ dir: 'ltr' }}
                />
                <TextField
                  label="الاسم الكامل"
                  fullWidth
                  value={inviteFullName}
                  onChange={(event) => setInviteFullName(event.target.value)}
                  placeholder="محمد أحمد"
                />
              </Box>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '320px 1fr' }, gap: 2 }}>
              <TextField
                select
                label="الدور"
                fullWidth
                value={activeRole}
                onChange={(event) =>
                  handleRoleChange(event.target.value as TeamRole, selectedUserId ? 'edit' : 'invite')
                }
                disabled={rolePresets.length === 0}
              >
                {rolePresets.map((preset) => (
                  <MenuItem key={preset.code} value={preset.code}>
                    {preset.label}
                  </MenuItem>
                ))}
              </TextField>

              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.default',
                }}
              >
                <Typography variant="subtitle2" fontWeight={800}>
                  {activePreset?.label ?? 'دور الفريق'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {activePreset?.description ?? 'حمّل الأدوار لاختيار الصلاحيات.'}
                </Typography>
                <Stack direction="row" spacing={1} mt={1} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={`المحدد: ${activePermissions.length}`} />
                  <Chip size="small" label={`السقف: ${activePreset?.allowedPermissions.length ?? 0}`} />
                </Stack>
              </Box>
            </Box>

            <PermissionSelector
              permissions={activePermissions}
              allowedPermissions={activePreset?.allowedPermissions ?? []}
              onToggle={(permission) => togglePermission(permission, activeMode)}
              onUseDefault={() => setPresetPermissions(activeMode, 'default')}
              onSelectAll={() => setPresetPermissions(activeMode, 'all')}
              onClear={() => setPresetPermissions(activeMode, 'none')}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              {selectedUserId ? (
                <>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => updateRole().catch(() => undefined)}
                    disabled={actionLoading || activePermissions.length === 0}
                    disableElevation
                    sx={{ px: 4 }}
                  >
                    حفظ الصلاحيات
                  </Button>
                  <Button variant="outlined" color="inherit" onClick={() => setSelectedUserId('')}>
                    إلغاء التعديل
                  </Button>
                </>
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => sendInvite().catch(() => undefined)}
                  disabled={actionLoading || activePermissions.length === 0}
                  disableElevation
                  sx={{ px: 4 }}
                >
                  إرسال الدعوة
                </Button>
              )}
            </Stack>
          </Stack>
        </Paper>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '3fr 1fr' }, gap: 3 }}>
        <Paper
          elevation={0}
          sx={{
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            height: 'fit-content',
          }}
        >
          <Box
            sx={{
              p: 2,
              bgcolor: 'background.default',
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <PeopleIcon color="action" />
            <Typography variant="subtitle1" fontWeight={800}>
              المستخدمون الحاليون ({users.length})
            </Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>المستخدم</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>الدور والصلاحيات</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>الحالة</TableCell>
                  <TableCell align="left" sx={{ fontWeight: 700 }}>
                    الإجراءات
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                      <CircularProgress size={24} />
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                      <Typography color="text.secondary">لا يوجد مستخدمون.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => {
                    const isOwner = user.role === 'owner';
                    return (
                      <TableRow key={user.id} hover>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight={700}>
                            {user.fullName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {user.email}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ minWidth: 260 }}>
                          <Stack spacing={0.8}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip
                                size="small"
                                label={getRoleLabel(user.role, rolePresetByCode)}
                                color={isOwner ? 'primary' : 'default'}
                                variant={isOwner ? 'filled' : 'outlined'}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {isOwner ? 'وصول كامل' : `${user.permissions.length} صلاحية`}
                              </Typography>
                            </Stack>
                            <PermissionSummary permissions={user.permissions} isOwner={isOwner} />
                          </Stack>
                        </TableCell>
                        <TableCell>
                          {user.isActive !== false ? (
                            <Chip size="small" label="مفعل" color="success" />
                          ) : (
                            <Chip size="small" label="موقوف" color="error" />
                          )}
                        </TableCell>
                        <TableCell align="left">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<AdminPanelSettingsIcon />}
                              onClick={() => selectUser(user)}
                              disabled={actionLoading || isOwner}
                            >
                              صلاحيات
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color={user.isActive !== false ? 'error' : 'success'}
                              startIcon={
                                user.isActive !== false ? <BlockIcon /> : <VerifiedUserIcon />
                              }
                              onClick={() =>
                                toggleUserStatus(user.id, user.isActive !== false).catch(
                                  () => undefined,
                                )
                              }
                              disabled={actionLoading || isOwner}
                            >
                              {user.isActive !== false ? 'إيقاف' : 'تفعيل'}
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            height: 'fit-content',
          }}
        >
          <Box
            sx={{
              p: 2,
              bgcolor: 'background.default',
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <PersonAddIcon color="action" />
            <Typography variant="subtitle1" fontWeight={800}>
              دعوات بانتظار القبول ({invites.length})
            </Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            {invites.length === 0 ? (
              <Typography color="text.secondary" variant="body2" textAlign="center" py={4}>
                لا توجد دعوات معلقة.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {invites.map((invite) => (
                  <Box
                    key={invite.id}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={700}>
                      {invite.fullName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                      {invite.email}
                    </Typography>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Chip size="small" label={getRoleLabel(invite.role, rolePresetByCode)} />
                      <Typography variant="caption" color="error">
                        تنتهي: {new Date(invite.expiresAt).toLocaleDateString('ar-EG')}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

function PermissionSelector({
  permissions,
  allowedPermissions,
  onToggle,
  onUseDefault,
  onSelectAll,
  onClear,
}: {
  permissions: string[];
  allowedPermissions: string[];
  onToggle: (permission: string) => void;
  onUseDefault: () => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const allowed = new Set(allowedPermissions);
  const selected = new Set(permissions);

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        overflow: 'hidden',
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        spacing={1}
        sx={{ p: 1.5, bgcolor: 'background.default' }}
      >
        <Box>
          <Typography variant="subtitle2" fontWeight={800}>
            الصلاحيات
          </Typography>
          <Typography variant="body2" color="text.secondary">
            تظهر هنا الصلاحيات المتاحة لهذا الدور فقط.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button size="small" variant="outlined" onClick={onUseDefault}>
            الافتراضي
          </Button>
          <Button size="small" variant="outlined" onClick={onSelectAll}>
            تحديد السقف
          </Button>
          <Button size="small" variant="text" color="inherit" onClick={onClear}>
            مسح
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ p: 1.5 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
          {PERMISSION_GROUPS.map((group) => {
            const groupPermissions = group.permissions.filter((permission) => allowed.has(permission));
            if (groupPermissions.length === 0) {
              return null;
            }
            return (
              <Box key={group.title}>
                <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.75 }}>
                  {group.title}
                </Typography>
                <Stack spacing={0.25}>
                  {groupPermissions.map((permission) => (
                    <FormControlLabel
                      key={permission}
                      control={
                        <Checkbox
                          size="small"
                          checked={selected.has(permission)}
                          onChange={() => onToggle(permission)}
                        />
                      }
                      label={PERMISSION_LABELS[permission] ?? permission}
                    />
                  ))}
                </Stack>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

function PermissionSummary({
  permissions,
  isOwner,
}: {
  permissions: string[];
  isOwner: boolean;
}) {
  if (isOwner || permissions.includes('*')) {
    return <Chip size="small" label="كل صلاحيات المتجر" color="primary" sx={{ width: 'fit-content' }} />;
  }

  const visible = permissions.slice(0, 4);
  const remaining = permissions.length - visible.length;
  if (permissions.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        لا توجد صلاحيات محددة
      </Typography>
    );
  }

  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      {visible.map((permission) => (
        <Chip
          key={permission}
          size="small"
          label={PERMISSION_LABELS[permission] ?? permission}
          variant="outlined"
        />
      ))}
      {remaining > 0 ? <Chip size="small" label={`+${remaining}`} variant="outlined" /> : null}
    </Stack>
  );
}

function normalizePermissions(input: string[]): string[] {
  return Array.from(
    new Set(input.map((item) => item.trim()).filter((item) => item.length > 0 && item !== '*')),
  );
}

function coerceTeamRole(role: StoreRole): TeamRole {
  return role === 'owner' ? DEFAULT_TEAM_ROLE : role;
}

function getRoleLabel(
  role: StoreRole,
  rolePresetByCode: Map<TeamRole, StoreRolePreset>,
): string {
  if (role === 'owner') {
    return 'المالك';
  }
  return rolePresetByCode.get(role)?.label ?? role;
}
