import { useEffect, useMemo, useState } from 'react';
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
  ManagedQuestionsListResponse,
  ModerationStatus,
} from '../../types';
import { AppPage, DataTableWrapper, FilterBar, PageHeader } from '../../components/ui';

interface CustomerQuestionsPanelProps {
  request: MerchantRequester;
}

type QuestionStatusFilter = ModerationStatus | 'ALL';

export function CustomerQuestionsPanel({ request }: CustomerQuestionsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<QuestionStatusFilter>('ALL');
  const [answersById, setAnswersById] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [data, setData] = useState<ManagedQuestionsListResponse>({
    items: [],
    total: 0,
    page: 1,
    limit: 20,
  });

  useEffect(() => {
    loadQuestions().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hydratedAnswers = useMemo(() => {
    const next = { ...answersById };
    for (const item of data.items) {
      if (next[item.id] === undefined) {
        next[item.id] = item.answer ?? '';
      }
    }
    return next;
  }, [answersById, data.items]);

  async function loadQuestions(): Promise<void> {
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

      const response = await request<ManagedQuestionsListResponse>(
        `/customers/manage/questions?${params.toString()}`,
        { method: 'GET' },
      );
      const nextData =
        response ?? {
          items: [],
          total: 0,
          page: 1,
          limit: 30,
        };
      setData(nextData);
      setAnswersById((prev) => {
        const next = { ...prev };
        for (const item of nextData.items) {
          if (next[item.id] === undefined) {
            next[item.id] = item.answer ?? '';
          }
        }
        return next;
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load customer questions.',
      });
    } finally {
      setLoading(false);
    }
  }

  async function moderateQuestion(
    questionId: string,
    nextStatus: ModerationStatus,
  ): Promise<void> {
    const answer = (hydratedAnswers[questionId] ?? '').trim();
    if (nextStatus === 'APPROVED' && !answer) {
      setMessage({
        type: 'error',
        text: 'لا يمكن الموافقة على السؤال بدون كتابة الرد.',
      });
      return;
    }

    setActionLoadingId(questionId);
    setMessage(null);
    try {
      await request(`/customers/manage/questions/${questionId}/moderation`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
          ...(answer ? { answer } : {}),
        }),
      });
      await loadQuestions();
      setMessage({ type: 'success', text: 'Question moderation updated.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update question moderation.',
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <AppPage>
      <PageHeader
        title="إدارة أسئلة المنتجات"
        description="الأسئلة تظهر للعميل فقط بعد الرد والموافقة."
        actions={
          <Button variant="outlined" onClick={() => loadQuestions().catch(() => undefined)} disabled={loading}>
            تحديث
          </Button>
        }
      />

      {message ? <Alert severity={message.type}>{message.text}</Alert> : null}

      <FilterBar>
        <TextField
          placeholder="بحث بالعميل أو المنتج أو نص السؤال"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          sx={{ minWidth: 260, flex: 1 }}
        />
        <TextField
          select
          label="الحالة"
          value={status}
          onChange={(event) => setStatus(event.target.value as QuestionStatusFilter)}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="ALL">الكل</MenuItem>
          <MenuItem value="PENDING">Pending</MenuItem>
          <MenuItem value="APPROVED">Approved</MenuItem>
          <MenuItem value="HIDDEN">Hidden</MenuItem>
        </TextField>
        <Button variant="contained" onClick={() => loadQuestions().catch(() => undefined)}>
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
                <TableCell>السؤال</TableCell>
                <TableCell>الرد من الإدارة</TableCell>
                <TableCell>الحالة</TableCell>
                <TableCell>التاريخ</TableCell>
                <TableCell align="left">الإجراءات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">لا توجد أسئلة مطابقة.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.customerName || '-'}</TableCell>
                    <TableCell>{item.productTitle}</TableCell>
                    <TableCell>{item.question}</TableCell>
                    <TableCell sx={{ minWidth: 260 }}>
                      <TextField
                        multiline
                        minRows={2}
                        maxRows={5}
                        fullWidth
                        value={hydratedAnswers[item.id] ?? ''}
                        onChange={(event) =>
                          setAnswersById((prev) => ({ ...prev, [item.id]: event.target.value }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Chip label={item.moderationStatus} size="small" />
                    </TableCell>
                    <TableCell>{new Date(item.createdAt).toLocaleString('ar-EG')}</TableCell>
                    <TableCell align="left">
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => moderateQuestion(item.id, 'APPROVED').catch(() => undefined)}
                        disabled={actionLoadingId === item.id}
                        sx={{ mr: 1 }}
                      >
                        رد + نشر
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        onClick={() => moderateQuestion(item.id, 'HIDDEN').catch(() => undefined)}
                        disabled={actionLoadingId === item.id}
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
