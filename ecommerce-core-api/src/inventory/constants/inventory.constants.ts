export const INVENTORY_MOVEMENT_TYPES = ['adjustment', 'sale', 'return', 'restock'] as const;

export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

export const INVENTORY_RESERVATION_STATUSES = ['reserved', 'released', 'consumed'] as const;

export type InventoryReservationStatus = (typeof INVENTORY_RESERVATION_STATUSES)[number];
