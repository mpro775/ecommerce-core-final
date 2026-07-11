import { Box, Button, MenuItem, Stack, TextField } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilterBar, EcommerceCoreLoader } from '../components/ui';
import type { MerchantRequester } from '../merchant-dashboard.types';

export interface AnalyticsFilterState {
  preset: 7 | 30 | 90;
  from: string;
  to: string;
  timezone: string;
  limit: number;
  liveMinutes: number;
}

export function useAnalyticsFilters(): [AnalyticsFilterState, (next: Partial<AnalyticsFilterState>) => void] {
  const [state, setState] = useState<AnalyticsFilterState>({
    preset: 30,
    from: '',
    to: '',
    timezone: 'Asia/Aden',
    limit: 10,
    liveMinutes: 15,
  });

  const update = useCallback((next: Partial<AnalyticsFilterState>) => {
    setState((prev) => ({ ...prev, ...next }));
  }, []);

  return [state, update];
}

export function buildAnalyticsQuery(filters: AnalyticsFilterState, overrides?: Partial<AnalyticsFilterState>): string {
  const merged = { ...filters, ...(overrides ?? {}) };
  const params = new URLSearchParams();
  params.set('preset', String(merged.preset));
  params.set('limit', String(merged.limit));
  params.set('timezone', merged.timezone);
  if (merged.from) {
    params.set('from', new Date(`${merged.from}T00:00:00.000Z`).toISOString());
  }
  if (merged.to) {
    params.set('to', new Date(`${merged.to}T23:59:59.999Z`).toISOString());
  }
  if (merged.liveMinutes > 0) {
    params.set('liveMinutes', String(merged.liveMinutes));
  }
  return params.toString();
}

export function AnalyticsFiltersBar({
  filters,
  onChange,
  onRefresh,
  includeLiveMinutes = false,
}: {
  filters: AnalyticsFilterState;
  onChange: (next: Partial<AnalyticsFilterState>) => void;
  onRefresh: () => void;
  includeLiveMinutes?: boolean;
}) {
  return (
    <FilterBar>
      <TextField
        select
        size="small"
        label="Preset"
        value={filters.preset}
        onChange={(event) => onChange({ preset: Number(event.target.value) as 7 | 30 | 90 })}
        sx={{ minWidth: 120 }}
      >
        <MenuItem value={7}>7d</MenuItem>
        <MenuItem value={30}>30d</MenuItem>
        <MenuItem value={90}>90d</MenuItem>
      </TextField>
      <TextField
        size="small"
        type="date"
        label="From"
        value={filters.from}
        InputLabelProps={{ shrink: true }}
        onChange={(event) => onChange({ from: event.target.value })}
      />
      <TextField
        size="small"
        type="date"
        label="To"
        value={filters.to}
        InputLabelProps={{ shrink: true }}
        onChange={(event) => onChange({ to: event.target.value })}
      />
      <TextField
        size="small"
        label="Timezone"
        value={filters.timezone}
        onChange={(event) => onChange({ timezone: event.target.value })}
      />
      <TextField
        size="small"
        type="number"
        label="Limit"
        value={filters.limit}
        onChange={(event) => onChange({ limit: Number(event.target.value) || 10 })}
        sx={{ width: 100 }}
      />
      {includeLiveMinutes ? (
        <TextField
          size="small"
          type="number"
          label="Live (min)"
          value={filters.liveMinutes}
          onChange={(event) => onChange({ liveMinutes: Number(event.target.value) || 15 })}
          sx={{ width: 120 }}
        />
      ) : null}
      <Stack sx={{ marginInlineStart: 'auto' }}>
        <Button variant="contained" onClick={onRefresh}>
          Refresh
        </Button>
      </Stack>
    </FilterBar>
  );
}

export function AnalyticsLoadingState() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
      <EcommerceCoreLoader size="md" label="جاري تحديث التحليلات..." compact />
    </Box>
  );
}

export function useAnalyticsData<T>(
  request: MerchantRequester,
  path: string,
  query: string,
  pollMs?: number,
  enabled = true,
): {
  data: T | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string>('');

  const endpoint = useMemo(() => `${path}?${query}`, [path, query]);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = await request<T>(endpoint, { method: 'GET' });
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [enabled, endpoint, request]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError('');
      return;
    }

    refresh().catch(() => undefined);
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !pollMs || pollMs <= 0) {
      return undefined;
    }
    const id = setInterval(() => {
      refresh().catch(() => undefined);
    }, pollMs);
    return () => clearInterval(id);
  }, [enabled, pollMs, refresh]);

  return { data, loading, error, refresh };
}

