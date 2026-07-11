import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { RequestContextData } from '../common/utils/request-context.util';
import type { CreateWarehouseDto } from './dto/create-warehouse.dto';
import type { ReplaceProductWarehouseLinksDto } from './dto/replace-product-warehouse-links.dto';
import type {
  ReplaceVariantWarehouseAllocationsDto,
  VariantWarehouseAllocationDto,
} from './dto/replace-variant-warehouse-allocations.dto';
import type { UpdateWarehousePriorityOrderDto } from './dto/update-warehouse-priority-order.dto';
import type { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import {
  WarehousesRepository,
  type ProductWarehouseLinkRecord,
  type VariantWarehouseAllocationRecord,
  type WarehouseRecord,
} from './warehouses.repository';

export interface WarehouseResponse {
  id: string;
  storeId: string;
  name: string;
  nameAr: string;
  nameEn: string;
  code: string;
  isDefault: boolean;
  isActive: boolean;
  country: string;
  city: string;
  branch: string;
  district: string;
  street: string;
  shortAddress: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  geolocation: Record<string, unknown> | null;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductWarehouseLinkResponse {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseNameAr: string | null;
  warehouseNameEn: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface VariantWarehouseAllocationResponse {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseNameAr: string | null;
  warehouseNameEn: string | null;
  isDefault: boolean;
  isActive: boolean;
  quantity: number;
  reservedQuantity: number;
  lowStockThreshold: number | null;
  reorderPoint: number | null;
}

@Injectable()
export class WarehousesService {
  constructor(
    private readonly warehousesRepository: WarehousesRepository,
    private readonly auditService: AuditService,
  ) {}

  async list(currentUser: AuthUser): Promise<WarehouseResponse[]> {
    const rows = await this.warehousesRepository.listByStore(currentUser.storeId);
    return rows.map((row) => this.toWarehouseResponse(row));
  }

  async create(
    currentUser: AuthUser,
    input: CreateWarehouseDto,
    context: RequestContextData,
  ): Promise<WarehouseResponse> {
    const payload = this.buildCreatePayload(input);
    const currentDefault = await this.warehousesRepository.findDefaultByStore(currentUser.storeId);
    const shouldBeDefault = payload.isDefault || currentDefault === null;

    try {
      const created = await this.warehousesRepository.withTransaction(async (db) => {
        if (shouldBeDefault) {
          await this.warehousesRepository.unsetDefaultForStore(db, currentUser.storeId);
        }

        return this.warehousesRepository.create(db, {
          storeId: currentUser.storeId,
          name: payload.nameAr,
          nameAr: payload.nameAr,
          nameEn: payload.nameEn,
          code: payload.code,
          address: payload.address,
          shortAddress: payload.shortAddress,
          city: payload.city,
          country: payload.country,
          branch: payload.branch,
          district: payload.district,
          street: payload.street,
          phone: payload.phone,
          email: payload.email,
          geolocation: payload.geolocation,
          latitude: payload.latitude,
          longitude: payload.longitude,
          isDefault: shouldBeDefault,
          isActive: payload.isActive,
          priority: payload.priority,
        });
      });

      await this.logAction('warehouses.created', currentUser, created.id, context, {
        code: created.code,
      });

      return this.toWarehouseResponse(created);
    } catch (error) {
      this.throwOnUniqueViolation(error, 'Warehouse code already in use for this store');
      throw error;
    }
  }

  async update(
    currentUser: AuthUser,
    warehouseId: string,
    input: UpdateWarehouseDto,
    context: RequestContextData,
  ): Promise<WarehouseResponse> {
    const existing = await this.warehousesRepository.findById(currentUser.storeId, warehouseId);
    if (!existing) {
      throw new NotFoundException('Warehouse not found');
    }

    const payload = this.buildUpdatePayload(existing, input);

    try {
      const updated = await this.warehousesRepository.withTransaction(async (db) => {
        if (payload.isDefault) {
          await this.warehousesRepository.unsetDefaultForStore(
            db,
            currentUser.storeId,
            warehouseId,
          );
        }

        const row = await this.warehousesRepository.update(db, {
          storeId: currentUser.storeId,
          warehouseId,
          name: payload.nameAr,
          nameAr: payload.nameAr,
          nameEn: payload.nameEn,
          code: payload.code,
          address: payload.address,
          shortAddress: payload.shortAddress,
          city: payload.city,
          country: payload.country,
          branch: payload.branch,
          district: payload.district,
          street: payload.street,
          phone: payload.phone,
          email: payload.email,
          geolocation: payload.geolocation,
          latitude: payload.latitude,
          longitude: payload.longitude,
          isDefault: payload.isDefault,
          isActive: payload.isActive,
          priority: payload.priority,
        });

        if (!row) {
          throw new NotFoundException('Warehouse not found');
        }

        const defaultAfterUpdate = await this.warehousesRepository.findDefaultByStore(
          currentUser.storeId,
        );
        if (defaultAfterUpdate === null) {
          const recoveredDefault = await this.warehousesRepository.markAsDefault(
            db,
            currentUser.storeId,
            warehouseId,
          );
          if (!recoveredDefault) {
            throw new NotFoundException('Warehouse not found');
          }
          return recoveredDefault;
        }

        return row;
      });

      await this.logAction('warehouses.updated', currentUser, warehouseId, context, {
        code: updated.code,
      });

      return this.toWarehouseResponse(updated);
    } catch (error) {
      this.throwOnUniqueViolation(error, 'Warehouse code already in use for this store');
      throw error;
    }
  }

  async setDefault(
    currentUser: AuthUser,
    warehouseId: string,
    context: RequestContextData,
  ): Promise<WarehouseResponse> {
    const existing = await this.warehousesRepository.findById(currentUser.storeId, warehouseId);
    if (!existing) {
      throw new NotFoundException('Warehouse not found');
    }

    const updated = await this.warehousesRepository.withTransaction(async (db) => {
      await this.warehousesRepository.unsetDefaultForStore(db, currentUser.storeId, warehouseId);
      const row = await this.warehousesRepository.markAsDefault(
        db,
        currentUser.storeId,
        warehouseId,
      );
      if (!row) {
        throw new NotFoundException('Warehouse not found');
      }
      return row;
    });

    await this.logAction('warehouses.default_updated', currentUser, warehouseId, context, {});
    return this.toWarehouseResponse(updated);
  }

  async updatePriorityOrder(
    currentUser: AuthUser,
    input: UpdateWarehousePriorityOrderDto,
    context: RequestContextData,
  ): Promise<WarehouseResponse[]> {
    if (input.warehouseIds.length === 0) {
      throw new BadRequestException('warehouseIds cannot be empty');
    }

    await this.ensureWarehousesBelongToStore(currentUser.storeId, input.warehouseIds);

    await this.warehousesRepository.withTransaction(async (db) => {
      const maxPriority = input.warehouseIds.length;
      for (let index = 0; index < input.warehouseIds.length; index += 1) {
        const warehouseId = input.warehouseIds[index] as string;
        await this.warehousesRepository.updateWarehousePriority(db, {
          storeId: currentUser.storeId,
          warehouseId,
          priority: maxPriority - index,
        });
      }
    });

    await this.logAction(
      'warehouses.priority_order_updated',
      currentUser,
      currentUser.storeId,
      context,
      {
        warehouseIds: input.warehouseIds,
      },
    );

    return this.list(currentUser);
  }

  async listProductLinks(
    currentUser: AuthUser,
    productId: string,
  ): Promise<ProductWarehouseLinkResponse[]> {
    await this.ensureProductExists(currentUser.storeId, productId);
    const rows = await this.warehousesRepository.listProductLinks(currentUser.storeId, productId);
    return rows.map((row) => this.toProductWarehouseLinkResponse(row));
  }

  async replaceProductLinks(
    currentUser: AuthUser,
    productId: string,
    input: ReplaceProductWarehouseLinksDto,
    context: RequestContextData,
  ): Promise<ProductWarehouseLinkResponse[]> {
    await this.ensureProductExists(currentUser.storeId, productId);
    const variantCount = await this.warehousesRepository.countProductVariants(
      currentUser.storeId,
      productId,
    );
    if (variantCount > 0) {
      throw new BadRequestException(
        'Product already has variants. Use variant warehouse allocations instead.',
      );
    }

    await this.ensureWarehousesBelongToStore(currentUser.storeId, input.warehouseIds);

    const rows = await this.warehousesRepository.withTransaction(async (db) => {
      await this.warehousesRepository.clearProductLinks(db, currentUser.storeId, productId);
      for (const warehouseId of input.warehouseIds) {
        await this.warehousesRepository.insertProductLink(db, {
          storeId: currentUser.storeId,
          productId,
          warehouseId,
        });
      }
      return this.warehousesRepository.listProductLinks(currentUser.storeId, productId);
    });

    await this.logAction('warehouses.product_links_replaced', currentUser, productId, context, {
      linksCount: rows.length,
    });

    return rows.map((row) => this.toProductWarehouseLinkResponse(row));
  }

  async listVariantAllocations(
    currentUser: AuthUser,
    variantId: string,
  ): Promise<VariantWarehouseAllocationResponse[]> {
    await this.ensureVariantExists(currentUser.storeId, variantId);
    const rows = await this.warehousesRepository.listVariantAllocations(
      currentUser.storeId,
      variantId,
    );
    return rows.map((row) => this.toVariantWarehouseAllocationResponse(row));
  }

  async replaceVariantAllocations(
    currentUser: AuthUser,
    variantId: string,
    input: ReplaceVariantWarehouseAllocationsDto,
    context: RequestContextData,
  ): Promise<VariantWarehouseAllocationResponse[]> {
    const variant = await this.ensureVariantExists(currentUser.storeId, variantId);
    this.ensureNoDuplicateWarehouseIds(input.allocations);
    const warehouseIds = input.allocations.map((item) => item.warehouseId);
    await this.ensureWarehousesBelongToStore(currentUser.storeId, warehouseIds);

    for (const allocation of input.allocations) {
      if (allocation.quantity < 0) {
        throw new BadRequestException('Quantity cannot be negative in warehouse allocation');
      }
    }

    const totalStock = input.allocations.reduce((sum, row) => sum + row.quantity, 0);

    const rows = await this.warehousesRepository.withTransaction(async (db) => {
      for (const allocation of input.allocations) {
        await this.warehousesRepository.upsertVariantAllocation(db, {
          storeId: currentUser.storeId,
          warehouseId: allocation.warehouseId,
          variantId,
          quantity: allocation.quantity,
          reservedQuantity: 0,
          lowStockThreshold: allocation.lowStockThreshold ?? variant.low_stock_threshold,
          reorderPoint: allocation.reorderPoint ?? null,
        });
      }

      await this.warehousesRepository.deleteVariantAllocationsNotInWarehouses(db, {
        storeId: currentUser.storeId,
        variantId,
        warehouseIds,
      });

      await this.warehousesRepository.updateVariantStockQuantity(db, {
        storeId: currentUser.storeId,
        variantId,
        stockQuantity: totalStock,
      });

      return this.warehousesRepository.listVariantAllocations(currentUser.storeId, variantId);
    });

    await this.logAction(
      'warehouses.variant_allocations_replaced',
      currentUser,
      variantId,
      context,
      {
        warehousesCount: rows.length,
        stockQuantity: totalStock,
      },
    );

    return rows.map((row) => this.toVariantWarehouseAllocationResponse(row));
  }

  async assignInitialVariantAllocation(input: {
    storeId: string;
    productId: string;
    variantId: string;
    stockQuantity: number;
    lowStockThreshold: number;
  }): Promise<void> {
    const quantity = Math.max(0, input.stockQuantity);
    const preferred = await this.warehousesRepository.findBestForProduct(
      input.storeId,
      input.productId,
    );
    if (!preferred) {
      return;
    }

    await this.warehousesRepository.withTransaction(async (db) => {
      await this.warehousesRepository.upsertVariantAllocationInWarehouse(db, {
        storeId: input.storeId,
        warehouseId: preferred.id,
        variantId: input.variantId,
        quantity,
        lowStockThreshold: input.lowStockThreshold,
      });
    });
  }

  private async ensureProductExists(storeId: string, productId: string): Promise<void> {
    const product = await this.warehousesRepository.findProductById(storeId, productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
  }

  private async ensureVariantExists(storeId: string, variantId: string) {
    const variant = await this.warehousesRepository.findVariantById(storeId, variantId);
    if (!variant) {
      throw new NotFoundException('Variant not found');
    }
    return variant;
  }

  private async ensureWarehousesBelongToStore(
    storeId: string,
    warehouseIds: string[],
  ): Promise<void> {
    const existingIds = await this.warehousesRepository.listExistingWarehouseIds(
      storeId,
      warehouseIds,
    );
    if (existingIds.length !== warehouseIds.length) {
      throw new BadRequestException('One or more warehouses do not belong to this store');
    }
  }

  private ensureNoDuplicateWarehouseIds(allocations: VariantWarehouseAllocationDto[]): void {
    const seen = new Set<string>();
    for (const allocation of allocations) {
      if (seen.has(allocation.warehouseId)) {
        throw new BadRequestException('Duplicate warehouseId in allocations is not allowed');
      }
      seen.add(allocation.warehouseId);
    }
  }

  private buildCreatePayload(input: CreateWarehouseDto) {
    const nameAr = this.requireValue(input.nameAr, 'nameAr');
    const nameEn = this.requireValue(input.nameEn, 'nameEn');
    const code = this.normalizeCode(input.code);
    const country = this.normalizeCountry(input.country);
    const city = this.requireValue(input.city, 'city');
    const branch = this.requireValue(input.branch, 'branch');
    const district = this.requireValue(input.district, 'district');
    const street = this.requireValue(input.street, 'street');
    const shortAddress = this.requireValue(input.shortAddress, 'shortAddress');

    return {
      nameAr,
      nameEn,
      code,
      country,
      city,
      branch,
      district,
      street,
      shortAddress,
      address: input.address?.trim() ?? null,
      latitude: input.latitude,
      longitude: input.longitude,
      geolocation: { lat: input.latitude, lng: input.longitude },
      phone: input.phone?.trim() ?? null,
      email: input.email?.trim() ?? null,
      isDefault: input.isDefault ?? false,
      isActive: input.isActive ?? true,
      priority: input.priority ?? 0,
    };
  }

  private buildUpdatePayload(existing: WarehouseRecord, input: UpdateWarehouseDto) {
    const currentLatitude = existing.latitude ? Number(existing.latitude) : null;
    const currentLongitude = existing.longitude ? Number(existing.longitude) : null;

    const latitude = input.latitude ?? currentLatitude;
    const longitude = input.longitude ?? currentLongitude;

    if (latitude === null || longitude === null) {
      throw new BadRequestException('Warehouse coordinates are required');
    }

    return {
      nameAr: this.requireValue(input.nameAr ?? existing.name_ar ?? existing.name, 'nameAr'),
      nameEn: this.requireValue(input.nameEn ?? existing.name_en ?? existing.name, 'nameEn'),
      code: this.normalizeCode(input.code ?? existing.code),
      country: this.normalizeCountry(input.country ?? existing.country ?? 'YE'),
      city: this.requireValue(input.city ?? existing.city ?? '', 'city'),
      branch: this.requireValue(input.branch ?? existing.branch ?? '', 'branch'),
      district: this.requireValue(input.district ?? existing.district ?? '', 'district'),
      street: this.requireValue(input.street ?? existing.street ?? '', 'street'),
      shortAddress: this.requireValue(
        input.shortAddress ?? existing.short_address ?? existing.address ?? '',
        'shortAddress',
      ),
      address: input.address?.trim() ?? existing.address,
      latitude,
      longitude,
      geolocation: { lat: latitude, lng: longitude },
      phone: input.phone?.trim() ?? existing.phone,
      email: input.email?.trim() ?? existing.email,
      isDefault: input.isDefault ?? existing.is_default,
      isActive: input.isActive ?? existing.is_active,
      priority: input.priority ?? existing.priority,
    };
  }

  private requireValue(value: string, fieldName: string): string {
    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return normalized;
  }

  private normalizeCode(value: string): string {
    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      throw new BadRequestException('code is required');
    }
    return normalized;
  }

  private normalizeCountry(value: string): string {
    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      throw new BadRequestException('country is required');
    }
    return normalized;
  }

  private toWarehouseResponse(row: WarehouseRecord): WarehouseResponse {
    return {
      id: row.id,
      storeId: row.store_id,
      name: row.name,
      nameAr: row.name_ar ?? row.name,
      nameEn: row.name_en ?? row.name,
      code: row.code,
      isDefault: row.is_default,
      isActive: row.is_active,
      country: row.country ?? 'YE',
      city: row.city ?? '',
      branch: row.branch ?? '',
      district: row.district ?? '',
      street: row.street ?? '',
      shortAddress: row.short_address ?? row.address ?? '',
      address: row.address,
      phone: row.phone,
      email: row.email,
      latitude: row.latitude ? Number(row.latitude) : null,
      longitude: row.longitude ? Number(row.longitude) : null,
      geolocation: row.geolocation,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toProductWarehouseLinkResponse(
    row: ProductWarehouseLinkRecord,
  ): ProductWarehouseLinkResponse {
    return {
      warehouseId: row.warehouse_id,
      warehouseCode: row.warehouse_code,
      warehouseName: row.warehouse_name,
      warehouseNameAr: row.warehouse_name_ar,
      warehouseNameEn: row.warehouse_name_en,
      isDefault: row.is_default,
      isActive: row.is_active,
    };
  }

  private toVariantWarehouseAllocationResponse(
    row: VariantWarehouseAllocationRecord,
  ): VariantWarehouseAllocationResponse {
    return {
      warehouseId: row.warehouse_id,
      warehouseCode: row.warehouse_code,
      warehouseName: row.warehouse_name,
      warehouseNameAr: row.warehouse_name_ar,
      warehouseNameEn: row.warehouse_name_en,
      isDefault: row.is_default,
      isActive: row.is_active,
      quantity: row.quantity,
      reservedQuantity: row.reserved_quantity,
      lowStockThreshold: row.low_stock_threshold,
      reorderPoint: row.reorder_point,
    };
  }

  private async logAction(
    action: string,
    currentUser: AuthUser,
    targetId: string,
    context: RequestContextData,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.log({
      action,
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'warehouse',
      targetId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        ...metadata,
        requestId: context.requestId,
      },
    });
  }

  private throwOnUniqueViolation(error: unknown, message: string): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    ) {
      throw new ConflictException(message);
    }
  }
}
