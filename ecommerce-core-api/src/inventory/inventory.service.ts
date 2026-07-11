import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { RequestContextData } from '../common/utils/request-context.util';
import { OutboxService } from '../messaging/outbox.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import type {
  InventoryMovementType,
  InventoryReservationStatus,
} from './constants/inventory.constants';
import type { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import type { ListInventoryMovementsQueryDto } from './dto/list-inventory-movements-query.dto';
import type { ListInventoryReservationsQueryDto } from './dto/list-inventory-reservations-query.dto';
import {
  InventoryRepository,
  type Queryable,
  type VariantWarehouseStockRecord,
} from './inventory.repository';

export interface InventoryOrderItemInput {
  variantId: string;
  quantity: number;
  sku: string;
}

export interface LowStockSignal {
  storeId: string;
  productId: string;
  variantId: string;
  sku: string;
  stockQuantity: number;
  lowStockThreshold: number;
}

export interface BackInStockSignal {
  storeId: string;
  productId: string;
  variantId: string;
  sku: string;
  stockQuantity: number;
}

export interface InventoryMovementResponse {
  id: string;
  variantId: string;
  orderId: string | null;
  warehouseId: string | null;
  movementType: InventoryMovementType;
  qtyDelta: number;
  note: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: Date;
  productId: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
}

export interface InventoryReservationResponse {
  id: string;
  orderId: string;
  variantId: string;
  warehouseId: string | null;
  quantity: number;
  status: InventoryReservationStatus;
  reservedAt: Date;
  expiresAt: Date;
  releasedAt: Date | null;
  consumedAt: Date | null;
  releaseReason: string | null;
  metadata: Record<string, unknown>;
  updatedAt: Date;
  productId: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
}

export interface InventoryVariantSnapshotResponse {
  variantId: string;
  productId: string;
  sku: string;
  productTitle: string;
  variantTitle: string;
  stockQuantity: number;
  lowStockThreshold: number;
  reservedQuantity: number;
  availableQuantity: number;
}

export interface VariantWithdrawalPriorityResponse {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  isDefault: boolean;
  priority: number;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly outboxService: OutboxService,
    private readonly auditService: AuditService,
    private readonly webhooksService: WebhooksService,
  ) {}

  async releaseExpiredReservations(storeId: string): Promise<number> {
    return this.inventoryRepository.withTransaction((db) =>
      this.releaseExpiredReservationsInTransaction(db, storeId),
    );
  }

  async releaseExpiredReservationsInTransaction(db: Queryable, storeId: string): Promise<number> {
    return this.inventoryRepository.releaseExpiredReservations(db, storeId);
  }

  async getAvailableStock(storeId: string, variantId: string): Promise<number | null> {
    return this.inventoryRepository.findVariantAvailableQuantity(storeId, variantId);
  }

  async syncVariantStockFromWarehouses(
    db: Queryable,
    storeId: string,
    variantId: string,
  ): Promise<void> {
    await this.inventoryRepository.syncVariantStockFromWarehouses(db, storeId, variantId);
  }

  async reserveOrderItems(
    db: Queryable,
    input: {
      storeId: string;
      orderId: string;
      expiresAt: Date;
      items: InventoryOrderItemInput[];
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    for (const item of input.items) {
      const warehouseId = await this.resolvePreferredWarehouse(db, input.storeId, item.variantId);

      const reserveInput: {
        storeId: string;
        orderId: string;
        variantId: string;
        quantity: number;
        expiresAt: Date;
        warehouseId?: string;
        metadata?: Record<string, unknown>;
      } = {
        storeId: input.storeId,
        orderId: input.orderId,
        variantId: item.variantId,
        quantity: item.quantity,
        expiresAt: input.expiresAt,
        warehouseId: warehouseId ?? undefined,
      };

      if (input.metadata) {
        reserveInput.metadata = input.metadata;
      }

      const reserved = await this.inventoryRepository.reserveVariant(db, reserveInput);

      if (!reserved) {
        throw new UnprocessableEntityException(`Insufficient reservable stock for SKU ${item.sku}`);
      }

      if (warehouseId) {
        await this.inventoryRepository.updateWarehouseInventoryReservedQuantity(db, {
          storeId: input.storeId,
          variantId: item.variantId,
          warehouseId,
          reservedQuantity: await this.getWarehouseReservedDelta(
            db,
            input.storeId,
            item.variantId,
            warehouseId,
            item.quantity,
          ),
        });
      }
    }
  }

  private async resolvePreferredWarehouse(
    db: Queryable,
    storeId: string,
    variantId: string,
  ): Promise<string | null> {
    const stocks = await this.inventoryRepository.listVariantWarehouseStocks(storeId, variantId);
    if (stocks.length === 0) {
      return null;
    }
    const preferred = stocks[0];
    return preferred.warehouse_id;
  }

  private async getWarehouseReservedDelta(
    db: Queryable,
    storeId: string,
    variantId: string,
    warehouseId: string,
    additionalReserved: number,
  ): Promise<number> {
    const stocks = await this.inventoryRepository.listVariantWarehouseStocksForUpdate(
      db,
      storeId,
      variantId,
    );
    const current = stocks.find((s) => s.warehouse_id === warehouseId);
    return (current?.reserved_quantity ?? 0) + additionalReserved;
  }

  async confirmReservedOrderItems(
    db: Queryable,
    input: {
      storeId: string;
      orderId: string;
      items: InventoryOrderItemInput[];
      actorId: string | null;
    },
  ): Promise<LowStockSignal[]> {
    const lowStockSignals: LowStockSignal[] = [];

    for (const item of input.items) {
      const consumed = await this.inventoryRepository.consumeReservation(db, {
        storeId: input.storeId,
        orderId: input.orderId,
        variantId: item.variantId,
        quantity: item.quantity,
      });

      if (!consumed) {
        throw new UnprocessableEntityException(
          `Reservation missing or expired for SKU ${item.sku}`,
        );
      }

      const warehousePlan = await this.applyWarehouseStockDelta(db, {
        storeId: input.storeId,
        variantId: item.variantId,
        quantityDelta: -item.quantity,
        lowStockThreshold: 0,
        sku: item.sku,
      });

      await this.inventoryRepository.createMovement(db, {
        storeId: input.storeId,
        variantId: item.variantId,
        orderId: input.orderId,
        movementType: 'sale',
        qtyDelta: -item.quantity,
        note: 'Stock deducted on order confirmation',
        metadata: { source: 'order.status.confirmed', warehousePlan },
        createdBy: input.actorId,
        warehouseId: warehousePlan.length > 0 ? warehousePlan[0].warehouseId : null,
      });

      await this.inventoryRepository.syncVariantStockFromWarehouses(
        db,
        input.storeId,
        item.variantId,
      );

      const snapshotAfter = await this.inventoryRepository.findVariantInventorySnapshot(
        db,
        input.storeId,
        item.variantId,
      );

      if (snapshotAfter) {
        const signal = this.buildLowStockSignal(input.storeId, {
          variant_id: snapshotAfter.variant_id,
          product_id: snapshotAfter.product_id,
          sku: snapshotAfter.sku,
          low_stock_threshold: snapshotAfter.low_stock_threshold,
          previous_stock_quantity: snapshotAfter.stock_quantity + item.quantity,
          current_stock_quantity: snapshotAfter.stock_quantity,
        });
        if (signal) {
          lowStockSignals.push(signal);
        }
      }
    }

    return lowStockSignals;
  }

  async confirmOrderReservations(
    db: Queryable,
    input: {
      storeId: string;
      orderId: string;
      actorId: string | null;
      expiresAt: Date;
    },
  ): Promise<LowStockSignal[]> {
    let reserved = await this.inventoryRepository.listReservedVariantsForOrder(
      db,
      input.storeId,
      input.orderId,
    );

    const expectedItems = await this.inventoryRepository.listReservableOrderItemsForOrder(
      db,
      input.storeId,
      input.orderId,
    );

    if (expectedItems.length === 0) {
      return [];
    }

    const missingItems = this.findMissingReservedItems(expectedItems, reserved);

    if (missingItems.length > 0) {
      await this.reserveOrderItems(db, {
        storeId: input.storeId,
        orderId: input.orderId,
        expiresAt: input.expiresAt,
        items: missingItems,
        metadata: { source: 'order.status.confirmed.reservation_recovered' },
      });

      reserved = await this.inventoryRepository.listReservedVariantsForOrder(
        db,
        input.storeId,
        input.orderId,
      );
    }

    const stillMissingItems = this.findMissingReservedItems(expectedItems, reserved);
    if (stillMissingItems.length > 0) {
      const skus = stillMissingItems.map((item) => item.sku).join(', ');
      throw new UnprocessableEntityException(`Insufficient reservable stock for SKU ${skus}`);
    }

    return this.confirmReservedOrderItems(db, {
      storeId: input.storeId,
      orderId: input.orderId,
      actorId: input.actorId,
      items: expectedItems.map((item) => ({
        variantId: item.variant_id,
        quantity: item.quantity,
        sku: item.sku,
      })),
    });
  }

  private findMissingReservedItems(
    expectedItems: Array<{ variant_id: string; quantity: number; sku: string }>,
    reservedItems: Array<{ variant_id: string; quantity: number }>,
  ): InventoryOrderItemInput[] {
    const reservedByVariant = new Map(
      reservedItems.map((item) => [item.variant_id, item.quantity]),
    );

    return expectedItems
      .filter((item) => reservedByVariant.get(item.variant_id) !== item.quantity)
      .map((item) => ({
        variantId: item.variant_id,
        quantity: item.quantity,
        sku: item.sku,
      }));
  }

  async releaseOrderReservations(
    db: Queryable,
    input: { storeId: string; orderId: string; reason: string },
  ): Promise<void> {
    await this.inventoryRepository.releaseOrderReservations(db, input);
  }

  async restockOrderItems(
    db: Queryable,
    input: {
      storeId: string;
      orderId: string;
      items: InventoryOrderItemInput[];
      actorId: string | null;
      note: string;
      movementType?: InventoryMovementType;
    },
  ): Promise<BackInStockSignal[]> {
    const movementType = input.movementType ?? 'return';
    const backInStockSignals: BackInStockSignal[] = [];

    for (const item of input.items) {
      const warehousePlan = await this.applyWarehouseStockDelta(db, {
        storeId: input.storeId,
        variantId: item.variantId,
        quantityDelta: item.quantity,
        lowStockThreshold: 0,
        sku: item.sku,
      });

      await this.inventoryRepository.createMovement(db, {
        storeId: input.storeId,
        variantId: item.variantId,
        orderId: input.orderId,
        movementType,
        qtyDelta: item.quantity,
        note: input.note,
        metadata: { source: 'order.status.restock', warehousePlan },
        createdBy: input.actorId,
        warehouseId: warehousePlan.length > 0 ? warehousePlan[0].warehouseId : null,
      });

      await this.inventoryRepository.syncVariantStockFromWarehouses(
        db,
        input.storeId,
        item.variantId,
      );

      const snapshotAfter = await this.inventoryRepository.findVariantInventorySnapshot(
        db,
        input.storeId,
        item.variantId,
      );

      const backInStockSignal = snapshotAfter
        ? this.buildBackInStockSignal(input.storeId, {
            variant_id: snapshotAfter.variant_id,
            product_id: snapshotAfter.product_id,
            sku: snapshotAfter.sku,
            previous_stock_quantity: snapshotAfter.stock_quantity - item.quantity,
            current_stock_quantity: snapshotAfter.stock_quantity,
          })
        : null;
      if (backInStockSignal) {
        backInStockSignals.push(backInStockSignal);
      }
    }

    return backInStockSignals;
  }

  async restockOrderSales(
    db: Queryable,
    input: {
      storeId: string;
      orderId: string;
      actorId: string | null;
      note: string;
      movementType?: InventoryMovementType;
    },
  ): Promise<BackInStockSignal[]> {
    const sold = await this.inventoryRepository.listSoldVariantsForOrder(
      db,
      input.storeId,
      input.orderId,
    );

    if (sold.length === 0) {
      return [];
    }

    return this.restockOrderItems(db, {
      storeId: input.storeId,
      orderId: input.orderId,
      actorId: input.actorId,
      note: input.note,
      ...(input.movementType ? { movementType: input.movementType } : {}),
      items: sold.map((item) => ({
        variantId: item.variant_id,
        quantity: item.quantity,
        sku: item.sku,
      })),
    });
  }

  async adjustVariantStock(
    currentUser: AuthUser,
    variantId: string,
    input: AdjustInventoryDto,
    context: RequestContextData,
  ): Promise<InventoryVariantSnapshotResponse> {
    const quantityDelta = input.quantityDelta;
    if (quantityDelta === 0) {
      throw new BadRequestException('quantityDelta cannot be zero');
    }

    const result = await this.executeVariantAdjustment(
      currentUser,
      variantId,
      input.warehouseId,
      quantityDelta,
      input.note?.trim() ?? null,
    );

    if (result.signal) {
      await this.publishLowStockAlerts([result.signal]);
    }
    if (result.backInStockSignal) {
      await this.publishBackInStockAlerts([result.backInStockSignal]);
    }

    await this.logInventoryAdjustment(currentUser, variantId, quantityDelta, input.note, context);
    await this.webhooksService.dispatchEvent(currentUser.storeId, 'inventory.updated', {
      variantId: result.snapshot.variant_id,
      productId: result.snapshot.product_id,
      sku: result.snapshot.sku,
      stockQuantity: result.snapshot.stock_quantity,
      reservedQuantity: result.snapshot.reserved_quantity,
      availableQuantity: result.snapshot.available_quantity,
      lowStockThreshold: result.snapshot.low_stock_threshold,
      reason: 'inventory.adjusted',
    });

    return this.mapVariantSnapshot(result.snapshot);
  }

  async updateLowStockThreshold(
    currentUser: AuthUser,
    variantId: string,
    lowStockThreshold: number,
    context: RequestContextData,
  ): Promise<InventoryVariantSnapshotResponse> {
    const snapshot = await this.inventoryRepository.withTransaction(async (db) => {
      const updated = await this.inventoryRepository.updateVariantLowStockThreshold(db, {
        storeId: currentUser.storeId,
        variantId,
        lowStockThreshold,
      });

      if (!updated) {
        throw new NotFoundException('Variant not found');
      }

      return updated;
    });

    await this.auditService.log({
      action: 'inventory.low_stock_threshold_updated',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'product_variant',
      targetId: variantId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        lowStockThreshold,
        requestId: context.requestId,
      },
    });

    if (
      snapshot.low_stock_threshold > 0 &&
      snapshot.stock_quantity <= snapshot.low_stock_threshold
    ) {
      await this.publishLowStockAlerts([
        {
          storeId: currentUser.storeId,
          productId: snapshot.product_id,
          variantId: snapshot.variant_id,
          sku: snapshot.sku,
          stockQuantity: snapshot.stock_quantity,
          lowStockThreshold: snapshot.low_stock_threshold,
        },
      ]);
    }

    await this.webhooksService.dispatchEvent(currentUser.storeId, 'inventory.updated', {
      variantId: snapshot.variant_id,
      productId: snapshot.product_id,
      sku: snapshot.sku,
      stockQuantity: snapshot.stock_quantity,
      reservedQuantity: snapshot.reserved_quantity,
      availableQuantity: snapshot.available_quantity,
      lowStockThreshold: snapshot.low_stock_threshold,
      reason: 'inventory.low_stock_threshold_updated',
    });

    return this.mapVariantSnapshot(snapshot);
  }

  async listMovements(currentUser: AuthUser, query: ListInventoryMovementsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const data = await this.inventoryRepository.listMovements({
      storeId: currentUser.storeId,
      ...(query.variantId ? { variantId: query.variantId } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.movementType ? { movementType: query.movementType } : {}),
      limit,
      offset: (page - 1) * limit,
    });

    return {
      items: data.rows.map((row) => this.mapMovement(row)),
      total: data.total,
      page,
      limit,
    };
  }

  async listReservations(currentUser: AuthUser, query: ListInventoryReservationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const data = await this.inventoryRepository.listReservations({
      storeId: currentUser.storeId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.variantId ? { variantId: query.variantId } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
      limit,
      offset: (page - 1) * limit,
    });

    return {
      items: data.rows.map((row) => this.mapReservation(row)),
      total: data.total,
      page,
      limit,
    };
  }

  async listLowStockAlerts(currentUser: AuthUser): Promise<InventoryVariantSnapshotResponse[]> {
    const rows = await this.inventoryRepository.listLowStockVariants(currentUser.storeId);
    return rows.map((row) => this.mapVariantSnapshot(row));
  }

  async listVariantWithdrawalPriority(
    currentUser: AuthUser,
    variantId: string,
  ): Promise<VariantWithdrawalPriorityResponse[]> {
    const availableStock = await this.inventoryRepository.findVariantAvailableQuantity(
      currentUser.storeId,
      variantId,
    );
    if (availableStock === null) {
      throw new NotFoundException('Variant not found');
    }

    const rows = await this.inventoryRepository.listVariantWarehouseStocks(
      currentUser.storeId,
      variantId,
    );
    return rows.map((row) => this.mapVariantWarehouseStock(row));
  }

  async publishLowStockAlerts(signals: LowStockSignal[]): Promise<void> {
    const dedupedSignals = new Map<string, LowStockSignal>();

    for (const signal of signals) {
      dedupedSignals.set(`${signal.storeId}:${signal.variantId}`, signal);
    }

    for (const signal of dedupedSignals.values()) {
      await this.outboxService.enqueue({
        aggregateType: 'inventory',
        aggregateId: signal.variantId,
        eventType: signal.stockQuantity <= 0 ? 'inventory.out_of_stock' : 'inventory.low_stock',
        payload: {
          storeId: signal.storeId,
          productId: signal.productId,
          variantId: signal.variantId,
          sku: signal.sku,
          productTitle: signal.sku,
          currentStock: signal.stockQuantity,
          threshold: signal.lowStockThreshold,
          stockQuantity: signal.stockQuantity,
          lowStockThreshold: signal.lowStockThreshold,
          observedAt: new Date().toISOString(),
          source: 'inventory_signal',
        },
      });
    }
  }

  async publishBackInStockAlerts(signals: BackInStockSignal[]): Promise<void> {
    const dedupedSignals = new Map<string, BackInStockSignal>();

    for (const signal of signals) {
      dedupedSignals.set(`${signal.storeId}:${signal.variantId}`, signal);
    }

    for (const signal of dedupedSignals.values()) {
      await this.outboxService.enqueue({
        aggregateType: 'inventory',
        aggregateId: signal.variantId,
        eventType: 'inventory.back_in_stock',
        payload: {
          storeId: signal.storeId,
          productId: signal.productId,
          variantId: signal.variantId,
          sku: signal.sku,
          stockQuantity: signal.stockQuantity,
          observedAt: new Date().toISOString(),
        },
      });
    }
  }

  private async executeVariantAdjustment(
    currentUser: AuthUser,
    variantId: string,
    warehouseId: string,
    quantityDelta: number,
    note: string | null,
  ): Promise<{
    snapshot: {
      variant_id: string;
      product_id: string;
      sku: string;
      product_title: string;
      variant_title: string;
      stock_quantity: number;
      low_stock_threshold: number;
      reserved_quantity: number;
      available_quantity: number;
    };
    signal: LowStockSignal | null;
    backInStockSignal: BackInStockSignal | null;
  }> {
    return this.inventoryRepository.withTransaction(async (db) => {
      await this.requireVariantSnapshot(db, currentUser.storeId, variantId);
      const movementType: InventoryMovementType = quantityDelta > 0 ? 'restock' : 'adjustment';

      if (quantityDelta > 0) {
        await this.inventoryRepository.updateWarehouseInventoryQuantityDelta(db, {
          storeId: currentUser.storeId,
          variantId,
          warehouseId,
          quantityDelta,
        });
      } else {
        await this.inventoryRepository.updateWarehouseInventoryQuantity(db, {
          storeId: currentUser.storeId,
          variantId,
          warehouseId,
          quantity: await this.getUpdatedWarehouseQuantity(
            db,
            currentUser.storeId,
            variantId,
            warehouseId,
            quantityDelta,
          ),
        });
      }

      await this.inventoryRepository.syncVariantStockFromWarehouses(
        db,
        currentUser.storeId,
        variantId,
      );

      await this.inventoryRepository.createMovement(db, {
        storeId: currentUser.storeId,
        variantId,
        orderId: null,
        movementType,
        qtyDelta: quantityDelta,
        note,
        metadata: { source: 'inventory.adjustment', warehouseId },
        createdBy: currentUser.id,
        warehouseId,
      });

      const snapshotAfter = await this.requireVariantSnapshot(db, currentUser.storeId, variantId);
      const snapshotBefore = {
        ...snapshotAfter,
        stock_quantity: snapshotAfter.stock_quantity - quantityDelta,
      };

      return {
        snapshot: snapshotAfter,
        signal: this.buildLowStockSignal(currentUser.storeId, {
          variant_id: snapshotAfter.variant_id,
          product_id: snapshotAfter.product_id,
          sku: snapshotAfter.sku,
          low_stock_threshold: snapshotAfter.low_stock_threshold,
          previous_stock_quantity: snapshotBefore.stock_quantity,
          current_stock_quantity: snapshotAfter.stock_quantity,
        }),
        backInStockSignal: this.buildBackInStockSignal(currentUser.storeId, {
          variant_id: snapshotAfter.variant_id,
          product_id: snapshotAfter.product_id,
          sku: snapshotAfter.sku,
          previous_stock_quantity: snapshotBefore.stock_quantity,
          current_stock_quantity: snapshotAfter.stock_quantity,
        }),
      };
    });
  }

  private async getUpdatedWarehouseQuantity(
    db: Queryable,
    storeId: string,
    variantId: string,
    warehouseId: string,
    quantityDelta: number,
  ): Promise<number> {
    const stocks = await this.inventoryRepository.listVariantWarehouseStocksForUpdate(
      db,
      storeId,
      variantId,
    );
    const current = stocks.find((s) => s.warehouse_id === warehouseId);
    if (!current) {
      throw new NotFoundException('Warehouse allocation not found for this variant');
    }
    const newQty = current.quantity + quantityDelta;
    if (newQty < current.reserved_quantity) {
      throw new BadRequestException('Cannot reduce quantity below reserved quantity');
    }
    return newQty;
  }

  private async requireVariantSnapshot(
    db: Queryable,
    storeId: string,
    variantId: string,
  ): Promise<{
    variant_id: string;
    product_id: string;
    sku: string;
    product_title: string;
    variant_title: string;
    stock_quantity: number;
    low_stock_threshold: number;
    reserved_quantity: number;
    available_quantity: number;
  }> {
    const snapshot = await this.inventoryRepository.findVariantInventorySnapshot(
      db,
      storeId,
      variantId,
    );
    if (!snapshot) {
      throw new NotFoundException('Variant not found');
    }
    return snapshot;
  }

  private async applyVariantStockChange(
    db: Queryable,
    storeId: string,
    variantId: string,
    quantityDelta: number,
  ): Promise<{
    variant_id: string;
    product_id: string;
    sku: string;
    low_stock_threshold: number;
    previous_stock_quantity: number;
    current_stock_quantity: number;
  }> {
    const absoluteQuantity = Math.abs(quantityDelta);
    const stockChange =
      quantityDelta > 0
        ? await this.inventoryRepository.increaseVariantStock(db, {
            storeId,
            variantId,
            quantity: absoluteQuantity,
          })
        : await this.inventoryRepository.decreaseVariantStock(db, {
            storeId,
            variantId,
            quantity: absoluteQuantity,
          });

    if (!stockChange) {
      throw new UnprocessableEntityException('Insufficient stock for adjustment');
    }

    return stockChange;
  }

  private async logInventoryAdjustment(
    currentUser: AuthUser,
    variantId: string,
    quantityDelta: number,
    note: string | undefined,
    context: RequestContextData,
  ): Promise<void> {
    await this.auditService.log({
      action: 'inventory.adjusted',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'product_variant',
      targetId: variantId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        quantityDelta,
        note: note?.trim() ?? null,
        requestId: context.requestId,
      },
    });
  }

  private buildLowStockSignal(
    storeId: string,
    stockChange: {
      variant_id: string;
      product_id: string;
      sku: string;
      low_stock_threshold: number;
      previous_stock_quantity: number;
      current_stock_quantity: number;
    },
  ): LowStockSignal | null {
    const threshold = stockChange.low_stock_threshold;
    if (threshold <= 0) {
      return null;
    }

    const crossedThresholdDownward =
      stockChange.previous_stock_quantity > threshold &&
      stockChange.current_stock_quantity <= threshold;

    if (!crossedThresholdDownward) {
      return null;
    }

    return {
      storeId,
      productId: stockChange.product_id,
      variantId: stockChange.variant_id,
      sku: stockChange.sku,
      stockQuantity: stockChange.current_stock_quantity,
      lowStockThreshold: threshold,
    };
  }

  private buildBackInStockSignal(
    storeId: string,
    stockChange: {
      variant_id: string;
      product_id: string;
      sku: string;
      previous_stock_quantity: number;
      current_stock_quantity: number;
    },
  ): BackInStockSignal | null {
    if (stockChange.previous_stock_quantity > 0 || stockChange.current_stock_quantity <= 0) {
      return null;
    }

    return {
      storeId,
      productId: stockChange.product_id,
      variantId: stockChange.variant_id,
      sku: stockChange.sku,
      stockQuantity: stockChange.current_stock_quantity,
    };
  }

  private async applyWarehouseStockDelta(
    db: Queryable,
    input: {
      storeId: string;
      variantId: string;
      quantityDelta: number;
      lowStockThreshold: number;
      sku?: string;
    },
  ): Promise<
    Array<{
      warehouseId: string;
      warehouseCode: string;
      warehouseName: string;
      quantityDelta: number;
    }>
  > {
    if (input.quantityDelta === 0) {
      return [];
    }

    const stocks = await this.inventoryRepository.listVariantWarehouseStocksForUpdate(
      db,
      input.storeId,
      input.variantId,
    );

    if (stocks.length === 0) {
      if (input.quantityDelta > 0) {
        const preferredWarehouse = await this.inventoryRepository.findPreferredWarehouse(
          db,
          input.storeId,
        );
        if (!preferredWarehouse) {
          return [];
        }

        await this.inventoryRepository.upsertVariantWarehouseStock(db, {
          storeId: input.storeId,
          variantId: input.variantId,
          warehouseId: preferredWarehouse.id,
          quantity: input.quantityDelta,
          lowStockThreshold: input.lowStockThreshold,
        });

        return [
          {
            warehouseId: preferredWarehouse.id,
            warehouseCode: preferredWarehouse.code,
            warehouseName: preferredWarehouse.name,
            quantityDelta: input.quantityDelta,
          },
        ];
      }

      return [];
    }

    if (input.quantityDelta > 0) {
      const target = stocks[0] as VariantWarehouseStockRecord;
      await this.inventoryRepository.updateWarehouseInventoryQuantity(db, {
        storeId: input.storeId,
        variantId: input.variantId,
        warehouseId: target.warehouse_id,
        quantity: target.quantity + input.quantityDelta,
      });

      return [
        {
          warehouseId: target.warehouse_id,
          warehouseCode: target.warehouse_code,
          warehouseName: target.warehouse_name,
          quantityDelta: input.quantityDelta,
        },
      ];
    }

    let required = Math.abs(input.quantityDelta);
    const totalAvailable = stocks.reduce((sum, row) => {
      return sum + Math.max(row.quantity - row.reserved_quantity, 0);
    }, 0);

    if (totalAvailable < required) {
      throw new UnprocessableEntityException(
        `Insufficient prioritized warehouse stock for SKU ${input.sku ?? input.variantId}`,
      );
    }

    const plan: Array<{
      warehouseId: string;
      warehouseCode: string;
      warehouseName: string;
      quantityDelta: number;
    }> = [];

    for (const stock of stocks) {
      if (required <= 0) {
        break;
      }

      const availableInWarehouse = Math.max(stock.quantity - stock.reserved_quantity, 0);
      if (availableInWarehouse <= 0) {
        continue;
      }

      const deducted = Math.min(availableInWarehouse, required);
      await this.inventoryRepository.updateWarehouseInventoryQuantity(db, {
        storeId: input.storeId,
        variantId: input.variantId,
        warehouseId: stock.warehouse_id,
        quantity: stock.quantity - deducted,
      });

      plan.push({
        warehouseId: stock.warehouse_id,
        warehouseCode: stock.warehouse_code,
        warehouseName: stock.warehouse_name,
        quantityDelta: -deducted,
      });

      required -= deducted;
    }

    return plan;
  }

  private mapVariantWarehouseStock(
    row: VariantWarehouseStockRecord,
  ): VariantWithdrawalPriorityResponse {
    const availableQuantity = Math.max(row.quantity - row.reserved_quantity, 0);
    return {
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouse_name,
      warehouseCode: row.warehouse_code,
      isDefault: row.is_default,
      priority: row.priority,
      quantity: row.quantity,
      reservedQuantity: row.reserved_quantity,
      availableQuantity,
    };
  }

  private mapMovement(row: {
    id: string;
    variant_id: string;
    order_id: string | null;
    warehouse_id: string | null;
    movement_type: InventoryMovementType;
    qty_delta: number;
    note: string | null;
    metadata: Record<string, unknown>;
    created_by: string | null;
    created_at: Date;
    product_id: string;
    product_title: string;
    variant_title: string;
    sku: string;
  }): InventoryMovementResponse {
    return {
      id: row.id,
      variantId: row.variant_id,
      orderId: row.order_id,
      warehouseId: row.warehouse_id,
      movementType: row.movement_type,
      qtyDelta: row.qty_delta,
      note: row.note,
      metadata: row.metadata ?? {},
      createdBy: row.created_by,
      createdAt: row.created_at,
      productId: row.product_id,
      productTitle: row.product_title,
      variantTitle: row.variant_title,
      sku: row.sku,
    };
  }

  private mapReservation(row: {
    id: string;
    order_id: string;
    variant_id: string;
    warehouse_id: string | null;
    quantity: number;
    status: InventoryReservationStatus;
    reserved_at: Date;
    expires_at: Date;
    released_at: Date | null;
    consumed_at: Date | null;
    release_reason: string | null;
    metadata: Record<string, unknown>;
    updated_at: Date;
    product_id: string;
    product_title: string;
    variant_title: string;
    sku: string;
  }): InventoryReservationResponse {
    return {
      id: row.id,
      orderId: row.order_id,
      variantId: row.variant_id,
      warehouseId: row.warehouse_id,
      quantity: row.quantity,
      status: row.status,
      reservedAt: row.reserved_at,
      expiresAt: row.expires_at,
      releasedAt: row.released_at,
      consumedAt: row.consumed_at,
      releaseReason: row.release_reason,
      metadata: row.metadata ?? {},
      updatedAt: row.updated_at,
      productId: row.product_id,
      productTitle: row.product_title,
      variantTitle: row.variant_title,
      sku: row.sku,
    };
  }

  private mapVariantSnapshot(row: {
    variant_id: string;
    product_id: string;
    sku: string;
    product_title: string;
    variant_title: string;
    stock_quantity: number;
    low_stock_threshold: number;
    reserved_quantity: number;
    available_quantity: number;
  }): InventoryVariantSnapshotResponse {
    return {
      variantId: row.variant_id,
      productId: row.product_id,
      sku: row.sku,
      productTitle: row.product_title,
      variantTitle: row.variant_title,
      stockQuantity: row.stock_quantity,
      lowStockThreshold: row.low_stock_threshold,
      reservedQuantity: row.reserved_quantity,
      availableQuantity: row.available_quantity,
    };
  }
}
