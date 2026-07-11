import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { RequestContextData } from '../common/utils/request-context.util';
import { SeoService } from '../seo/seo.service';
import { ShippingService } from '../shipping/shipping.service';
import { StoresRepository } from '../stores/stores.repository';
import { StoreReadinessRepository, type StoreReadinessFacts } from './store-readiness.repository';
import type {
  SetupSection,
  SetupStep,
  SetupStepStatus,
  StoreReadinessResponse,
} from './store-readiness.types';

const SECTION_WEIGHTS: Record<string, number> = {
  identity: 20,
  catalog: 35,
  checkout: 30,
  trust: 15,
};

const SKIPPABLE_STEPS = new Set([
  'identity.logo',
  'identity.description',
  'identity.working_hours',
  'catalog.brands',
  'catalog.attributes',
  'catalog.featured_products',
  'catalog.product_images',
  'trust.published_pages',
]);

@Injectable()
export class StoreReadinessService {
  constructor(
    private readonly readinessRepository: StoreReadinessRepository,
    private readonly storesRepository: StoresRepository,
    private readonly shippingService: ShippingService,
    private readonly seoService: SeoService,
  ) {}

  async getReadiness(currentUser: AuthUser): Promise<StoreReadinessResponse> {
    const [facts, progress] = await Promise.all([
      this.readinessRepository.getFacts(currentUser.storeId),
      this.readinessRepository.listProgress(currentUser.storeId),
    ]);

    const sections = this.buildSections(facts).map((section) => ({
      ...section,
      steps: section.steps.map((step) => {
        const skipped = progress.get(step.key)?.status === 'skipped';
        if (skipped && step.skippable && step.status !== 'completed') {
          return { ...step, status: 'skipped' as const };
        }
        return step;
      }),
    }));

    const normalizedSections = sections.map((section) => this.withSectionStats(section));
    const allSteps = normalizedSections.flatMap((section) => section.steps);
    const completedSteps = allSteps.filter((step) => this.isDone(step.status)).length;
    const blockingIssues = allSteps.filter((step) => step.status === 'blocking');
    const warnings = allSteps.filter((step) => step.status === 'warning');
    const score = Math.round(
      normalizedSections.reduce((sum, section) => {
        const done = section.steps.filter((step) => this.isDone(step.status)).length;
        const ratio = section.steps.length === 0 ? 1 : done / section.steps.length;
        return sum + ratio * section.weight;
      }, 0),
    );
    const canReceiveOrders = blockingIssues.length === 0;
    const nextBestAction =
      blockingIssues[0] ??
      allSteps.find((step) => step.status === 'missing') ??
      warnings[0] ??
      null;

    return {
      score,
      status: canReceiveOrders ? (score >= 100 ? 'ready' : 'needs_attention') : 'not_ready',
      canReceiveOrders,
      completedSteps,
      totalSteps: allSteps.length,
      blockingIssues,
      warnings,
      nextBestAction,
      sections: normalizedSections,
    };
  }

  async skipStep(
    currentUser: AuthUser,
    stepKey: string,
    reason?: string,
  ): Promise<StoreReadinessResponse> {
    if (!SKIPPABLE_STEPS.has(stepKey)) {
      throw new BadRequestException('This setup step cannot be skipped.');
    }
    await this.readinessRepository.skipStep(currentUser.storeId, stepKey, reason?.trim() || null);
    return this.getReadiness(currentUser);
  }

  async unskipStep(currentUser: AuthUser, stepKey: string): Promise<StoreReadinessResponse> {
    await this.readinessRepository.unskipStep(currentUser.storeId, stepKey);
    return this.getReadiness(currentUser);
  }

  async runQuickAction(
    currentUser: AuthUser,
    action: string,
    context: RequestContextData,
  ): Promise<StoreReadinessResponse> {
    if (action === 'enable_cod') {
      const enabled = await this.readinessRepository.enableCodPayment(currentUser.storeId);
      if (!enabled) {
        throw new BadRequestException('No enabled cash-on-delivery payment method is available.');
      }
      return this.getReadiness(currentUser);
    }

    if (action === 'quick_fulfillment') {
      const store = await this.storesRepository.findById(currentUser.storeId);
      await this.shippingService.quickSetup(
        currentUser,
        {
          city: store?.city || 'City',
          enableLocalDelivery: true,
          localDeliveryFee: 0,
          enablePickup: true,
          pickupAddress: store?.address || store?.address_details || store?.city || 'Store location',
        },
        context,
      );
      return this.getReadiness(currentUser);
    }

    if (action === 'bootstrap_pages') {
      await this.seoService.bootstrapPages(currentUser, { overwrite: false });
      return this.getReadiness(currentUser);
    }

    throw new BadRequestException('Unknown quick action.');
  }

  private buildSections(facts: StoreReadinessFacts): SetupSection[] {
    return [
      this.section('identity', 'Store identity', [
        this.step('identity.store_name', 'Store name', 'A clear public store name.', facts.name, 'blocking', false, 'Complete store settings', 'store'),
        this.step('identity.logo', 'Logo', 'A store logo improves trust.', facts.logo_url, 'warning', true, 'Add logo', 'store'),
        this.step('identity.description', 'Description', 'Short description of the store.', facts.description, 'missing', true, 'Add description', 'store'),
        this.step('identity.phone', 'Contact phone', 'A support phone or WhatsApp number.', facts.phone, 'warning', false, 'Add phone', 'store'),
        this.step('identity.city', 'City', 'The city helps fulfillment setup.', facts.city, 'warning', false, 'Set city', 'store'),
        this.step('identity.currency', 'Currency', 'The selling currency is configured.', facts.currency_code, 'blocking', false, 'Set currency', 'store'),
        this.step('identity.working_hours', 'Working hours', 'Order handling hours are configured.', facts.working_hours_count > 0, 'missing', true, 'Set working hours', 'store'),
      ]),
      this.section('catalog', 'Catalog', [
        this.step('catalog.categories', 'Categories', 'At least one category exists.', facts.category_count > 0, 'blocking', false, 'Add categories', 'categories'),
        this.step('catalog.categories_visible', 'Visible categories', 'At least one category is active.', facts.visible_category_count > 0, 'missing', false, 'Activate categories', 'categories'),
        this.step('catalog.brands', 'Brands', 'Add brands when relevant.', facts.brand_count > 0, 'missing', true, 'Add brands', 'brands'),
        this.step('catalog.attributes', 'Attributes', 'Attributes such as color or size.', facts.attribute_count > 0, 'missing', true, 'Add attributes', 'attributes'),
        this.step('catalog.products', 'Products', 'At least one product exists.', facts.product_count > 0, 'blocking', false, 'Add products', 'products'),
        this.step('catalog.products_visible', 'Visible products', 'Products are published for customers.', facts.visible_product_count > 0, 'blocking', false, 'Publish products', 'products'),
        this.step('catalog.product_prices', 'Product prices', 'All sellable products have prices.', facts.product_count > 0 && facts.priced_product_count >= facts.product_count, 'blocking', false, 'Complete prices', 'products'),
        this.step('catalog.products_have_categories', 'Product categories', 'Products are organized into categories.', facts.product_count > 0 && facts.products_with_category_count >= facts.product_count, 'missing', false, 'Assign categories', 'products'),
        this.step('catalog.product_images', 'Product images', 'Products have clear images.', facts.product_count > 0 && facts.products_with_image_count >= facts.product_count, 'warning', true, 'Add images', 'products'),
        this.step('catalog.featured_products', 'Featured products', 'Choose products for app highlights.', facts.featured_product_count > 0, 'missing', true, 'Feature products', 'products'),
      ]),
      this.section('checkout', 'Checkout and fulfillment', [
        this.step('checkout.payment_method', 'Payment method', 'At least one payment method is enabled.', facts.enabled_payment_count > 0, 'blocking', false, 'Enable COD', 'payments', 'enable_cod'),
        this.step('checkout.payment_configured', 'Payment details', 'Manual transfer details are complete.', facts.incomplete_payment_count === 0, 'blocking', false, 'Complete payment details', 'payments'),
        this.step('checkout.shipping_method', 'Shipping or pickup', 'Shipping or pickup is enabled.', facts.active_shipping_method_count > 0, 'blocking', false, 'Quick fulfillment setup', 'shipping', 'quick_fulfillment'),
        this.step('checkout.final_checkout_test', 'Checkout test', 'The store can receive a real order.', facts.enabled_payment_count > 0 && facts.active_shipping_method_count > 0 && facts.visible_product_count > 0, 'blocking', false, 'Open orders', 'orders'),
      ]),
      this.section('trust', 'Simple content pages', [
        this.step('trust.pages', 'Core pages', 'About, contact, policies, and FAQ pages exist.', facts.trust_page_count >= 4, 'missing', false, 'Create pages', 'storePages', 'bootstrap_pages'),
        this.step('trust.published_pages', 'Published pages', 'Trust pages are published for customers.', facts.published_trust_page_count >= 4, 'warning', true, 'Review pages', 'storePages'),
      ]),
    ];
  }

  private section(key: string, title: string, steps: SetupStep[]): SetupSection {
    return {
      key,
      title,
      weight: SECTION_WEIGHTS[key] ?? 0,
      completedSteps: 0,
      totalSteps: steps.length,
      status: 'missing',
      steps,
    };
  }

  private step(
    key: string,
    title: string,
    description: string,
    condition: unknown,
    missingStatus: Exclude<SetupStepStatus, 'completed' | 'skipped'>,
    skippable: boolean,
    actionLabel: string,
    actionTab: string,
    quickAction: string | null = null,
  ): SetupStep {
    return {
      key,
      title,
      description,
      status: condition ? 'completed' : missingStatus,
      required: missingStatus === 'blocking',
      skippable,
      actionLabel,
      actionTab,
      quickAction,
    };
  }

  private withSectionStats(section: SetupSection): SetupSection {
    const completedSteps = section.steps.filter((step) => this.isDone(step.status)).length;
    const status = this.sectionStatus(section.steps);
    return { ...section, completedSteps, totalSteps: section.steps.length, status };
  }

  private sectionStatus(steps: SetupStep[]): SetupStepStatus {
    if (steps.some((step) => step.status === 'blocking')) return 'blocking';
    if (steps.some((step) => step.status === 'missing')) return 'missing';
    if (steps.some((step) => step.status === 'warning')) return 'warning';
    return 'completed';
  }

  private isDone(status: SetupStepStatus): boolean {
    return status === 'completed' || status === 'skipped';
  }
}
