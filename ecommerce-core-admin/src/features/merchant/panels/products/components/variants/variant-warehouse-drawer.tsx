import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import type { Warehouse } from '../../../../types';
import { validateWarehouseAllocationRows } from './variant-utils';
import type { ProductWarehouseAllocationRow } from './variant-types';

interface VariantWarehouseDrawerProps {
  open: boolean;
  onClose: () => void;
  onApply?: () => void;
  draftTitle: string;
  warehouses: Warehouse[];
  warehouseRows: ProductWarehouseAllocationRow[];
  onUpdateRow: (warehouseId: string, patch: Partial<ProductWarehouseAllocationRow>) => void;
  isBulk?: boolean;
  bulkCount?: number;
}

export function VariantWarehouseDrawer({
  open,
  onClose,
  onApply,
  draftTitle,
  warehouses,
  warehouseRows,
  onUpdateRow,
  isBulk,
  bulkCount,
}: VariantWarehouseDrawerProps) {
  const isValid = validateWarehouseAllocationRows(warehouseRows);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 900 }}>
        {isBulk
          ? `توزيع المستودعات (${bulkCount} متغير)`
          : `مستودعات المتغير: ${draftTitle}`}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TableContainer component={Box} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>تفعيل</TableCell>
                  <TableCell>المستودع</TableCell>
                  <TableCell>الكمية</TableCell>
                  <TableCell>محجوز</TableCell>
                  <TableCell>حد التنبيه</TableCell>
                  <TableCell>إعادة الطلب</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {warehouseRows.map((row) => {
                  const warehouse = warehouses.find((w) => w.id === row.warehouseId);
                  return (
                    <TableRow key={row.warehouseId}>
                      <TableCell>
                        <Checkbox
                          checked={row.enabled}
                          onChange={(e) => onUpdateRow(row.warehouseId, { enabled: e.target.checked })}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {warehouse?.nameAr || warehouse?.name || '-'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" dir="ltr">
                          {warehouse?.code ?? '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={row.quantity}
                          onChange={(e) => onUpdateRow(row.warehouseId, { quantity: e.target.value })}
                          disabled={!row.enabled}
                          variant="standard"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {row.reservedQuantityReadonly ?? 0}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={row.lowStockThreshold}
                          onChange={(e) => onUpdateRow(row.warehouseId, { lowStockThreshold: e.target.value })}
                          disabled={!row.enabled}
                          variant="standard"
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={row.reorderPoint}
                          onChange={(e) => onUpdateRow(row.warehouseId, { reorderPoint: e.target.value })}
                          disabled={!row.enabled}
                          variant="standard"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          {!isValid ? (
            <Typography variant="caption" color="error">
              تحقق من صحة الكميات (أرقام صحيحة غير سالبة).
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit">
          إغلاق
        </Button>
        {onApply && isBulk ? (
          <Button variant="contained" onClick={onApply} disabled={!isValid}>
            تطبيق على الكل
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
