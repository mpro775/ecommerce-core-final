import type { GeneratedVariantDraft, ProductWarehouseAllocationRow } from './variant-types';

export function createClientId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeSkuPart(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
  return normalized || 'PRD';
}

export function generateSku(seed: string, existingCount = 0): string {
  const suffix = `${Date.now().toString(36)}${existingCount ? `-${existingCount + 1}` : ''}`.toUpperCase();
  return `${normalizeSkuPart(seed).slice(0, 24)}-${suffix}`;
}

function calculateEan13CheckDigit(firstTwelveDigits: string): number {
  const sum = firstTwelveDigits
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

export function generateEan13(): string {
  const base = `${Date.now()}${Math.floor(Math.random() * 1000000)}`
    .replace(/\D/g, '')
    .slice(-12)
    .padStart(12, '2');
  return `${base}${calculateEan13CheckDigit(base)}`;
}

export function buildWarehouseAllocationsPayload(rows: ProductWarehouseAllocationRow[]) {
  return rows
    .filter((row) => row.enabled)
    .map((row) => ({
      warehouseId: row.warehouseId,
      quantity: Number(row.quantity),
      lowStockThreshold: Number(row.lowStockThreshold),
      ...(row.reorderPoint.trim() ? { reorderPoint: Number(row.reorderPoint) } : {}),
    }));
}

export function validateWarehouseAllocationRows(rows: ProductWarehouseAllocationRow[]): boolean {
  return !buildWarehouseAllocationsPayload(rows).some(
    (row) =>
      !Number.isInteger(row.quantity) ||
      row.quantity < 0 ||
      !Number.isInteger(row.lowStockThreshold) ||
      row.lowStockThreshold < 0 ||
      ('reorderPoint' in row && (!Number.isInteger(row.reorderPoint) || Number(row.reorderPoint) < 0)),
  );
}

export function countMissingPrice(drafts: GeneratedVariantDraft[]): number {
  return drafts.filter((d) => !d.price || Number(d.price) <= 0).length;
}

export function countMissingStock(drafts: GeneratedVariantDraft[]): number {
  return drafts.filter((d) => !d.stockQuantity || Number(d.stockQuantity) <= 0).length;
}

export function calculateCombinationCount(selectedValueIdsByAttributeId: Record<string, string[]>): number {
  const counts = Object.values(selectedValueIdsByAttributeId).map((ids) => ids.length);
  return counts.reduce((acc, count) => acc * count, 1);
}
