import { Button, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { generateEan13, generateSku } from './variant-utils';
import type { GeneratedVariantDraft } from './variant-types';

interface VariantBulkActionsToolbarProps {
  drafts: GeneratedVariantDraft[];
  selectedDraftIds: string[];
  onUpdateDrafts: (patches: Array<{ id: string; patch: Partial<GeneratedVariantDraft> }>) => void;
  onDeleteSelected: () => void;
  productTitle: string;
}

export function VariantBulkActionsToolbar({
  drafts,
  selectedDraftIds,
  onUpdateDrafts,
  onDeleteSelected,
  productTitle,
}: VariantBulkActionsToolbarProps) {
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkCompareAtPrice, setBulkCompareAtPrice] = useState('');
  const [bulkStock, setBulkStock] = useState('');
  const targetDrafts = selectedDraftIds.length > 0
    ? drafts.filter((d) => selectedDraftIds.includes(d.id))
    : drafts;

  const hasTarget = targetDrafts.length > 0;

  function applyBulkPrice(): void {
    if (!bulkPrice || !hasTarget) return;
    onUpdateDrafts(targetDrafts.map((d) => ({ id: d.id, patch: { price: bulkPrice } })));
    setBulkPrice('');
  }

  function applyBulkCompareAtPrice(): void {
    if (!bulkCompareAtPrice || !hasTarget) return;
    onUpdateDrafts(targetDrafts.map((d) => ({ id: d.id, patch: { compareAtPrice: bulkCompareAtPrice } })));
    setBulkCompareAtPrice('');
  }

  function applyBulkStock(): void {
    if (!bulkStock || !hasTarget) return;
    onUpdateDrafts(targetDrafts.map((d) => ({ id: d.id, patch: { stockQuantity: bulkStock } })));
    setBulkStock('');
  }

  function applyBulkSku(): void {
    if (!hasTarget) return;
    const patches = targetDrafts.map((d, i) => ({
      id: d.id,
      patch: { sku: generateSku(`${productTitle} ${d.title}`, i) },
    }));
    onUpdateDrafts(patches);
  }

  function applyBulkBarcode(): void {
    if (!hasTarget) return;
    const patches = targetDrafts.map((d) => ({
      id: d.id,
      patch: { barcode: generateEan13() },
    }));
    onUpdateDrafts(patches);
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2" fontWeight={800}>
        إجراءات جماعية
        {selectedDraftIds.length > 0
          ? ` (${selectedDraftIds.length} محدد)`
          : ` (${drafts.length} متغير)`}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
        <TextField
          size="small"
          type="number"
          label="سعر موحد"
          value={bulkPrice}
          onChange={(e) => setBulkPrice(e.target.value)}
          sx={{ minWidth: 130 }}
        />
        <Button size="small" variant="outlined" onClick={applyBulkPrice} disabled={!bulkPrice || !hasTarget}>
          تطبيق السعر
        </Button>

        <TextField
          size="small"
          type="number"
          label="سعر قبل الخصم"
          value={bulkCompareAtPrice}
          onChange={(e) => setBulkCompareAtPrice(e.target.value)}
          sx={{ minWidth: 130 }}
        />
        <Button size="small" variant="outlined" onClick={applyBulkCompareAtPrice} disabled={!bulkCompareAtPrice || !hasTarget}>
          تطبيق
        </Button>

        <TextField
          size="small"
          type="number"
          label="مخزون موحد"
          value={bulkStock}
          onChange={(e) => setBulkStock(e.target.value)}
          sx={{ minWidth: 130 }}
        />
        <Button size="small" variant="outlined" onClick={applyBulkStock} disabled={!bulkStock || !hasTarget}>
          تطبيق المخزون
        </Button>
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button size="small" variant="outlined" onClick={applyBulkSku} disabled={!hasTarget}>
          توليد SKU للكل
        </Button>
        <Button size="small" variant="outlined" onClick={applyBulkBarcode} disabled={!hasTarget}>
          توليد باركود للكل
        </Button>
        {selectedDraftIds.length > 0 ? (
          <Button size="small" color="error" variant="outlined" onClick={onDeleteSelected}>
            حذف المحدد ({selectedDraftIds.length})
          </Button>
        ) : null}
      </Stack>
    </Stack>
  );
}
