import { ArrowForwardIcon, DownloadIcon, NoteAddIcon } from '../../../../components/icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Paper,
  Radio,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  TextField,
  Typography,
} from '@mui/material';
import type { MerchantRequester } from '../../merchant-dashboard.types';
import type {
  CustomerAddressResponse,
  ManagedCustomerDetails,
  ManagedCustomersListResponse,
  ManualOrderProduct,
  ManualOrderProductSearchResponse,
  Order,
  OrderDetail,
  OrderStatus,
  PaginatedOrders,
  PaymentMethod,
} from '../../types';
import { AppPage, DataTableWrapper, FilterBar, PageHeader } from '../../components/ui';
import {
  manualSteps,
  paymentMethodOptions,
  statusColor,
} from './constants';
import { formatCommercialDate, formatCommercialMoney, newIdempotencyKey } from '../../../../lib/commercial-format';

interface OrdersPanelProps {
  request: MerchantRequester;
}

type OrdersMode = 'list' | 'detail' | 'create-manual' | 'edit-manual';

interface ManualLine {
  variantId: string;
  productId: string;
  title: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineDiscount: number;
  availableQuantity: number;
  stockUnlimited: boolean;
}

interface CustomerLite {
  id: string;
  fullName: string;
  phone: string;
}

export function OrdersPanel({ request }: OrdersPanelProps) {
  const [mode, setMode] = useState<OrdersMode>('list');
  const [ordersData, setOrdersData] = useState<PaginatedOrders>({
    data: [],
    meta: { page: 1, limit: 30, total: 0, totalPages: 0 },
    summary: { statusCounts: {} },
  });
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' }>({
    text: '',
    type: 'info',
  });

  const [statusTab, setStatusTab] = useState<'all' | OrderStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [manualStep, setManualStep] = useState(0);
  const [manualLines, setManualLines] = useState<ManualLine[]>([]);
  const [manualCouponCode, setManualCouponCode] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [manualPaymentMethod, setManualPaymentMethod] = useState<PaymentMethod>('cod');
  const [manualCustomer, setManualCustomer] = useState<CustomerLite | null>(null);
  const [manualAddresses, setManualAddresses] = useState<CustomerAddressResponse[]>([]);
  const [manualAddressId, setManualAddressId] = useState('');
  const [manualCustomerQuery, setManualCustomerQuery] = useState('');
  const [manualCustomerResults, setManualCustomerResults] = useState<CustomerLite[]>([]);
  const [manualProductsQuery, setManualProductsQuery] = useState('');
  const [manualProductsLoading, setManualProductsLoading] = useState(false);
  const [manualProducts, setManualProducts] = useState<ManualOrderProduct[]>([]);
  const [manualSaving, setManualSaving] = useState(false);

  useEffect(() => {
    loadOrders().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchCustomers().catch(() => undefined);
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualCustomerQuery, mode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchManualProducts().catch(() => undefined);
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualProductsQuery, mode]);

  const manualSubtotal = useMemo(
    () => manualLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    [manualLines],
  );
  const manualLineDiscountTotal = useMemo(
    () => manualLines.reduce((sum, line) => sum + line.lineDiscount, 0),
    [manualLines],
  );
  const manualPreviewTotal = useMemo(
    () => Math.max(manualSubtotal - manualLineDiscountTotal, 0),
    [manualLineDiscountTotal, manualSubtotal],
  );
  const visibleOrderStatuses = Object.keys(ordersData.summary.statusCounts) as OrderStatus[];
  const visiblePaymentStatuses = [...new Set(ordersData.data.flatMap((order) =>
    order.paymentSummary.status ? [order.paymentSummary.status] : []))];

  async function loadOrders(): Promise<void> {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', '30');
      if (statusTab !== 'all') {
        params.set('status', statusTab);
      }
      if (searchQuery.trim()) {
        params.set('q', searchQuery.trim());
      }
      if (paymentMethodFilter) {
        params.set('paymentMethod', paymentMethodFilter);
      }
      if (paymentStatusFilter) {
        params.set('paymentStatus', paymentStatusFilter);
      }
      if (dateFrom) {
        params.set('dateFrom', dateFrom);
      }
      if (dateTo) {
        params.set('dateTo', dateTo);
      }

      const data = await request<PaginatedOrders>(`/orders?${params.toString()}`, {
        method: 'GET',
      });
      setOrdersData(
        data ?? {
          data: [],
          meta: { page: 1, limit: 30, total: 0, totalPages: 0 },
          summary: { statusCounts: {} },
        },
      );
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Failed to load orders',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  async function openOrderDetail(orderId: string): Promise<void> {
    setDetailLoading(true);
    setMode('detail');
    try {
      const data = await request<OrderDetail>(`/orders/${orderId}`, { method: 'GET' });
      if (!data) {
        throw new Error('Order detail not found');
      }
      setSelectedOrder(data);
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Failed to load order detail',
        type: 'error',
      });
      setMode('list');
    } finally {
      setDetailLoading(false);
    }
  }

  async function executeOrderCommand(command: string, requiresReason: boolean): Promise<void> {
    if (!selectedOrder) return;
    const reason = requiresReason ? window.prompt('سبب الإجراء')?.trim() : undefined;
    if (requiresReason && !reason) return;
    const route: Record<string, string> = { confirmOrder: 'confirm', cancelOrder: 'cancel', completeOrder: 'complete' };
    const suffix = route[command];
    if (!suffix) return;
    try {
      await request(`/orders/${selectedOrder.id}/${suffix}`, { method: 'POST',
        headers: { 'Idempotency-Key': newIdempotencyKey(`order-${command}`) },
        body: JSON.stringify({ reason, expectedVersion: selectedOrder.version }) });
      await loadOrders();
      await openOrderDetail(selectedOrder.id);
      setMessage({ text: 'تم تنفيذ أمر الطلب', type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'فشل تنفيذ أمر الطلب', type: 'error' });
    }
  }

  async function executePaymentCommand(command: string, requiresReason: boolean): Promise<void> {
    if (!selectedOrder?.payment) return;
    const reason = requiresReason ? window.prompt('سبب الإجراء')?.trim() : undefined;
    if (requiresReason && !reason) return;
    const routes: Record<string, string> = { startPaymentReview: 'start-review', approvePayment: 'approve',
      rejectPayment: 'reject', collectCodPayment: 'collect-cod', expirePayment: 'expire',
      cancelPayment: 'cancel', submitPaymentProof: 'submit-proof', resubmitPaymentProof: 'resubmit-proof' };
    const suffix = routes[command];
    if (!suffix) return;
    try {
      await request(`/payments/${selectedOrder.payment.id}/${suffix}`, { method: 'POST',
        headers: { 'Idempotency-Key': newIdempotencyKey(`payment-${command}`) },
        body: JSON.stringify({ reason }) });
      await openOrderDetail(selectedOrder.id);
      setMessage({ text: 'تم تنفيذ أمر الدفع', type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تنفيذ أمر الدفع', type: 'error' });
    }
  }

  async function executeFulfillmentCommand(command: string, requiresReason: boolean): Promise<void> {
    if (!selectedOrder) return;
    const reason = requiresReason ? window.prompt('سبب الإجراء')?.trim() : undefined;
    if (requiresReason && !reason) return;
    const routes: Record<string,string>={startPreparing:'start-preparing',overrideStartPreparing:'start-preparing-with-payment-override',
      markReady:'mark-ready',dispatch:'dispatch',markFulfilled:'mark-fulfilled',markFailed:'mark-failed',
      retryDispatch:'retry',cancelFulfillment:'cancel'};
    const suffix=routes[command]; if(!suffix)return;
    await request(`/orders/${selectedOrder.id}/fulfillment/${suffix}`,{method:'POST',
      headers:{'Idempotency-Key':newIdempotencyKey(`fulfillment-${command}`)},
      body:JSON.stringify({reason,expectedVersion:selectedOrder.version})});
    await openOrderDetail(selectedOrder.id);
  }

  async function exportExcel(): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (statusTab !== 'all') {
        params.set('status', statusTab);
      }
      if (searchQuery.trim()) {
        params.set('q', searchQuery.trim());
      }
      if (paymentMethodFilter) {
        params.set('paymentMethod', paymentMethodFilter);
      }
      if (paymentStatusFilter) {
        params.set('paymentStatus', paymentStatusFilter);
      }
      if (dateFrom) {
        params.set('dateFrom', dateFrom);
      }
      if (dateTo) {
        params.set('dateTo', dateTo);
      }

      const blob = await request<Blob>(
        `/orders/export/excel?${params.toString()}`,
        { method: 'GET' },
        { responseType: 'blob' },
      );
      if (!blob) {
        throw new Error('Export failed');
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `orders-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'فشل تصدير الطلبات',
        type: 'error',
      });
    }
  }

  async function searchCustomers(): Promise<void> {
    if (mode !== 'create-manual' && mode !== 'edit-manual') {
      return;
    }
    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('limit', '20');
    if (manualCustomerQuery.trim()) {
      params.set('q', manualCustomerQuery.trim());
    }

    try {
      const data = await request<ManagedCustomersListResponse>(
        `/customers/manage?${params.toString()}`,
        {
          method: 'GET',
        },
      );
      setManualCustomerResults(
        (data?.items ?? []).map((customer) => ({
          id: customer.id,
          fullName: customer.fullName,
          phone: customer.phone,
        })),
      );
    } catch {
      setManualCustomerResults([]);
    }
  }

  async function selectManualCustomer(customer: CustomerLite): Promise<void> {
    setManualCustomer(customer);
    setManualAddressId('');
    try {
      const details = await request<ManagedCustomerDetails>(`/customers/manage/${customer.id}`, {
        method: 'GET',
      });
      setManualAddresses(details?.addresses ?? []);
      const defaultAddress = details?.addresses.find((address) => address.isDefault);
      if (defaultAddress) {
        setManualAddressId(defaultAddress.id);
      }
    } catch {
      setManualAddresses([]);
    }
  }

  async function searchManualProducts(): Promise<void> {
    if (mode !== 'create-manual' && mode !== 'edit-manual') {
      return;
    }
    setManualProductsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', '20');
      if (manualProductsQuery.trim()) {
        params.set('q', manualProductsQuery.trim());
      }
      const data = await request<ManualOrderProductSearchResponse>(
        `/orders/manual/products?${params.toString()}`,
        { method: 'GET' },
      );
      setManualProducts(data?.data ?? []);
    } catch {
      setManualProducts([]);
    } finally {
      setManualProductsLoading(false);
    }
  }

  function addManualProduct(product: ManualOrderProduct): void {
    setManualLines((prev) => {
      const existing = prev.find((line) => line.variantId === product.variantId);
      if (existing) {
        return prev.map((line) =>
          line.variantId === product.variantId
            ? {
                ...line,
                quantity: line.stockUnlimited
                  ? line.quantity + 1
                  : Math.min(line.quantity + 1, line.availableQuantity || line.quantity + 1),
              }
            : line,
        );
      }
      return [
        ...prev,
        {
          variantId: product.variantId,
          productId: product.productId,
          title: product.variantTitle || product.productTitle,
          sku: product.sku,
          unitPrice: product.price,
          quantity: 1,
          lineDiscount: 0,
          availableQuantity: product.availableQuantity,
          stockUnlimited: product.stockUnlimited,
        },
      ];
    });
  }

  function updateLine(
    variantId: string,
    patch: Partial<Pick<ManualLine, 'quantity' | 'unitPrice' | 'lineDiscount'>>,
  ): void {
    setManualLines((prev) =>
      prev.map((line) => {
        if (line.variantId !== variantId) {
          return line;
        }
        const nextQuantity =
          patch.quantity !== undefined
            ? Math.max(
                1,
                line.stockUnlimited
                  ? patch.quantity
                  : Math.min(patch.quantity, Math.max(line.availableQuantity, 1)),
              )
            : line.quantity;
        const nextUnitPrice =
          patch.unitPrice !== undefined ? Math.max(0, patch.unitPrice) : line.unitPrice;
        const maxDiscount = nextUnitPrice * nextQuantity;
        const nextDiscountRaw =
          patch.lineDiscount !== undefined ? patch.lineDiscount : line.lineDiscount;
        const nextDiscount = Math.max(0, Math.min(nextDiscountRaw, maxDiscount));
        return {
          ...line,
          quantity: nextQuantity,
          unitPrice: Number(nextUnitPrice.toFixed(2)),
          lineDiscount: Number(nextDiscount.toFixed(2)),
        };
      }),
    );
  }

  function removeLine(variantId: string): void {
    setManualLines((prev) => prev.filter((line) => line.variantId !== variantId));
  }

  async function submitManualOrder(): Promise<void> {
    if (!manualCustomer?.id) {
      setMessage({ text: 'اختر العميل أولاً', type: 'error' });
      return;
    }
    if (manualLines.length === 0) {
      setMessage({ text: 'أضف منتج واحد على الأقل', type: 'error' });
      return;
    }

    setManualSaving(true);
    try {
      const payload: Record<string, unknown> = {
        customerId: manualCustomer.id,
        paymentMethod: manualPaymentMethod,
        lines: manualLines.map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
          ...(line.lineDiscount > 0 ? { lineDiscount: line.lineDiscount } : {}),
        })),
      };
      if (manualLines.some((line) => line.lineDiscount > 0)) {
        const reason = window.prompt('سبب الخصم اليدوي')?.trim();
        if (!reason) return;
        payload.priceOverrideReason = reason;
      }

      if (manualAddressId) {
        payload.customerAddressId = manualAddressId;
      }
      if (manualCouponCode.trim()) {
        payload.couponCode = manualCouponCode.trim();
      }
      if (manualNote.trim()) {
        payload.note = manualNote.trim();
      }

      if (mode === 'create-manual') {
        const created = await request<OrderDetail>('/orders/manual', {
          method: 'POST',
          headers: { 'Idempotency-Key': newIdempotencyKey('manual-create') },
          body: JSON.stringify(payload),
        });
        if (created) {
          setSelectedOrder(created);
          setMode('detail');
        } else {
          setMode('list');
        }
      } else if (mode === 'edit-manual' && selectedOrder) {
        const updated = await request<OrderDetail>(`/orders/${selectedOrder.id}/manual/edit`, {
          method: 'POST',
          headers: { 'Idempotency-Key': newIdempotencyKey('manual-edit') },
          body: JSON.stringify({ ...payload, expectedVersion: selectedOrder.version }),
        });
        if (updated) {
          setSelectedOrder(updated);
          setMode('detail');
        } else {
          setMode('list');
        }
      }

      await loadOrders();
      setMessage({ text: 'تم حفظ الطلب اليدوي بنجاح', type: 'success' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'فشل حفظ الطلب اليدوي',
        type: 'error',
      });
    } finally {
      setManualSaving(false);
    }
  }

  function resetManualDraft(): void {
    setManualStep(0);
    setManualLines([]);
    setManualCouponCode('');
    setManualNote('');
    setManualPaymentMethod('cod');
    setManualCustomer(null);
    setManualAddresses([]);
    setManualAddressId('');
    setManualCustomerQuery('');
    setManualCustomerResults([]);
    setManualProductsQuery('');
    setManualProducts([]);
  }

  function openCreateManual(): void {
    resetManualDraft();
    setMode('create-manual');
  }

  function openEditManual(): void {
    if (!selectedOrder) {
      return;
    }
    resetManualDraft();
    setMode('edit-manual');
    setManualLines(
      selectedOrder.items.map((item) => ({
        variantId: item.variantId,
        productId: item.productId,
        title: item.title,
        sku: item.sku,
        unitPrice: Number(item.unitPrice),
        quantity: item.quantity,
        lineDiscount: Math.max(Number(item.lineSubtotal) - Number(item.lineTotal), 0),
        availableQuantity: item.quantity,
        stockUnlimited: true,
      })),
    );
    setManualPaymentMethod((selectedOrder.payment?.method as PaymentMethod) ?? 'cod');
    setManualNote(selectedOrder.note ?? '');
    if (selectedOrder.customer.id) {
      const customer = {
        id: selectedOrder.customer.id,
        fullName: selectedOrder.customer.name ?? 'العميل',
        phone: selectedOrder.customer.phone ?? '',
      };
      setManualCustomer(customer);
      void selectManualCustomer(customer);
    }
  }

  const canEditCurrentOrder =
    selectedOrder &&
    selectedOrder.status === 'new' && selectedOrder.fulfillment.status === 'unfulfilled';

  if (mode === 'detail' || detailLoading) {
    return (
      <AppPage maxWidth={1200}>
        <Button
          startIcon={<ArrowForwardIcon />}
          color="inherit"
          sx={{ mb: 2, fontWeight: 700 }}
          onClick={() => setMode('list')}
        >
          Back to orders
        </Button>

        {message.text ? <Alert severity={message.type}>{message.text}</Alert> : null}

        {detailLoading || !selectedOrder ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2.5}>
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
                    Order {selectedOrder.orderNumber}
                  </Typography>
                  <Typography color="text.secondary">
                    تاريخ الإنشاء {formatCommercialDate(selectedOrder.createdAt)}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Chip
                    label={selectedOrder.statusLabel}
                    color={statusColor(selectedOrder.status)}
                  />
                  {canEditCurrentOrder ? (
                    <Button variant="outlined" onClick={openEditManual}>
                      Edit order
                    </Button>
                  ) : null}
                  {selectedOrder.allowedTransitions.order.map((transition) => (
                    <Button key={transition.command} variant="contained"
                      onClick={() => executeOrderCommand(transition.command,transition.requiresReason).catch(()=>undefined)}>
                      {transition.command} → {transition.toStatus}
                    </Button>
                  ))}
                  {selectedOrder.allowedTransitions.fulfillment.map((transition) => (
                    <Button key={transition.command} variant="outlined"
                      onClick={() => executeFulfillmentCommand(transition.command,transition.requiresReason).catch((error:unknown)=>
                        setMessage({text:error instanceof Error?error.message:'تعذر تنفيذ أمر التجهيز',type:'error'}))}>
                      {transition.command} → {transition.toStatus}
                    </Button>
                  ))}
                </Stack>
              </Stack>
            </Paper>

            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>الحالة التجارية والتنفيذ</Typography>
              <Stack spacing={1}>
                <Typography>حالة الطلب: {selectedOrder.statusLabel}</Typography>
                <Typography>نوع التنفيذ: {selectedOrder.fulfillment.type}</Typography>
                <Typography>حالة التنفيذ: {selectedOrder.fulfillment.statusLabel}</Typography>
                <Typography>آخر تحديث: {formatCommercialDate(selectedOrder.updatedAt)}</Typography>
              </Stack>
            </Paper>

            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>الإجماليات المالية</Typography>
              <Stack spacing={1}>
                <Typography>الإجمالي الفرعي: {formatCommercialMoney(selectedOrder.totals.subtotalAmount,selectedOrder.totals.currency)}</Typography>
                <Typography>الخصم: {formatCommercialMoney(selectedOrder.totals.discountAmount,selectedOrder.totals.currency)}</Typography>
                <Typography>الشحن: {formatCommercialMoney(selectedOrder.totals.shippingAmount,selectedOrder.totals.currency)}</Typography>
                <Typography>الضريبة: {formatCommercialMoney(selectedOrder.totals.taxAmount,selectedOrder.totals.currency)}</Typography>
                <Typography>الإجمالي: {formatCommercialMoney(selectedOrder.totals.totalAmount,selectedOrder.totals.currency)}</Typography>
                <Typography>المدفوع: {formatCommercialMoney(selectedOrder.totals.paidAmount,selectedOrder.totals.currency)}</Typography>
                <Typography>المسترد: {formatCommercialMoney(selectedOrder.totals.refundedAmount,selectedOrder.totals.currency)}</Typography>
                <Typography>القابل للاسترداد: {formatCommercialMoney(selectedOrder.totals.refundableAmount,selectedOrder.totals.currency)}</Typography>
              </Stack>
            </Paper>

            <Paper
              elevation={0}
              sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}
            >
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Order items
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>المنتج</TableCell>
                      <TableCell>رمز التخزين (SKU)</TableCell>
                      <TableCell align="center">الكمية</TableCell>
                      <TableCell align="right">سعر الوحدة</TableCell>
                      <TableCell align="right">المجموع</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedOrder.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.title}</TableCell>
                        <TableCell>{item.sku}</TableCell>
                        <TableCell align="center">{item.quantity}</TableCell>
                        <TableCell align="right">{formatCommercialMoney(item.unitPrice,item.currency)}</TableCell>
                        <TableCell align="right">{formatCommercialMoney(item.lineTotal,item.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            <Paper
              elevation={0}
              sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}
            >
              <Typography variant="h6" fontWeight={700} gutterBottom>
                بيانات الدفع
              </Typography>
              {selectedOrder.payment ? (
                <Stack spacing={0.75}>
                  <Typography>طريقة الدفع: {selectedOrder.payment.paymentMethodName ?? selectedOrder.payment.paymentMethodCode ?? selectedOrder.payment.method}</Typography>
                  <Typography>حالة الدفع: {selectedOrder.payment.status}</Typography>
                  <Typography>المبلغ: {formatCommercialMoney(selectedOrder.payment.amount,selectedOrder.payment.currency)}</Typography>
                  <Typography>اسم الحساب المستلم: {selectedOrder.payment.accountName ?? '-'}</Typography>
                  <Typography>رقم الحساب المستلم: {selectedOrder.payment.accountNumber ?? '-'}</Typography>
                  <Typography>رقم الهاتف: {selectedOrder.payment.phoneNumber ?? '-'}</Typography>
                  <Typography>رقم مرجع العملية: {selectedOrder.payment.payerReference ?? '-'}</Typography>
                  <Typography>تعليمات الدفع: {selectedOrder.payment.instructionsAr ?? selectedOrder.payment.instructionsEn ?? '-'}</Typography>
                  <Typography>
                    تاريخ إرسال بيانات الدفع:{' '}
                    {selectedOrder.payment.customerSubmittedAt
                      ? formatCommercialDate(selectedOrder.payment.customerSubmittedAt)
                      : '-'}
                  </Typography>
                  <Typography>تمت المراجعة بواسطة: {selectedOrder.payment.reviewedBy ?? '-'}</Typography>
                  <Typography>ملاحظة المراجعة: {selectedOrder.payment.reviewNote ?? '-'}</Typography>
                  {selectedOrder.payment.payerReceiptUrl ?? selectedOrder.payment.receiptUrl ? (
                    <Button
                      component="a"
                      href={selectedOrder.payment.payerReceiptUrl ?? selectedOrder.payment.receiptUrl ?? '#'}
                      target="_blank"
                      variant="outlined"
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      عرض صورة الإيصال
                    </Button>
                  ) : null}
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {selectedOrder.allowedTransitions.payment.map((transition) => (
                      <Button key={transition.command} variant="contained"
                        onClick={() => executePaymentCommand(transition.command, transition.requiresReason).catch(() => undefined)}>
                        {transition.command} → {transition.toStatus}
                      </Button>
                    ))}
                  </Stack>
                </Stack>
              ) : (
                <Typography color="text.secondary">لا توجد بيانات دفع</Typography>
              )}
            </Paper>

            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>حجوزات المخزون</Typography>
              <Stack spacing={1}>
                {selectedOrder.inventoryReservations.length === 0 ? <Typography color="text.secondary">لا توجد حجوزات</Typography> :
                  selectedOrder.inventoryReservations.map((reservation) => <Typography key={reservation.id}>
                    {reservation.variantId} — {reservation.quantity} — {reservation.status} — {formatCommercialDate(reservation.reservedAt)}
                  </Typography>)}
              </Stack>
            </Paper>

            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>سجل الحالات</Typography>
              <Stack spacing={1.5}>
                {selectedOrder.timeline.map((entry, index) => <Typography key={`order-${index}`}>
                  الطلب: {entry.from ?? '—'} → {entry.to} — {formatCommercialDate(entry.createdAt)}
                </Typography>)}
                {selectedOrder.fulfillmentHistory.map((entry, index) => <Typography key={`fulfillment-${index}`}>
                  التنفيذ: {entry.from ?? '—'} → {entry.to} ({entry.command}) — {formatCommercialDate(entry.createdAt)}
                </Typography>)}
                {selectedOrder.paymentHistory.map((entry, index) => <Typography key={`payment-${index}`}>
                  الدفع: {entry.from ?? '—'} → {entry.to} ({entry.command}) — {formatCommercialDate(entry.createdAt)}
                </Typography>)}
              </Stack>
            </Paper>

            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>سجل التدقيق</Typography>
              <Stack spacing={1}>
                {selectedOrder.auditTimeline.length === 0 ? <Typography color="text.secondary">لا توجد قيود تدقيق</Typography> :
                  selectedOrder.auditTimeline.map((entry, index) => <Typography key={`audit-${index}`}>
                    {entry.action} — {entry.actorType} — {formatCommercialDate(entry.createdAt)}
                  </Typography>)}
              </Stack>
            </Paper>
          </Stack>
        )}
      </AppPage>
    );
  }

  if (mode === 'create-manual' || mode === 'edit-manual') {
    return (
      <AppPage maxWidth={1200}>
        <Button
          startIcon={<ArrowForwardIcon />}
          color="inherit"
          sx={{ mb: 2, fontWeight: 700 }}
          onClick={() => setMode(selectedOrder ? 'detail' : 'list')}
        >
          Back
        </Button>

        <PageHeader
          title={mode === 'create-manual' ? 'إنشاء طلب يدوي' : 'تعديل طلب يدوي'}
          description="إنشاء أو تعديل الطلب باختيار المنتجات، العميل، طريقة الدفع، والملخص."
        />

        {message.text ? <Alert severity={message.type}>{message.text}</Alert> : null}

        <Paper
          elevation={0}
          sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}
        >
          <Stepper activeStep={manualStep} alternativeLabel>
            {manualSteps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          <Divider sx={{ my: 2 }} />

          {manualStep === 0 ? (
            <Stack spacing={2}>
              <TextField
                label="Search products (title or SKU)"
                value={manualProductsQuery}
                onChange={(event) => setManualProductsQuery(event.target.value)}
                fullWidth
              />
              <Paper
                elevation={0}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
              >
                <TableContainer sx={{ maxHeight: 280 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>المنتج</TableCell>
                        <TableCell>رمز التخزين (SKU)</TableCell>
                        <TableCell align="right">السعر</TableCell>
                        <TableCell align="right">المتاح</TableCell>
                        <TableCell align="left">الإجراء</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {manualProductsLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <CircularProgress size={22} />
                          </TableCell>
                        </TableRow>
                      ) : manualProducts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography color="text.secondary">لا توجد منتجات</Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        manualProducts.map((product) => (
                          <TableRow key={product.variantId} hover>
                            <TableCell>{product.variantTitle || product.productTitle}</TableCell>
                            <TableCell>{product.sku}</TableCell>
                            <TableCell align="right">{product.price.toFixed(2)}</TableCell>
                            <TableCell align="right">
                              {product.stockUnlimited ? 'غير محدود' : product.availableQuantity}
                            </TableCell>
                            <TableCell>
                              <Button size="small" onClick={() => addManualProduct(product)}>
                                Add
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              <Typography variant="h6" fontWeight={700}>
                Selected lines
              </Typography>
              <Paper
                elevation={0}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
              >
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>المنتج</TableCell>
                        <TableCell>الكمية</TableCell>
                        <TableCell>سعر الوحدة</TableCell>
                        <TableCell>الخصم</TableCell>
                        <TableCell align="right">الإجمالي</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {manualLines.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center">
                            <Typography color="text.secondary">لم يتم إضافة منتجات</Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        manualLines.map((line) => (
                          <TableRow key={line.variantId}>
                            <TableCell>
                              <Typography fontWeight={700}>{line.title}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {line.sku}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ width: 120 }}>
                              <TextField
                                type="number"
                                size="small"
                                value={line.quantity}
                                onChange={(event) =>
                                  updateLine(line.variantId, {
                                    quantity: Number(event.target.value),
                                  })
                                }
                                inputProps={{ min: 1 }}
                              />
                            </TableCell>
                            <TableCell sx={{ width: 150 }}>
                              <TextField
                                type="number"
                                size="small"
                                value={line.unitPrice}
                                onChange={(event) =>
                                  updateLine(line.variantId, {
                                    unitPrice: Number(event.target.value),
                                  })
                                }
                                inputProps={{ min: 0, step: '0.01' }}
                              />
                            </TableCell>
                            <TableCell sx={{ width: 150 }}>
                              <TextField
                                type="number"
                                size="small"
                                value={line.lineDiscount}
                                onChange={(event) =>
                                  updateLine(line.variantId, {
                                    lineDiscount: Number(event.target.value),
                                  })
                                }
                                inputProps={{ min: 0, step: '0.01' }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              {(line.unitPrice * line.quantity - line.lineDiscount).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="small"
                                color="error"
                                onClick={() => removeLine(line.variantId)}
                              >
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Stack>
          ) : null}

          {manualStep === 1 ? (
            <Stack spacing={2}>
              <TextField
                label="Search customers (name or phone)"
                value={manualCustomerQuery}
                onChange={(event) => setManualCustomerQuery(event.target.value)}
              />
              <Paper
                elevation={0}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
              >
                <TableContainer sx={{ maxHeight: 260 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>الاسم</TableCell>
                        <TableCell>الهاتف</TableCell>
                        <TableCell align="left">الإجراء</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {manualCustomerResults.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} align="center">
                            <Typography color="text.secondary">لا يوجد عملاء</Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        manualCustomerResults.map((customer) => (
                          <TableRow key={customer.id} hover>
                            <TableCell>{customer.fullName}</TableCell>
                            <TableCell>{customer.phone}</TableCell>
                            <TableCell>
                              <Button size="small" onClick={() => selectManualCustomer(customer)}>
                                Select
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              {manualCustomer ? (
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>
                    تم الاختيار: {manualCustomer.fullName} ({manualCustomer.phone})
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Choose delivery address
                  </Typography>
                  <Stack sx={{ mt: 1 }}>
                    {manualAddresses.map((address) => (
                      <Box key={address.id} sx={{ display: 'flex', alignItems: 'center' }}>
                        <Radio
                          checked={manualAddressId === address.id}
                          onChange={() => setManualAddressId(address.id)}
                        />
                        <Typography variant="body2">
                          {address.addressLine}
                          {address.city ? `, ${address.city}` : ''}
                          {address.area ? ` - ${address.area}` : ''}
                        </Typography>
                        {address.isDefault ? (
                          <Chip size="small" label="الأساسي" color="primary" sx={{ ml: 1 }} />
                        ) : null}
                      </Box>
                    ))}
                  </Stack>
                </Box>
              ) : null}
            </Stack>
          ) : null}

          {manualStep === 2 ? (
            <Stack spacing={2} maxWidth={420}>
              <TextField
                select
                label="طريقة الدفع"
                value={manualPaymentMethod}
                onChange={(event) => setManualPaymentMethod(event.target.value as PaymentMethod)}
              >
                {paymentMethodOptions.map((method) => (
                  <MenuItem key={method} value={method}>
                    {method}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          ) : null}

          {manualStep === 3 ? (
            <Stack spacing={2} maxWidth={520}>
              <TextField
                label="Coupon code (optional)"
                value={manualCouponCode}
                onChange={(event) => setManualCouponCode(event.target.value)}
              />
              <TextField
                label="Note (optional)"
                value={manualNote}
                onChange={(event) => setManualNote(event.target.value)}
                multiline
                rows={3}
              />
              <Paper
                elevation={0}
                sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
              >
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  Order summary preview
                </Typography>
                <Stack spacing={0.75}>
                  <Typography>المجموع الفرعي: {manualSubtotal.toFixed(2)}</Typography>
                  <Typography>خصومات المنتجات: {manualLineDiscountTotal.toFixed(2)}</Typography>
                  <Typography fontWeight={700}>
                    الإجمالي قبل الخصم/الشحن: {manualPreviewTotal.toFixed(2)}
                  </Typography>
                </Stack>
              </Paper>
            </Stack>
          ) : null}

          <Stack direction="row" justifyContent="space-between" sx={{ mt: 3 }}>
            <Button
              variant="outlined"
              disabled={manualStep === 0}
              onClick={() => setManualStep((prev) => Math.max(prev - 1, 0))}
            >
              Previous
            </Button>
            {manualStep < manualSteps.length - 1 ? (
              <Button
                variant="contained"
                onClick={() => setManualStep((prev) => Math.min(prev + 1, manualSteps.length - 1))}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={() => submitManualOrder().catch(() => undefined)}
                disabled={manualSaving}
              >
                {manualSaving ? 'جاري الحفظ...' : 'تأكيد الطلب'}
              </Button>
            )}
          </Stack>
        </Paper>
      </AppPage>
    );
  }

  return (
    <AppPage>
      <PageHeader
        title="إدارة الطلبات"
        description="إدارة الطلبات، تحديث الحالة مباشرة، التصفية والتصدير."
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<DownloadIcon />}
              variant="outlined"
              onClick={() => exportExcel().catch(() => undefined)}
            >
              Export Excel
            </Button>
            <Button startIcon={<NoteAddIcon />} variant="contained" onClick={openCreateManual}>
              Create Manual Order
            </Button>
          </Stack>
        }
      />

      {message.text ? <Alert severity={message.type}>{message.text}</Alert> : null}

      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 1.5 }}
      >
        <Tabs
          value={statusTab}
          onChange={(_event, value: 'all' | OrderStatus) => setStatusTab(value)}
        >
          <Tab label={`All (${ordersData.meta.total})`} value="all" />
          {visibleOrderStatuses.map((status) => (
            <Tab
              key={status}
              label={`${ordersData.data.find((order)=>order.status===status)?.statusLabel??status} (${ordersData.summary.statusCounts[status] ?? 0})`}
              value={status}
            />
          ))}
        </Tabs>
      </Paper>

      <FilterBar>
        <TextField
          label="البحث برقم الطلب/العميل/الهاتف"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          sx={{ minWidth: 260, flex: 1 }}
        />
        <TextField
          select
          label="طريقة الدفع"
          value={paymentMethodFilter}
          onChange={(event) => setPaymentMethodFilter(event.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">الكل</MenuItem>
          {paymentMethodOptions.map((method) => (
            <MenuItem key={method} value={method}>
              {method}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="حالة الدفع"
          value={paymentStatusFilter}
          onChange={(event) => setPaymentStatusFilter(event.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">الكل</MenuItem>
          {visiblePaymentStatuses.map((status) => (
            <MenuItem key={status} value={status}>
              {status}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type="date"
          label="من"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        />
        <TextField
          type="date"
          label="إلى"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        />
        <Button variant="contained" onClick={() => loadOrders().catch(() => undefined)}>
          Apply
        </Button>
      </FilterBar>

      <DataTableWrapper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>رقم الطلب</TableCell>
                <TableCell>العميل</TableCell>
                <TableCell>طريقة الدفع</TableCell>
                <TableCell>حالة الدفع</TableCell>
                <TableCell align="right">الإجمالي</TableCell>
                <TableCell>الحالة</TableCell>
                <TableCell>تاريخ الإنشاء</TableCell>
                <TableCell align="left">عرض</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : ordersData.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">لم يتم العثور على طلبات</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                ordersData.data.map((order) => (
                  <TableRow key={order.id} hover>
                    <TableCell>
                      <Button
                        size="small"
                        onClick={() => openOrderDetail(order.id).catch(() => undefined)}
                      >
                        {order.orderNumber}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={700}>{order.customer.name ?? '-'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {order.customer.phone ?? '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>{order.paymentSummary.methodName ?? order.paymentSummary.methodCode ?? order.paymentSummary.method ?? '-'}</TableCell>
                    <TableCell>{order.paymentSummary.status ?? '-'}</TableCell>
                    <TableCell align="right">
                      {formatCommercialMoney(order.totals.totalAmount,order.totals.currency)}
                    </TableCell>
                    <TableCell>
                      <Chip label={order.statusLabel} color={statusColor(order.status)} />
                    </TableCell>
                    <TableCell>{formatCommercialDate(order.createdAt)}</TableCell>
                    <TableCell align="left">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => openOrderDetail(order.id).catch(() => undefined)}
                      >
                        View
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
