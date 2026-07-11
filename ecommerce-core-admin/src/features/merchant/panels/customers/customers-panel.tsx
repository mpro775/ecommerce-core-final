import { ArrowForwardIcon, PersonAddIcon, VisibilityIcon } from '../../../../components/icons';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
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
import type {
  CustomerGender,
  LoyaltyWallet,
  ManagedCustomerDetails,
  ManagedCustomersListResponse,
} from '../../types';
import { AppPage, DataTableWrapper, FilterBar, PageHeader } from '../../components/ui';

interface CustomersPanelProps {
  request: MerchantRequester;
}

interface CustomerFormState {
  fullName: string;
  phone: string;
  email: string;
  gender: '' | 'male' | 'female';
  country: string;
  city: string;
  birthDate: string;
}

const DEFAULT_FORM: CustomerFormState = {
  fullName: '',
  phone: '',
  email: '',
  gender: '',
  country: 'اليمن',
  city: '',
  birthDate: '',
};

export function CustomersPanel({ request }: CustomersPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' }>({
    text: '',
    type: 'info',
  });
  const [list, setList] = useState<ManagedCustomersListResponse>({
    items: [],
    total: 0,
    page: 1,
    limit: 30,
  });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CustomerFormState>(DEFAULT_FORM);
  const [actionLoading, setActionLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<ManagedCustomerDetails | null>(null);
  const [selectedCustomerWallet, setSelectedCustomerWallet] = useState<LoyaltyWallet | null>(null);
  const [editForm, setEditForm] = useState<CustomerFormState>(DEFAULT_FORM);

  useEffect(() => {
    loadCustomers().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCustomerId = selectedCustomer?.customer.id ?? null;

  const hasDetails = useMemo(() => Boolean(selectedCustomerId), [selectedCustomerId]);

  async function loadCustomers(): Promise<void> {
    setLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', '30');
      if (searchQuery.trim()) {
        params.set('q', searchQuery.trim());
      }
      const data = await request<ManagedCustomersListResponse>(
        `/customers/manage?${params.toString()}`,
        {
          method: 'GET',
        },
      );
      setList(
        data ?? {
          items: [],
          total: 0,
          page: 1,
          limit: 30,
        },
      );
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر تحميل قائمة العملاء',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  async function openCustomerDetails(customerId: string): Promise<void> {
    setDetailLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const data = await request<ManagedCustomerDetails>(`/customers/manage/${customerId}`, {
        method: 'GET',
      });
      if (!data) {
        setMessage({ text: 'لم يتم العثور على بيانات العميل', type: 'error' });
        return;
      }
      setSelectedCustomer(data);
      setSelectedCustomerWallet(data.wallet ?? null);
      setEditForm({
        fullName: data.customer.fullName,
        phone: data.customer.phone,
        email: data.customer.email ?? '',
        gender: (data.customer.gender ?? '') as '' | 'male' | 'female',
        country: data.customer.country || 'اليمن',
        city: data.customer.city ?? '',
        birthDate: data.customer.birthDate ? data.customer.birthDate.slice(0, 10) : '',
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر تحميل تفاصيل العميل',
        type: 'error',
      });
    } finally {
      setDetailLoading(false);
    }
  }

  async function createCustomer(): Promise<void> {
    if (!createForm.fullName.trim() || !createForm.phone.trim()) {
      setMessage({ text: 'الاسم ورقم الجوال حقول مطلوبة', type: 'error' });
      return;
    }

    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const payload = buildPayload(createForm);
      await request('/customers/manage', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setCreateForm(DEFAULT_FORM);
      setShowCreateForm(false);
      await loadCustomers();
      setMessage({ text: 'تم إنشاء العميل بنجاح', type: 'success' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر إنشاء العميل',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function updateCustomer(): Promise<void> {
    if (!selectedCustomerId) {
      return;
    }

    if (!editForm.fullName.trim() || !editForm.phone.trim()) {
      setMessage({ text: 'الاسم ورقم الجوال حقول مطلوبة', type: 'error' });
      return;
    }

    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const payload = buildPayload(editForm);
      await request(`/customers/manage/${selectedCustomerId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await Promise.all([loadCustomers(), openCustomerDetails(selectedCustomerId)]);
      setMessage({ text: 'تم تحديث بيانات العميل', type: 'success' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر تحديث بيانات العميل',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function toggleCustomerStatus(): Promise<void> {
    if (!selectedCustomerId || !selectedCustomer) {
      return;
    }

    const nextStatus = !selectedCustomer.customer.isActive;
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request(`/customers/manage/${selectedCustomerId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextStatus }),
      });
      await Promise.all([loadCustomers(), openCustomerDetails(selectedCustomerId)]);
      setMessage({
        text: nextStatus ? 'تم تفعيل العميل' : 'تم تعطيل العميل',
        type: 'success',
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر تغيير حالة العميل',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  }

  function resetToList(): void {
    setSelectedCustomer(null);
    setSelectedCustomerWallet(null);
    setEditForm(DEFAULT_FORM);
    setMessage({ text: '', type: 'info' });
  }

  if (hasDetails || detailLoading) {
    return (
      <AppPage maxWidth={1200}>
        <Button
          startIcon={<ArrowForwardIcon />}
          color="inherit"
          onClick={resetToList}
          sx={{ mb: 2, fontWeight: 700 }}
        >
          العودة إلى قائمة العملاء
        </Button>

        {message.text ? <Alert severity={message.type}>{message.text}</Alert> : null}

        {detailLoading || !selectedCustomer ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={3}>
            <Paper
              elevation={0}
              sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}
            >
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                justifyContent="space-between"
                spacing={2}
              >
                <Box>
                  <Typography variant="h5" fontWeight={800}>
                    {selectedCustomer.customer.fullName}
                  </Typography>
                  <Typography color="text.secondary">{selectedCustomer.customer.phone}</Typography>
                  <Typography color="text.secondary">
                    {selectedCustomer.customer.email || 'بدون بريد إلكتروني'}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={selectedCustomer.customer.isActive ? 'مفعل' : 'معطل'}
                    color={selectedCustomer.customer.isActive ? 'success' : 'error'}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => toggleCustomerStatus().catch(() => undefined)}
                    disabled={actionLoading}
                  >
                    {selectedCustomer.customer.isActive ? 'تعطيل' : 'تفعيل'}
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            {selectedCustomerWallet ? (
              <Paper
                elevation={0}
                sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}
              >
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  نقاط الولاء
                </Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                  <Chip
                    label={`الرصيد: ${selectedCustomerWallet.availablePoints}`}
                    color="primary"
                  />
                  <Chip label={`المكتسبة: ${selectedCustomerWallet.lifetimeEarnedPoints}`} />
                  <Chip label={`المصروفة: ${selectedCustomerWallet.lifetimeRedeemedPoints}`} />
                </Stack>
              </Paper>
            ) : null}

            <Paper
              elevation={0}
              sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}
            >
              <Typography variant="h6" fontWeight={700} gutterBottom>
                تعديل بيانات العميل
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' },
                  gap: 2,
                }}
              >
                <TextField
                  label="الاسم"
                  value={editForm.fullName}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, fullName: event.target.value }))
                  }
                />
                <TextField
                  label="رقم الجوال"
                  value={editForm.phone}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, phone: event.target.value }))
                  }
                />
                <TextField
                  label="البريد الإلكتروني"
                  value={editForm.email}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                />
                <TextField
                  select
                  label="الجنس"
                  value={editForm.gender}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      gender: event.target.value as '' | 'male' | 'female',
                    }))
                  }
                >
                  <MenuItem value="">غير محدد</MenuItem>
                  <MenuItem value="male">ذكر</MenuItem>
                  <MenuItem value="female">أنثى</MenuItem>
                </TextField>
                <TextField
                  label="الدولة"
                  value={editForm.country}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, country: event.target.value }))
                  }
                />
                <TextField
                  label="المدينة"
                  value={editForm.city}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, city: event.target.value }))
                  }
                />
                <TextField
                  type="date"
                  label="تاريخ الميلاد"
                  value={editForm.birthDate}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, birthDate: event.target.value }))
                  }
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
              <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => updateCustomer().catch(() => undefined)}
                  disabled={actionLoading}
                >
                  حفظ التعديلات
                </Button>
              </Stack>
            </Paper>

            <DetailsSection title="التقييمات" count={selectedCustomer.reviews.length}>
              {selectedCustomer.reviews.length === 0 ? (
                <Typography color="text.secondary">لا توجد تقييمات لهذا العميل.</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>المنتج</TableCell>
                        <TableCell>التقييم</TableCell>
                        <TableCell>التعليق</TableCell>
                        <TableCell>التاريخ</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedCustomer.reviews.map((review) => (
                        <TableRow key={review.id}>
                          <TableCell>{review.productTitle || review.productId}</TableCell>
                          <TableCell>{review.rating}/5</TableCell>
                          <TableCell>{review.comment || '-'}</TableCell>
                          <TableCell>{formatDate(review.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DetailsSection>

            <DetailsSection title="قائمة المفضلة" count={selectedCustomer.wishlist.length}>
              {selectedCustomer.wishlist.length === 0 ? (
                <Typography color="text.secondary">لا توجد عناصر مفضلة.</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>المنتج</TableCell>
                        <TableCell>السعر</TableCell>
                        <TableCell>تاريخ الإضافة</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedCustomer.wishlist.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.title}</TableCell>
                          <TableCell>{item.priceFrom ?? '-'} </TableCell>
                          <TableCell>{formatDate(item.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DetailsSection>

            <DetailsSection title="العناوين المحفوظة" count={selectedCustomer.addresses.length}>
              {selectedCustomer.addresses.length === 0 ? (
                <Typography color="text.secondary">لا توجد عناوين محفوظة.</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>العنوان</TableCell>
                        <TableCell>المدينة</TableCell>
                        <TableCell>المنطقة</TableCell>
                        <TableCell>افتراضي</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedCustomer.addresses.map((address) => (
                        <TableRow key={address.id}>
                          <TableCell>{address.addressLine}</TableCell>
                          <TableCell>{address.city || '-'}</TableCell>
                          <TableCell>{address.area || '-'}</TableCell>
                          <TableCell>{address.isDefault ? 'نعم' : 'لا'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DetailsSection>

            <DetailsSection title="السلات المتروكة" count={selectedCustomer.abandonedCarts.length}>
              {selectedCustomer.abandonedCarts.length === 0 ? (
                <Typography color="text.secondary">لا توجد سلات متروكة.</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>إجمالي السلة</TableCell>
                        <TableCell>عدد العناصر</TableCell>
                        <TableCell>مرسل استرجاع</TableCell>
                        <TableCell>تاريخ الإنشاء</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedCustomer.abandonedCarts.map((cart) => (
                        <TableRow key={cart.id}>
                          <TableCell>{cart.cartTotal}</TableCell>
                          <TableCell>{cart.itemsCount}</TableCell>
                          <TableCell>
                            {cart.recoverySentAt ? formatDate(cart.recoverySentAt) : 'لا'}
                          </TableCell>
                          <TableCell>{formatDate(cart.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DetailsSection>

            <DetailsSection title="سجل الطلبات" count={selectedCustomer.orders.length}>
              {selectedCustomer.orders.length === 0 ? (
                <Typography color="text.secondary">لا توجد طلبات لهذا العميل.</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>رقم الطلب</TableCell>
                        <TableCell>الحالة</TableCell>
                        <TableCell>الإجمالي</TableCell>
                        <TableCell>التاريخ</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedCustomer.orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>{order.orderCode}</TableCell>
                          <TableCell>{order.status}</TableCell>
                          <TableCell>
                            {order.total} {order.currencyCode}
                          </TableCell>
                          <TableCell>{formatDate(order.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DetailsSection>
          </Stack>
        )}
      </AppPage>
    );
  }

  return (
    <AppPage>
      <PageHeader
        title="إدارة العملاء"
        description="إدارة العملاء بالكامل: إضافة عميل يدوي، مراجعة البيانات، والمفضلة والتقييمات والعناوين والسلات المتروكة وسجل الطلبات."
        actions={
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              onClick={() => loadCustomers().catch(() => undefined)}
              disabled={loading}
            >
              تحديث
            </Button>
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => setShowCreateForm((prev) => !prev)}
            >
              {showCreateForm ? 'إغلاق النموذج' : 'إضافة عميل'}
            </Button>
          </Stack>
        }
      />

      {message.text ? <Alert severity={message.type}>{message.text}</Alert> : null}

      {showCreateForm ? (
        <Paper
          elevation={0}
          sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'primary.main' }}
        >
          <Typography variant="h6" fontWeight={700} gutterBottom>
            إضافة عميل يدوي
          </Typography>
          <Box
            sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}
          >
            <TextField
              label="الاسم"
              value={createForm.fullName}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, fullName: event.target.value }))
              }
            />
            <TextField
              label="رقم الجوال"
              value={createForm.phone}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, phone: event.target.value }))
              }
            />
            <TextField
              label="البريد الإلكتروني (اختياري)"
              value={createForm.email}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, email: event.target.value }))
              }
            />
            <TextField
              select
              label="الجنس (اختياري)"
              value={createForm.gender}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  gender: event.target.value as '' | 'male' | 'female',
                }))
              }
            >
              <MenuItem value="">غير محدد</MenuItem>
              <MenuItem value="male">ذكر</MenuItem>
              <MenuItem value="female">أنثى</MenuItem>
            </TextField>
            <TextField
              label="الدولة"
              value={createForm.country}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, country: event.target.value }))
              }
            />
            <TextField
              label="المدينة"
              value={createForm.city}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, city: event.target.value }))}
            />
            <TextField
              type="date"
              label="تاريخ الميلاد (اختياري)"
              value={createForm.birthDate}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, birthDate: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
            />
          </Box>
          <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
            <Button
              variant="contained"
              onClick={() => createCustomer().catch(() => undefined)}
              disabled={actionLoading}
            >
              حفظ العميل
            </Button>
            <Button variant="outlined" onClick={() => setCreateForm(DEFAULT_FORM)}>
              تفريغ الحقول
            </Button>
          </Stack>
        </Paper>
      ) : null}

      <FilterBar>
        <TextField
          placeholder="ابحث بالاسم أو الجوال أو البريد"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          sx={{ minWidth: 260, flex: 1 }}
        />
        <Button variant="contained" onClick={() => loadCustomers().catch(() => undefined)}>
          بحث
        </Button>
      </FilterBar>

      <DataTableWrapper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>الاسم</TableCell>
                <TableCell>الجوال</TableCell>
                <TableCell>الدولة/المدينة</TableCell>
                <TableCell>الجنس</TableCell>
                <TableCell>الطلبات</TableCell>
                <TableCell>الحالة</TableCell>
                <TableCell align="left">الإجراء</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : list.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">لا توجد بيانات عملاء مطابقة.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                list.items.map((customer) => (
                  <TableRow key={customer.id} hover>
                    <TableCell>
                      <Typography fontWeight={700}>{customer.fullName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {customer.email || 'بدون بريد'}
                      </Typography>
                    </TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell>
                      {customer.country}
                      {customer.city ? ` / ${customer.city}` : ''}
                    </TableCell>
                    <TableCell>{formatGender(customer.gender)}</TableCell>
                    <TableCell>{customer.ordersCount}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={customer.isActive ? 'مفعل' : 'معطل'}
                        color={customer.isActive ? 'success' : 'error'}
                      />
                    </TableCell>
                    <TableCell align="left">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<VisibilityIcon />}
                        onClick={() => openCustomerDetails(customer.id).catch(() => undefined)}
                      >
                        التفاصيل
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DataTableWrapper>
    </AppPage>
  );
}

function DetailsSection(props: { title: string; count: number; children: ReactNode }) {
  const { title, count, children } = props;
  return (
    <Paper
      elevation={0}
      sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          {title}
        </Typography>
        <Chip size="small" label={count} />
      </Stack>
      <Divider sx={{ mb: 2 }} />
      {children}
    </Paper>
  );
}

function buildPayload(form: CustomerFormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    fullName: form.fullName.trim(),
    phone: form.phone.trim(),
    country: form.country.trim() || 'اليمن',
  };

  if (form.email.trim()) {
    payload.email = form.email.trim();
  }

  if (form.gender) {
    payload.gender = form.gender;
  }

  if (form.city.trim()) {
    payload.city = form.city.trim();
  }

  if (form.birthDate.trim()) {
    payload.birthDate = form.birthDate.trim();
  }

  return payload;
}

function formatGender(gender: CustomerGender): string {
  if (gender === 'male') {
    return 'ذكر';
  }
  if (gender === 'female') {
    return 'أنثى';
  }
  return 'غير محدد';
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('ar-EG');
}
