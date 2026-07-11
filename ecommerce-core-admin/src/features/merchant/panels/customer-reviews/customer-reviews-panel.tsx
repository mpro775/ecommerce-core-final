import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
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
  ManagedReviewsListResponse,
  ModerationStatus,
} from '../../types';
import { AppPage, DataTableWrapper, FilterBar, PageHeader } from '../../components/ui';

interface CustomerReviewsPanelProps {
  request: MerchantRequester;
}

type ReviewStatusFilter = ModerationStatus | 'ALL';

export function CustomerReviewsPanel({ request }: CustomerReviewsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ReviewStatusFilter>('ALL');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [data, setData] = useState<ManagedReviewsListResponse>({
    items: [],
    total: 0,
    page: 1,
    limit: 20,
  });

  useEffect(() => {
    loadReviews().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadReviews(): Promise<void> {
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ page: '1', limit: '30' });
      if (query.trim()) {
        params.set('q', query.trim());
      }
      if (status !== 'ALL') {
        params.set('status', status);
      }

      const response = await request<ManagedReviewsListResponse>(
        `/customers/manage/reviews?${params.toString()}`,
        { method: 'GET' },
      );
      setData(
        response ?? {
          items: [],
          total: 0,
          page: 1,
          limit: 30,
        },
      );
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load customer reviews.',
      });
    } finally {
      setLoading(false);
    }
  }

  async function updateModeration(reviewId: string, nextStatus: ModerationStatus): Promise<void> {
    setActionLoadingId(reviewId);
    setMessage(null);
    try {
      await request(`/customers/manage/reviews/${reviewId}/moderation`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadReviews();
      setMessage({ type: 'success', text: 'Review moderation updated.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update review moderation.',
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <AppPage>
      <PageHeader
        title="إدارة تقييمات العملاء"
        description="عرض ومراجعة التقييمات قبل النشر. التقييمات الجديدة تبدأ Pending."
        actions={
          <Button variant="outlined" onClick={() => loadReviews().catch(() => undefined)} disabled={loading}>
            تحديث
          </Button>
        }
      />

      {message ? <Alert severity={message.type}>{message.text}</Alert> : null}

      <FilterBar>
        <TextField
          placeholder="بحث بالعميل أو المنتج أو نص التقييم"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          sx={{ minWidth: 260, flex: 1 }}
        />
        <TextField
          select
          label="الحالة"
          value={status}
          onChange={(event) => setStatus(event.target.value as ReviewStatusFilter)}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="ALL">الكل</MenuItem>
          <MenuItem value="PENDING">Pending</MenuItem>
          <MenuItem value="APPROVED">Approved</MenuItem>
          <MenuItem value="HIDDEN">Hidden</MenuItem>
        </TextField>
        <Button variant="contained" onClick={() => loadReviews().catch(() => undefined)}>
          بحث
        </Button>
      </FilterBar>

      <DataTableWrapper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>العميل</TableCell>
                <TableCell>المنتج</TableCell>
                <TableCell>التقييم</TableCell>
                <TableCell>التعليق</TableCell>
                <TableCell>شراء موثق</TableCell>
                <TableCell>الحالة</TableCell>
                <TableCell>التاريخ</TableCell>
                <TableCell align="left">الإجراءات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">لا توجد تقييمات مطابقة.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((review) => (
                  <TableRow key={review.id} hover>
                    <TableCell>{review.customerName}</TableCell>
                    <TableCell>{review.productTitle}</TableCell>
                    <TableCell>{review.rating}/5</TableCell>
                    <TableCell>{review.comment || '-'}</TableCell>
                    <TableCell>{review.isVerifiedPurchase ? 'نعم' : 'لا'}</TableCell>
                    <TableCell>
                      <Chip label={review.moderationStatus} size="small" />
                    </TableCell>
                    <TableCell>{new Date(review.createdAt).toLocaleString('ar-EG')}</TableCell>
                    <TableCell align="left">
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => updateModeration(review.id, 'APPROVED').catch(() => undefined)}
                        disabled={actionLoadingId === review.id}
                        sx={{ mr: 1 }}
                      >
                        موافقة
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        onClick={() => updateModeration(review.id, 'HIDDEN').catch(() => undefined)}
                        disabled={actionLoadingId === review.id}
                      >
                        إخفاء
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
