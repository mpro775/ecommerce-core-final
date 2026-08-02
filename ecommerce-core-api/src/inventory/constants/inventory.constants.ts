export const INVENTORY_MOVEMENT_TYPES = ['adjustment', 'sale', 'return', 'restock'] as const;

export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

export const INVENTORY_RESERVATION_STATUSES = [
  'active',
  'consumed',
  'released',
  'expired',
] as const;

export type InventoryReservationStatus = (typeof INVENTORY_RESERVATION_STATUSES)[number];
