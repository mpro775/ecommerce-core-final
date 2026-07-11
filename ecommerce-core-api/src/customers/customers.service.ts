import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { getTokenHashSecret, hashTokenDeterministic } from '../common/security/token-hash.util';
import type { RequestContextData } from '../common/utils/request-context.util';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { buildRefreshToken, parseRefreshToken } from '../auth/utils/refresh-token.util';
import { CustomersRepository, type CustomerRecord } from './customers.repository';
import type {
  CustomerUser,
  CustomerAuthResult,
  CustomerAccessTokenPayload,
} from './interfaces/customer-user.interface';
import type { RegisterCustomerDto } from './dto/register-customer.dto';
import type { CustomerLoginDto } from './dto/customer-login.dto';
import type { CustomerForgotPasswordDto } from './dto/customer-forgot-password.dto';
import type { CustomerResetPasswordDto } from './dto/customer-reset-password.dto';
import type { CustomerRefreshTokenDto } from './dto/customer-refresh-token.dto';
import type { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import type { CreateCustomerAddressDto } from './dto/create-customer-address.dto';
import type { CreateManagedCustomerDto } from './dto/create-managed-customer.dto';
import type { ListManagedCustomersQueryDto } from './dto/list-managed-customers-query.dto';
import type { UpdateManagedCustomerStatusDto } from './dto/update-managed-customer-status.dto';
import type { UpdateManagedCustomerDto } from './dto/update-managed-customer.dto';

export interface CustomerProfileResponse {
  id: string;
  storeId: string;
  fullName: string;
  phone: string;
  email: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

export interface CustomerAddressResponse {
  id: string;
  addressLine: string;
  city: string | null;
  area: string | null;
  notes: string | null;
  isDefault: boolean;
  latitude: number | null;
  longitude: number | null;
  mapProvider: string | null;
  placeLabel: string | null;
}

export interface WishlistItemResponse {
  id: string;
  productId: string;
  title: string;
  slug: string;
  primaryImageUrl: string | null;
  priceFrom: number | null;
  createdAt: Date;
}

export interface ProductReviewResponse {
  id: string;
  productId: string;
  productTitle: string | null;
  customerId: string;
  customerName: string;
  rating: number;
  comment: string | null;
  isVerifiedPurchase: boolean;
  moderationStatus: 'PENDING' | 'APPROVED' | 'HIDDEN';
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductReviewStatsResponse {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: { rating: number; count: number }[];
}

export interface CreateReviewInput {
  productId: string;
  rating: number;
  comment?: string | null;
}

export interface UpdateReviewInput {
  rating?: number;
  comment?: string | null;
}

export interface CustomerOrderResponse {
  id: string;
  orderCode: string;
  status: string;
  subtotal: number;
  total: number;
  shippingFee: number;
  discountTotal: number;
  currencyCode: string;
  createdAt: Date;
}

export interface ManagedCustomerSummaryResponse {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  gender: 'male' | 'female' | null;
  country: string;
  city: string | null;
  birthDate: Date | null;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  ordersCount: number;
  totalSpent: number;
}

export interface ManagedCustomerProfileResponse {
  id: string;
  storeId: string;
  fullName: string;
  phone: string;
  email: string | null;
  gender: 'male' | 'female' | null;
  country: string;
  city: string | null;
  birthDate: Date | null;
  isActive: boolean;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ManagedCustomerAbandonedCartResponse {
  id: string;
  cartData: Record<string, unknown>;
  cartTotal: number;
  itemsCount: number;
  recoverySentAt: Date | null;
  recoveredAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface ManagedCustomerDetailsResponse {
  customer: ManagedCustomerProfileResponse;
  reviews: ProductReviewResponse[];
  wishlist: WishlistItemResponse[];
  addresses: CustomerAddressResponse[];
  abandonedCarts: ManagedCustomerAbandonedCartResponse[];
  orders: CustomerOrderResponse[];
}

@Injectable()
export class CustomersService {
  private static readonly DEFAULT_COUNTRY = 'اليمن';

  constructor(
    private readonly customersRepository: CustomersRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  async register(
    input: RegisterCustomerDto,
    storeId: string,
    context: RequestContextData,
  ): Promise<CustomerAuthResult> {
    const phone = input.phone.trim();
    const email = input.email?.trim().toLowerCase() ?? null;
    const emailNormalized = email ? email.toLowerCase() : null;

    const existingByPhone = await this.customersRepository.findByPhone(storeId, phone);
    if (existingByPhone && existingByPhone.email_normalized) {
      throw new ConflictException('رقم الهاتف مسجل بالفعل');
    }

    if (emailNormalized) {
      const existingByEmail = await this.customersRepository.findByEmail(storeId, emailNormalized);
      if (existingByEmail) {
        throw new ConflictException('البريد الإلكتروني مسجل بالفعل');
      }
    }

    const passwordHash = await this.hashValue(input.password);

    const customer = await this.customersRepository.createRegistered({
      storeId,
      fullName: input.fullName.trim(),
      phone,
      email: email ?? null,
      emailNormalized,
      passwordHash,
    });

    const result = await this.issueSession(customer, storeId, context);

    await this.auditService.log({
      action: 'customer.registered',
      storeId,
      storeUserId: null,
      targetType: 'customer',
      targetId: customer.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId },
    });

    return result;
  }

  async login(
    input: CustomerLoginDto,
    storeId: string,
    context: RequestContextData,
  ): Promise<CustomerAuthResult> {
    const identifier = input.phoneOrEmail.trim();
    let customer: CustomerRecord | null = null;

    if (identifier.includes('@')) {
      customer = await this.customersRepository.findByEmail(storeId, identifier);
    } else {
      customer = await this.customersRepository.findByPhone(storeId, identifier);
    }

    if (!customer || !customer.password_hash || !customer.is_active) {
      await this.auditService.log({
        action: 'customer.login_failed',
        storeId,
        storeUserId: null,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: { requestId: context.requestId, identifier },
      });
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    const valid = await argon2.verify(customer.password_hash, input.password);
    if (!valid) {
      await this.auditService.log({
        action: 'customer.login_failed',
        storeId,
        storeUserId: null,
        targetType: 'customer',
        targetId: customer.id,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: { requestId: context.requestId },
      });
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    await this.customersRepository.touchLastLogin(customer.id);
    const result = await this.issueSession(customer, storeId, context);

    await this.auditService.log({
      action: 'customer.login_succeeded',
      storeId,
      storeUserId: null,
      targetType: 'customer',
      targetId: customer.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId },
    });

    return result;
  }

  async refresh(
    input: CustomerRefreshTokenDto,
    storeId: string,
    context: RequestContextData,
  ): Promise<CustomerAuthResult> {
    const parsed = parseRefreshToken(input.refreshToken);
    if (!parsed) {
      throw new UnauthorizedException('تنسيق رمز التحديث غير صحيح');
    }

    const session = await this.customersRepository.findSessionById(parsed.sessionId);
    this.assertSessionUsable(session);

    const validSecret = await argon2.verify(session!.refresh_token_hash, parsed.secret);
    if (!validSecret) {
      throw new UnauthorizedException('رمز التحديث غير صحيح');
    }

    const customer = await this.customersRepository.findById(session!.customer_id);
    if (!customer || !customer.is_active) {
      throw new UnauthorizedException('العميل غير موجود أو معطل');
    }

    if (customer.store_id !== storeId) {
      throw new UnauthorizedException('رمز التحديث غير صالح لهذا المتجر');
    }

    const result = await this.issueSession(customer, storeId, context, session!.id);
    return result;
  }

  async logout(customer: CustomerUser, context: RequestContextData): Promise<void> {
    await this.customersRepository.revokeSession(customer.sessionId);

    await this.auditService.log({
      action: 'customer.logout',
      storeId: customer.storeId,
      storeUserId: null,
      targetType: 'customer',
      targetId: customer.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId },
    });
  }

  async requestPasswordReset(input: CustomerForgotPasswordDto, storeId: string): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const customer = await this.customersRepository.findByEmail(storeId, email);

    if (!customer) {
      return;
    }

    if (!customer.password_hash) {
      return;
    }

    const token = uuidv4();
    const tokenHash = this.hashSensitiveToken(token);
    const expiresAt = this.getPasswordResetExpiryDate();

    await this.customersRepository.createPasswordReset({
      customerId: customer.id,
      tokenHash,
      expiresAt,
    });

    await this.emailService.sendOwnerRegistrationOtp({
      to: email,
      fullName: customer.full_name,
      otpCode: token,
      expiresInMinutes: 60,
      storeName: 'متجرك',
    });

    await this.auditService.log({
      action: 'customer.password_reset_requested',
      storeId,
      storeUserId: null,
      targetType: 'customer',
      targetId: customer.id,
      ipAddress: null,
      userAgent: null,
      metadata: { email },
    });
  }

  async resetPassword(input: CustomerResetPasswordDto, storeId: string): Promise<void> {
    const tokenHash = this.hashSensitiveToken(input.token);
    const reset = await this.customersRepository.findPasswordResetByToken(tokenHash);

    if (!reset) {
      throw new NotFoundException('رمز إعادة التعيين غير صحيح أو منتهي');
    }

    if (reset.used_at) {
      throw new BadRequestException('تم استخدام رمز إعادة التعيين مسبقاً');
    }

    if (reset.expires_at.getTime() <= Date.now()) {
      throw new BadRequestException('انتهت صلاحية رمز إعادة التعيين');
    }

    const customer = await this.customersRepository.findById(reset.customer_id);
    if (!customer || customer.store_id !== storeId) {
      throw new NotFoundException('العميل غير موجود في هذا المتجر');
    }

    const passwordHash = await this.hashValue(input.password);
    await this.customersRepository.updatePassword(reset.customer_id, passwordHash);
    await this.customersRepository.markPasswordResetUsed(reset.id);
    await this.customersRepository.revokeAllSessionsForCustomer(reset.customer_id);

    await this.auditService.log({
      action: 'customer.password_reset_completed',
      storeId,
      storeUserId: null,
      targetType: 'customer',
      targetId: reset.customer_id,
      ipAddress: null,
      userAgent: null,
      metadata: {},
    });
  }

  async getProfile(customer: CustomerUser): Promise<CustomerProfileResponse> {
    const record = await this.customersRepository.findById(customer.id);
    if (!record || !record.is_active) {
      throw new NotFoundException('العميل غير موجود');
    }
    return this.toProfileResponse(record);
  }

  async updateProfile(
    customer: CustomerUser,
    input: UpdateCustomerProfileDto,
    context: RequestContextData,
  ): Promise<CustomerProfileResponse> {
    if (!input.fullName && !input.phone && !input.email) {
      throw new BadRequestException('يجب تقديم حقل واحد على الأقل');
    }

    let emailNormalized: string | null | undefined;
    if (input.email !== undefined) {
      emailNormalized = input.email ? input.email.trim().toLowerCase() : null;

      if (emailNormalized) {
        const existingByEmail = await this.customersRepository.findByEmail(
          customer.storeId,
          emailNormalized,
        );
        if (existingByEmail && existingByEmail.id !== customer.id) {
          throw new ConflictException('البريد الإلكتروني مستخدم من قبل عميل آخر');
        }
      }
    }

    const updateInput: {
      customerId: string;
      fullName?: string;
      phone?: string;
      email?: string | null;
      emailNormalized?: string | null;
    } = { customerId: customer.id };

    if (input.fullName !== undefined) updateInput.fullName = input.fullName.trim();
    if (input.phone !== undefined) updateInput.phone = input.phone.trim();
    if (input.email !== undefined) {
      updateInput.email = input.email.trim();
      updateInput.emailNormalized = emailNormalized ?? null;
    }

    const updated = await this.customersRepository.updateProfile(updateInput);

    if (!updated) {
      throw new NotFoundException('العميل غير موجود');
    }

    await this.auditService.log({
      action: 'customer.profile_updated',
      storeId: customer.storeId,
      storeUserId: null,
      targetType: 'customer',
      targetId: customer.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId },
    });

    return this.toProfileResponse(updated);
  }

  async listManagedCustomers(
    currentUser: AuthUser,
    query: ListManagedCustomersQueryDto,
  ): Promise<{
    items: ManagedCustomerSummaryResponse[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.q?.trim() || null;

    const [rows, total] = await Promise.all([
      this.customersRepository.listManagedCustomers({
        storeId: currentUser.storeId,
        q: search,
        limit,
        offset: (page - 1) * limit,
      }),
      this.customersRepository.countManagedCustomers(currentUser.storeId, search),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        phone: row.phone,
        email: row.email,
        gender: row.gender,
        country: row.country ?? CustomersService.DEFAULT_COUNTRY,
        city: row.city,
        birthDate: row.birth_date,
        isActive: row.is_active,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
        ordersCount: Number(row.orders_count),
        totalSpent: Number(row.total_spent),
      })),
      total,
      page,
      limit,
    };
  }

  async createManagedCustomer(
    currentUser: AuthUser,
    input: CreateManagedCustomerDto,
    context: RequestContextData,
  ): Promise<ManagedCustomerProfileResponse> {
    const phone = input.phone.trim();
    const email = input.email?.trim().toLowerCase() ?? null;
    const emailNormalized = email ? email.toLowerCase() : null;

    const existingByPhone = await this.customersRepository.findByPhone(currentUser.storeId, phone);
    if (existingByPhone) {
      throw new ConflictException('رقم الجوال مستخدم مسبقاً');
    }

    if (emailNormalized) {
      const existingByEmail = await this.customersRepository.findByEmail(
        currentUser.storeId,
        emailNormalized,
      );
      if (existingByEmail) {
        throw new ConflictException('البريد الإلكتروني مستخدم مسبقاً');
      }
    }

    const customer = await this.customersRepository.createManaged({
      storeId: currentUser.storeId,
      fullName: input.fullName.trim(),
      phone,
      email,
      emailNormalized,
      gender: input.gender ?? null,
      country: this.normalizeCountry(input.country),
      city: this.normalizeOptionalText(input.city),
      birthDate: this.parseOptionalBirthDate(input.birthDate),
    });

    await this.auditService.log({
      action: 'customers.manage.created',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'customer',
      targetId: customer.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId },
    });

    return this.toManagedProfileResponse(customer);
  }

  async updateManagedCustomer(
    currentUser: AuthUser,
    customerId: string,
    input: UpdateManagedCustomerDto,
    context: RequestContextData,
  ): Promise<ManagedCustomerProfileResponse> {
    if (
      input.fullName === undefined &&
      input.phone === undefined &&
      input.email === undefined &&
      input.gender === undefined &&
      input.country === undefined &&
      input.city === undefined &&
      input.birthDate === undefined
    ) {
      throw new BadRequestException('يجب إرسال حقل واحد على الأقل للتحديث');
    }

    const existing = await this.customersRepository.findByIdAndStore(
      customerId,
      currentUser.storeId,
    );
    if (!existing) {
      throw new NotFoundException('العميل غير موجود');
    }

    if (input.phone !== undefined) {
      const phone = input.phone.trim();
      const customerByPhone = await this.customersRepository.findByPhone(
        currentUser.storeId,
        phone,
      );
      if (customerByPhone && customerByPhone.id !== customerId) {
        throw new ConflictException('رقم الجوال مستخدم مسبقاً');
      }
    }

    let emailNormalized: string | null | undefined;
    if (input.email !== undefined) {
      emailNormalized = input.email ? input.email.trim().toLowerCase() : null;
      if (emailNormalized) {
        const existingByEmail = await this.customersRepository.findByEmail(
          currentUser.storeId,
          emailNormalized,
        );
        if (existingByEmail && existingByEmail.id !== customerId) {
          throw new ConflictException('البريد الإلكتروني مستخدم مسبقاً');
        }
      }
    }

    const updatePayload: {
      customerId: string;
      storeId: string;
      fullName?: string;
      phone?: string;
      email?: string | null;
      emailNormalized?: string | null;
      gender?: 'male' | 'female' | null;
      country?: string;
      city?: string | null;
      birthDate?: Date | null;
    } = {
      customerId,
      storeId: currentUser.storeId,
    };

    if (input.fullName !== undefined) {
      updatePayload.fullName = input.fullName.trim();
    }
    if (input.phone !== undefined) {
      updatePayload.phone = input.phone.trim();
    }
    if (input.email !== undefined) {
      updatePayload.email = input.email.trim();
      updatePayload.emailNormalized = emailNormalized ?? null;
    }
    if (input.gender !== undefined) {
      updatePayload.gender = input.gender;
    }
    if (input.country !== undefined) {
      updatePayload.country = this.normalizeCountry(input.country);
    }
    if (input.city !== undefined) {
      updatePayload.city = this.normalizeOptionalText(input.city);
    }
    if (input.birthDate !== undefined) {
      updatePayload.birthDate = this.parseOptionalBirthDate(input.birthDate);
    }

    const updated = await this.customersRepository.updateManaged(updatePayload);

    if (!updated) {
      throw new NotFoundException('العميل غير موجود');
    }

    await this.auditService.log({
      action: 'customers.manage.updated',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'customer',
      targetId: customerId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId },
    });

    return this.toManagedProfileResponse(updated);
  }

  async updateManagedCustomerStatus(
    currentUser: AuthUser,
    customerId: string,
    input: UpdateManagedCustomerStatusDto,
    context: RequestContextData,
  ): Promise<ManagedCustomerProfileResponse> {
    const updated = await this.customersRepository.updateManagedStatus(
      customerId,
      currentUser.storeId,
      input.isActive,
    );

    if (!updated) {
      throw new NotFoundException('العميل غير موجود');
    }

    if (!input.isActive) {
      await this.customersRepository.revokeAllSessionsForCustomer(customerId);
    }

    await this.auditService.log({
      action: 'customers.manage.status_updated',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'customer',
      targetId: customerId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId, isActive: input.isActive },
    });

    return this.toManagedProfileResponse(updated);
  }

  async getManagedCustomerDetails(
    currentUser: AuthUser,
    customerId: string,
  ): Promise<ManagedCustomerDetailsResponse> {
    const customer = await this.customersRepository.findByIdAndStore(
      customerId,
      currentUser.storeId,
    );
    if (!customer) {
      throw new NotFoundException('العميل غير موجود');
    }

    const [reviews, wishlist, addresses, abandonedCarts, orders] = await Promise.all([
      this.customersRepository.listCustomerReviews(customerId, currentUser.storeId),
      this.customersRepository.listWishlist(customerId, currentUser.storeId),
      this.customersRepository.listAddresses(customerId, currentUser.storeId),
      this.customersRepository.listCustomerAbandonedCarts(customerId, currentUser.storeId, 30),
      this.customersRepository.listCustomerOrders(customerId, currentUser.storeId, 100, 0),
    ]);

    return {
      customer: this.toManagedProfileResponse(customer),
      reviews: reviews.map((review) => this.toReviewResponse(review)),
      wishlist: wishlist.map((item) => ({
        id: item.id,
        productId: item.product_id,
        title: item.title,
        slug: item.slug,
        primaryImageUrl: item.primary_image_url,
        priceFrom: item.price_from,
        createdAt: item.created_at,
      })),
      addresses: addresses.map((address) => this.toAddressResponse(address)),
      abandonedCarts: abandonedCarts.map((cart) => ({
        id: cart.id,
        cartData: cart.cart_data,
        cartTotal: Number(cart.cart_total),
        itemsCount: cart.items_count,
        recoverySentAt: cart.recovery_sent_at,
        recoveredAt: cart.recovered_at,
        expiresAt: cart.expires_at,
        createdAt: cart.created_at,
      })),
      orders: orders.map((order) => this.toOrderResponse(order)),
    };
  }

  async createAddress(
    customer: CustomerUser,
    input: CreateCustomerAddressDto,
    context: RequestContextData,
  ): Promise<CustomerAddressResponse> {
    const address = await this.customersRepository.createAddress({
      customerId: customer.id,
      storeId: customer.storeId,
      addressLine: input.addressLine.trim(),
      city: input.city?.trim() ?? null,
      area: input.area?.trim() ?? null,
      notes: input.notes?.trim() ?? null,
      isDefault: input.isDefault ?? false,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      mapProvider: input.mapProvider?.trim() || null,
      placeLabel: input.placeLabel?.trim() || null,
    });

    await this.auditService.log({
      action: 'customer.address_created',
      storeId: customer.storeId,
      storeUserId: null,
      targetType: 'customer_address',
      targetId: address.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId },
    });

    return this.toAddressResponse(address);
  }

  async listAddresses(customer: CustomerUser): Promise<CustomerAddressResponse[]> {
    const addresses = await this.customersRepository.listAddresses(customer.id, customer.storeId);
    return addresses.map((a) => this.toAddressResponse(a));
  }

  async deleteAddress(
    customer: CustomerUser,
    addressId: string,
    context: RequestContextData,
  ): Promise<void> {
    const deleted = await this.customersRepository.deleteAddress(
      addressId,
      customer.id,
      customer.storeId,
    );
    if (!deleted) {
      throw new NotFoundException('العنوان غير موجود');
    }

    await this.auditService.log({
      action: 'customer.address_deleted',
      storeId: customer.storeId,
      storeUserId: null,
      targetType: 'customer_address',
      targetId: addressId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId },
    });
  }

  // ==================== WISHLIST ====================

  async addToWishlist(
    customer: CustomerUser,
    productId: string,
    context: RequestContextData,
  ): Promise<WishlistItemResponse> {
    const item = await this.customersRepository.addToWishlist(
      customer.id,
      customer.storeId,
      productId,
    );

    await this.auditService.log({
      action: 'customer.wishlist_added',
      storeId: customer.storeId,
      storeUserId: null,
      targetType: 'wishlist_item',
      targetId: item.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId, productId },
    });

    return {
      id: item.id,
      productId: item.product_id,
      title: '',
      slug: '',
      primaryImageUrl: null,
      priceFrom: null,
      createdAt: item.created_at,
    };
  }

  async removeFromWishlist(
    customer: CustomerUser,
    productId: string,
    context: RequestContextData,
  ): Promise<void> {
    const deleted = await this.customersRepository.removeFromWishlist(
      customer.id,
      customer.storeId,
      productId,
    );
    if (!deleted) {
      throw new NotFoundException('المنتج غير موجود في المفضلة');
    }

    await this.auditService.log({
      action: 'customer.wishlist_removed',
      storeId: customer.storeId,
      storeUserId: null,
      targetType: 'product',
      targetId: productId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId },
    });
  }

  async listWishlist(customer: CustomerUser): Promise<WishlistItemResponse[]> {
    const items = await this.customersRepository.listWishlist(customer.id, customer.storeId);
    return items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      title: item.title,
      slug: item.slug,
      primaryImageUrl: item.primary_image_url,
      priceFrom: item.price_from,
      createdAt: item.created_at,
    }));
  }

  async isInWishlist(customer: CustomerUser, productId: string): Promise<boolean> {
    return this.customersRepository.isInWishlist(customer.id, customer.storeId, productId);
  }

  // ==================== REVIEWS ====================

  async createReview(
    customer: CustomerUser,
    input: CreateReviewInput,
    context: RequestContextData,
  ): Promise<ProductReviewResponse> {
    const existingReview = await this.customersRepository.findCustomerReviewForProduct(
      customer.id,
      input.productId,
    );
    if (existingReview) {
      throw new ConflictException('لقد قمت بتقييم هذا المنتج مسبقاً');
    }

    const purchasedOrderId = await this.customersRepository.checkCustomerPurchasedProduct(
      customer.id,
      customer.storeId,
      input.productId,
    );
    if (!purchasedOrderId) {
      throw new BadRequestException('You can only review products after completing a purchase.');
    }

    const review = await this.customersRepository.createReview({
      storeId: customer.storeId,
      productId: input.productId,
      customerId: customer.id,
      orderId: purchasedOrderId,
      rating: input.rating,
      comment: input.comment ?? null,
      isVerifiedPurchase: true,
    });

    await this.auditService.log({
      action: 'customer.review_created',
      storeId: customer.storeId,
      storeUserId: null,
      targetType: 'product_review',
      targetId: review.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId, productId: input.productId, rating: input.rating },
    });

    return this.toReviewResponse(review);
  }

  async updateReview(
    customer: CustomerUser,
    reviewId: string,
    input: UpdateReviewInput,
    context: RequestContextData,
  ): Promise<ProductReviewResponse> {
    if (!input.rating && !input.comment) {
      throw new BadRequestException('يجب تقديم حقل واحد على الأقل');
    }

    const updateInput: {
      reviewId: string;
      customerId: string;
      rating?: number;
      comment?: string | null;
    } = {
      reviewId,
      customerId: customer.id,
    };

    if (input.rating !== undefined) updateInput.rating = input.rating;
    if (input.comment !== undefined) updateInput.comment = input.comment;

    const updated = await this.customersRepository.updateReview(updateInput);

    if (!updated) {
      throw new NotFoundException('التقييم غير موجود');
    }

    await this.auditService.log({
      action: 'customer.review_updated',
      storeId: customer.storeId,
      storeUserId: null,
      targetType: 'product_review',
      targetId: reviewId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId },
    });

    return this.toReviewResponse(updated);
  }

  async deleteReview(
    customer: CustomerUser,
    reviewId: string,
    context: RequestContextData,
  ): Promise<void> {
    const deleted = await this.customersRepository.deleteReview(reviewId, customer.id);
    if (!deleted) {
      throw new NotFoundException('التقييم غير موجود');
    }

    await this.auditService.log({
      action: 'customer.review_deleted',
      storeId: customer.storeId,
      storeUserId: null,
      targetType: 'product_review',
      targetId: reviewId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId },
    });
  }

  async listCustomerReviews(customer: CustomerUser): Promise<ProductReviewResponse[]> {
    const reviews = await this.customersRepository.listCustomerReviews(
      customer.id,
      customer.storeId,
    );
    return reviews.map((r) => this.toReviewResponse(r));
  }

  async listProductReviews(
    storeId: string,
    productId: string,
    limit = 20,
    offset = 0,
  ): Promise<{
    reviews: ProductReviewResponse[];
    stats: ProductReviewStatsResponse;
  }> {
    const [reviews, stats] = await Promise.all([
      this.customersRepository.listProductReviews(storeId, productId, limit, offset),
      this.customersRepository.getProductReviewStats(storeId, productId),
    ]);

    return {
      reviews: reviews.map((r) => this.toReviewResponse(r)),
      stats: {
        averageRating: stats.average_rating,
        totalReviews: stats.total_reviews,
        ratingDistribution: stats.rating_distribution,
      },
    };
  }

  private toReviewResponse(review: {
    id: string;
    product_id: string;
    product_title: string | null;
    customer_id: string;
    customer_name: string;
    rating: number;
    comment: string | null;
    is_verified_purchase: boolean;
    moderation_status: 'PENDING' | 'APPROVED' | 'HIDDEN';
    created_at: Date;
    updated_at: Date;
  }): ProductReviewResponse {
    return {
      id: review.id,
      productId: review.product_id,
      productTitle: review.product_title,
      customerId: review.customer_id,
      customerName: review.customer_name,
      rating: review.rating,
      comment: review.comment,
      isVerifiedPurchase: review.is_verified_purchase,
      moderationStatus: review.moderation_status,
      createdAt: review.created_at,
      updatedAt: review.updated_at,
    };
  }

  // ==================== ORDERS ====================

  async getCustomerOrders(
    customer: CustomerUser,
    limit = 20,
    offset = 0,
  ): Promise<{ orders: CustomerOrderResponse[]; total: number }> {
    const [orders, total] = await Promise.all([
      this.customersRepository.listCustomerOrders(customer.id, customer.storeId, limit, offset),
      this.customersRepository.countCustomerOrders(customer.id, customer.storeId),
    ]);

    return {
      orders: orders.map((order) => this.toOrderResponse(order)),
      total,
    };
  }

  private async issueSession(
    customer: CustomerRecord,
    storeId: string,
    context: RequestContextData,
    fixedSessionId?: string,
  ): Promise<CustomerAuthResult> {
    const expiresAt = this.getRefreshExpiryDate();
    const sessionId = fixedSessionId ?? uuidv4();
    const refresh = buildRefreshToken(sessionId);
    const refreshTokenHash = await this.hashValue(refresh.secret);

    if (fixedSessionId) {
      await this.customersRepository.rotateSession({
        sessionId,
        refreshTokenHash,
        expiresAt,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    } else {
      await this.customersRepository.createSession({
        sessionId,
        customerId: customer.id,
        storeId,
        refreshTokenHash,
        expiresAt,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    }

    const customerUser: CustomerUser = {
      id: customer.id,
      storeId,
      phone: customer.phone,
      email: customer.email,
      fullName: customer.full_name,
      sessionId,
    };

    const accessToken = await this.signAccessToken(customerUser);
    return { accessToken, refreshToken: refresh.token, customer: customerUser };
  }

  private async signAccessToken(customer: CustomerUser): Promise<string> {
    const payload: CustomerAccessTokenPayload = {
      sub: customer.id,
      sid: customer.sessionId,
      storeId: customer.storeId,
      phone: customer.phone,
      email: customer.email,
      fullName: customer.fullName,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_CUSTOMER_ACCESS_SECRET'),
    });
  }

  verifyAccessToken(token: string): Promise<CustomerAccessTokenPayload> {
    return this.jwtService.verifyAsync<CustomerAccessTokenPayload>(token, {
      secret: this.configService.getOrThrow<string>('JWT_CUSTOMER_ACCESS_SECRET'),
    });
  }

  private assertSessionUsable(
    session: { expires_at: Date; revoked_at: Date | null } | null,
  ): asserts session is { expires_at: Date; revoked_at: Date | null } {
    if (!session) {
      throw new UnauthorizedException('جلسة التحديث غير موجودة');
    }
    if (session.revoked_at) {
      throw new UnauthorizedException('جلسة التحديث ملغاة');
    }
    if (session.expires_at.getTime() <= Date.now()) {
      throw new UnauthorizedException('جلسة التحديث منتهية الصلاحية');
    }
  }

  private toProfileResponse(customer: CustomerRecord): CustomerProfileResponse {
    return {
      id: customer.id,
      storeId: customer.store_id,
      fullName: customer.full_name,
      phone: customer.phone,
      email: customer.email,
      emailVerifiedAt: customer.email_verified_at,
      createdAt: customer.created_at,
    };
  }

  private toAddressResponse(address: {
    id: string;
    address_line: string;
    city: string | null;
    area: string | null;
    notes: string | null;
    is_default: boolean;
    latitude: number | string | null;
    longitude: number | string | null;
    map_provider: string | null;
    place_label: string | null;
  }): CustomerAddressResponse {
    return {
      id: address.id,
      addressLine: address.address_line,
      city: address.city,
      area: address.area,
      notes: address.notes,
      isDefault: address.is_default,
      latitude: address.latitude === null ? null : Number(address.latitude),
      longitude: address.longitude === null ? null : Number(address.longitude),
      mapProvider: address.map_provider,
      placeLabel: address.place_label,
    };
  }

  private toManagedProfileResponse(customer: CustomerRecord): ManagedCustomerProfileResponse {
    return {
      id: customer.id,
      storeId: customer.store_id,
      fullName: customer.full_name,
      phone: customer.phone,
      email: customer.email,
      gender: customer.gender ?? null,
      country: customer.country ?? CustomersService.DEFAULT_COUNTRY,
      city: customer.city ?? null,
      birthDate: customer.birth_date ?? null,
      isActive: customer.is_active,
      emailVerifiedAt: customer.email_verified_at,
      lastLoginAt: customer.last_login_at,
      createdAt: customer.created_at,
      updatedAt: customer.updated_at,
    };
  }

  private toOrderResponse(order: {
    id: string;
    order_code: string;
    status: string;
    subtotal: number;
    total: number;
    shipping_fee: number;
    discount_total: number;
    currency_code: string;
    created_at: Date;
  }): CustomerOrderResponse {
    return {
      id: order.id,
      orderCode: order.order_code,
      status: order.status,
      subtotal: Number(order.subtotal),
      total: Number(order.total),
      shippingFee: Number(order.shipping_fee),
      discountTotal: Number(order.discount_total),
      currencyCode: order.currency_code,
      createdAt: order.created_at,
    };
  }

  private normalizeCountry(country: string | undefined): string {
    const normalized = country?.trim();
    return normalized && normalized.length > 0 ? normalized : CustomersService.DEFAULT_COUNTRY;
  }

  private normalizeOptionalText(value: string | undefined): string | null {
    if (value === undefined) {
      return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private parseOptionalBirthDate(value: string | undefined): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('تاريخ الميلاد غير صالح');
    }
    return parsed;
  }

  private async hashValue(value: string): Promise<string> {
    return argon2.hash(value, { type: argon2.argon2id });
  }

  private hashSensitiveToken(token: string): string {
    return hashTokenDeterministic(token, getTokenHashSecret(this.configService));
  }

  private getRefreshExpiryDate(): Date {
    const ttlDays = this.configService.get<number>('CUSTOMER_REFRESH_TOKEN_TTL_DAYS', 30);
    return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  }

  private getPasswordResetExpiryDate(): Date {
    const ttlMinutes = this.configService.get<number>('CUSTOMER_PASSWORD_RESET_TTL_MINUTES', 60);
    return new Date(Date.now() + ttlMinutes * 60 * 1000);
  }
}
