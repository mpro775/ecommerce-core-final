import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
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
  SupportTicketDetailResponse,
  SupportTicketPriority,
  SupportTicketsListResponse,
  SupportTicketStatus,
} from '../../types';
import { AppPage, DataTableWrapper, FilterBar, PageHeader } from '../../components/ui';

interface SupportTicketsPanelProps {
  request: MerchantRequester;
}

const STATUS_OPTIONS: SupportTicketStatus[] = [
  'open',
  'waiting_customer',
  'waiting_agent',
  'resolved',
  'closed',
];

const PRIORITY_OPTIONS: SupportTicketPriority[] = ['low', 'medium', 'high', 'urgent'];

export function SupportTicketsPanel({ request }: SupportTicketsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tickets, setTickets] = useState<SupportTicketsListResponse>({
    items: [],
    total: 0,
    page: 1,
    limit: 20,
  });
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketDetailResponse | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [createSubject, setCreateSubject] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createMessage, setCreateMessage] = useState('');
  const [createScope, setCreateScope] = useState<'b2b' | 'b2c'>('b2b');
  const [createPriority, setCreatePriority] = useState<SupportTicketPriority>('medium');
  const [reply, setReply] = useState('');
  const [assignToStoreUserId, setAssignToStoreUserId] = useState('');

  useEffect(() => {
    loadTickets().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedStatus = selectedTicket?.ticket.status ?? 'open';

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of tickets.items) {
      counts[item.status] = (counts[item.status] ?? 0) + 1;
    }
    return counts;
  }, [tickets.items]);

  async function loadTickets(): Promise<void> {
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '40',
      });
      if (search.trim()) params.set('q', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);

      const data = await request<SupportTicketsListResponse>(
        `/support/tickets?${params.toString()}`,
        { method: 'GET' },
      );
      setTickets(data ?? { items: [], total: 0, page: 1, limit: 20 });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load support tickets',
      });
    } finally {
      setLoading(false);
    }
  }

  async function openTicket(ticketId: string): Promise<void> {
    setSelectedTicketId(ticketId);
    setLoading(true);
    try {
      const detail = await request<SupportTicketDetailResponse>(`/support/tickets/${ticketId}`, {
        method: 'GET',
      });
      setSelectedTicket(detail);
      setReply('');
      setAssignToStoreUserId(detail?.ticket.assignee.storeUserId ?? '');
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load ticket details',
      });
    } finally {
      setLoading(false);
    }
  }

  async function createTicket(): Promise<void> {
    if (!createSubject.trim() || !createMessage.trim()) {
      setMessage({ type: 'error', text: 'Subject and message are required.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const created = await request<{ id: string }>('/support/tickets', {
        method: 'POST',
        body: JSON.stringify({
          scope: createScope,
          priority: createPriority,
          subject: createSubject.trim(),
          description: createDescription.trim() || undefined,
          message: createMessage.trim(),
        }),
      });
      setCreateSubject('');
      setCreateDescription('');
      setCreateMessage('');
      await loadTickets();
      if (created?.id) {
        await openTicket(created.id);
      }
      setMessage({ type: 'success', text: 'Support ticket created.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to create ticket',
      });
    } finally {
      setSaving(false);
    }
  }

  async function sendReply(): Promise<void> {
    if (!selectedTicketId || !reply.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await request(`/support/tickets/${selectedTicketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: reply.trim() }),
      });
      await openTicket(selectedTicketId);
      await loadTickets();
      setReply('');
      setMessage({ type: 'success', text: 'Reply sent.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to send reply',
      });
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status: SupportTicketStatus): Promise<void> {
    if (!selectedTicketId) return;
    setSaving(true);
    setMessage(null);
    try {
      await request(`/support/tickets/${selectedTicketId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await Promise.all([openTicket(selectedTicketId), loadTickets()]);
      setMessage({ type: 'success', text: 'Status updated.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update status',
      });
    } finally {
      setSaving(false);
    }
  }

  async function assignTicket(): Promise<void> {
    if (!selectedTicketId) return;
    setSaving(true);
    setMessage(null);
    try {
      await request(`/support/tickets/${selectedTicketId}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({
          assignedToType: assignToStoreUserId.trim() ? 'store_user' : undefined,
          assignedToStoreUserId: assignToStoreUserId.trim() || undefined,
        }),
      });
      await Promise.all([openTicket(selectedTicketId), loadTickets()]);
      setMessage({ type: 'success', text: 'Assignment updated.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to assign ticket',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppPage maxWidth={1400}>
      <PageHeader
        title="مركز الدعم الفني"
        description="إدارة تذاكر B2B و B2C مع الردود والحالة والتعيين."
        actions={
          <Button variant="outlined" onClick={() => loadTickets().catch(() => undefined)} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {message ? <Alert severity={message.type}>{message.text}</Alert> : null}

      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Create Ticket
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 1.5 }}>
          <TextField label="Subject" value={createSubject} onChange={(event) => setCreateSubject(event.target.value)} />
          <TextField select label="Scope" value={createScope} onChange={(event) => setCreateScope(event.target.value as 'b2b' | 'b2c')}>
            <MenuItem value="b2b">B2B</MenuItem>
            <MenuItem value="b2c">B2C</MenuItem>
          </TextField>
          <TextField select label="Priority" value={createPriority} onChange={(event) => setCreatePriority(event.target.value as SupportTicketPriority)}>
            {PRIORITY_OPTIONS.map((item) => (
              <MenuItem key={item} value={item}>{item}</MenuItem>
            ))}
          </TextField>
          <TextField label="Description" value={createDescription} onChange={(event) => setCreateDescription(event.target.value)} sx={{ gridColumn: { xs: '1 / -1', md: '1 / -1' } }} />
          <TextField label="First message" value={createMessage} onChange={(event) => setCreateMessage(event.target.value)} multiline minRows={3} sx={{ gridColumn: { xs: '1 / -1', md: '1 / -1' } }} />
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }}>
          <Button variant="contained" onClick={() => createTicket().catch(() => undefined)} disabled={saving}>
            Create
          </Button>
        </Stack>
      </Paper>

      <FilterBar>
        <TextField placeholder="Search by subject" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ minWidth: 240 }} />
        <TextField select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">All Statuses</MenuItem>
          {STATUS_OPTIONS.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
        </TextField>
        <TextField select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">All Priorities</MenuItem>
          {PRIORITY_OPTIONS.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
        </TextField>
        <Button variant="contained" onClick={() => loadTickets().catch(() => undefined)} disabled={loading}>
          Search
        </Button>
      </FilterBar>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
        <Box sx={{ flex: 1 }}>
          <DataTableWrapper>
          <Box sx={{ p: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {STATUS_OPTIONS.map((item) => (
              <Chip key={item} label={`${item}: ${statusCounts[item] ?? 0}`} size="small" />
            ))}
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Subject</TableCell>
                  <TableCell>Scope</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Requester</TableCell>
                  <TableCell>Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center"><CircularProgress size={22} /></TableCell>
                  </TableRow>
                ) : tickets.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">No tickets found.</TableCell>
                  </TableRow>
                ) : (
                  tickets.items.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      hover
                      selected={ticket.id === selectedTicketId}
                      onClick={() => openTicket(ticket.id).catch(() => undefined)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>{ticket.subject}</TableCell>
                      <TableCell>{ticket.scope}</TableCell>
                      <TableCell><Chip size="small" label={ticket.status} /></TableCell>
                      <TableCell><Chip size="small" label={ticket.priority} color={ticket.priority === 'urgent' ? 'error' : 'default'} /></TableCell>
                      <TableCell>{ticket.requester.name ?? '-'}</TableCell>
                      <TableCell>{new Date(ticket.updatedAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          </DataTableWrapper>
        </Box>

        <Paper elevation={0} sx={{ flex: 1, minHeight: 560, p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          {!selectedTicket ? (
            <Typography color="text.secondary">Select a ticket to view details.</Typography>
          ) : (
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6" fontWeight={700}>{selectedTicket.ticket.subject}</Typography>
                <Typography color="text.secondary">{selectedTicket.ticket.description || 'No description'}</Typography>
              </Box>

              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={`Status: ${selectedTicket.ticket.status}`} />
                <Chip label={`Priority: ${selectedTicket.ticket.priority}`} />
                <Chip label={`Scope: ${selectedTicket.ticket.scope}`} />
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                <TextField
                  select
                  label="Status"
                  value={selectedStatus}
                  onChange={(event) => updateStatus(event.target.value as SupportTicketStatus).catch(() => undefined)}
                  sx={{ minWidth: 220 }}
                  disabled={saving}
                >
                  {STATUS_OPTIONS.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                </TextField>

                <TextField
                  label="Assign to store user id"
                  value={assignToStoreUserId}
                  onChange={(event) => setAssignToStoreUserId(event.target.value)}
                  sx={{ minWidth: 260 }}
                />
                <Button variant="outlined" onClick={() => assignTicket().catch(() => undefined)} disabled={saving}>
                  Assign
                </Button>
              </Stack>

              <Typography variant="subtitle1" fontWeight={700}>Conversation</Typography>
              <Box sx={{ maxHeight: 280, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
                {selectedTicket.messages.length === 0 ? (
                  <Typography color="text.secondary">No messages yet.</Typography>
                ) : (
                  <Stack spacing={1}>
                    {selectedTicket.messages.map((item) => (
                      <Paper key={item.id} variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          {item.authorName ?? item.authorType} • {new Date(item.createdAt).toLocaleString()}
                        </Typography>
                        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{item.message}</Typography>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Box>

              <TextField
                label="Reply"
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                multiline
                minRows={3}
              />
              <Button variant="contained" onClick={() => sendReply().catch(() => undefined)} disabled={saving}>
                Send Reply
              </Button>
            </Stack>
          )}
        </Paper>
      </Stack>
    </AppPage>
  );
}
