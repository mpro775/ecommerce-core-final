import {
  Box,
  Button,
  Checkbox,
  Divider,
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
import { useState } from 'react';
import type { GeneratedVariantDraft } from './variant-types';

interface GeneratedVariantsEditorProps {
  drafts: GeneratedVariantDraft[];
  onUpdateDraft: (id: string, patch: Partial<GeneratedVariantDraft>) => void;
  onRemoveDraft: (id: string) => void;
  onOpenWarehouseDrawer: (draftId: string) => void;
}

export function GeneratedVariantsEditor({
  drafts,
  onUpdateDraft,
  onRemoveDraft,
  onOpenWarehouseDrawer,
}: GeneratedVariantsEditorProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const filteredDrafts = drafts.filter((d) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.trim().toLowerCase();
    return (
      d.title.toLowerCase().includes(query) ||
      d.sku.toLowerCase().includes(query) ||
      d.barcode.toLowerCase().includes(query)
    );
  });

  const pagedDrafts = filteredDrafts.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filteredDrafts.length / pageSize);

  const allVisibleSelected = pagedDrafts.length > 0 && pagedDrafts.every((d) => selectedIds.includes(d.id));

  function toggleSelectAll(): void {
    if (allVisibleSelected) {
      const visibleIds = new Set(pagedDrafts.map((d) => d.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      setSelectedIds((prev) => {
        const existing = new Set(prev);
        pagedDrafts.forEach((d) => existing.add(d.id));
        return [...existing];
      });
    }
  }

  function toggleSelectOne(id: string): void {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
        <TextField
          size="small"
          placeholder="بحث في المتغيرات..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(0);
          }}
          sx={{ minWidth: 240 }}
        />
        <Typography variant="body2" color="text.secondary">
          {filteredDrafts.length} متغير
          {selectedIds.length > 0 ? ` · ${selectedIds.length} محدد` : ''}
        </Typography>
      </Stack>

      <TableContainer
        component={Box}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          maxHeight: 'calc(100vh - 380px)',
          overflow: 'auto',
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={allVisibleSelected}
                  indeterminate={!allVisibleSelected && pagedDrafts.some((d) => selectedIds.includes(d.id))}
                  onChange={toggleSelectAll}
                />
              </TableCell>
              <TableCell>المتغير</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell>الباركود</TableCell>
              <TableCell>السعر</TableCell>
              <TableCell>قبل الخصم</TableCell>
              <TableCell>المخزون</TableCell>
              <TableCell align="left">الإجراء</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pagedDrafts.map((draft) => (
              <TableRow key={draft.id} hover selected={selectedIds.includes(draft.id)}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedIds.includes(draft.id)}
                    onChange={() => toggleSelectOne(draft.id)}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={draft.title}
                    onChange={(e) => onUpdateDraft(draft.id, { title: e.target.value })}
                    variant="standard"
                    sx={{ minWidth: 120 }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={draft.sku}
                    onChange={(e) => onUpdateDraft(draft.id, { sku: e.target.value })}
                    variant="standard"
                    dir="ltr"
                    sx={{ minWidth: 140 }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={draft.barcode}
                    onChange={(e) => onUpdateDraft(draft.id, { barcode: e.target.value })}
                    variant="standard"
                    dir="ltr"
                    sx={{ minWidth: 120 }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    value={draft.price}
                    onChange={(e) => onUpdateDraft(draft.id, { price: e.target.value })}
                    variant="standard"
                    sx={{ minWidth: 90 }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    value={draft.compareAtPrice}
                    onChange={(e) => onUpdateDraft(draft.id, { compareAtPrice: e.target.value })}
                    variant="standard"
                    sx={{ minWidth: 90 }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    value={draft.stockQuantity}
                    onChange={(e) => onUpdateDraft(draft.id, { stockQuantity: e.target.value })}
                    variant="standard"
                    sx={{ minWidth: 80 }}
                  />
                </TableCell>
                <TableCell align="left">
                  <Stack direction="row" spacing={0.5}>
                    <Button size="small" onClick={() => onOpenWarehouseDrawer(draft.id)}>
                      المستودعات
                    </Button>
                    <Button size="small" color="error" onClick={() => onRemoveDraft(draft.id)}>
                      حذف
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {totalPages > 1 ? (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
          <Button size="small" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            السابق
          </Button>
          <Typography variant="body2">
            {page + 1} من {totalPages}
          </Typography>
          <Button size="small" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            التالي
          </Button>
        </Stack>
      ) : null}

      {selectedIds.length > 0 ? (
        <>
          <Divider />
          <Typography variant="caption" color="text.secondary">
            {selectedIds.length} متغير محدد — استخدم الإجراءات الجماعية أعلاه للتطبيق على المحدد فقط.
          </Typography>
        </>
      ) : null}
    </Stack>
  );
}
