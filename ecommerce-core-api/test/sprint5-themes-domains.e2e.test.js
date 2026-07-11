require('reflect-metadata');

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { after, before, beforeEach, describe, it } = require('node:test');
const { ValidationPipe } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { Test } = require('@nestjs/testing');

const { AccessTokenGuard } = require('../dist/auth/guards/access-token.guard');
const { AuditService } = require('../dist/audit/audit.service');
const { DomainDnsInspectorService } = require('../dist/domains/domain-dns-inspector.service');
const { DnsResolverService } = require('../dist/domains/dns-resolver.service');
const { DomainsController } = require('../dist/domains/domains.controller');
const { DomainsRepository } = require('../dist/domains/domains.repository');
const { DomainsService } = require('../dist/domains/domains.service');
const { CloudflareDomainsService } = require('../dist/domains/cloudflare-domains.service');
const { OutboxService } = require('../dist/messaging/outbox.service');
const { PermissionsGuard } = require('../dist/rbac/guards/permissions.guard');
const { SaasService } = require('../dist/saas/saas.service');
const { TenantGuard } = require('../dist/tenancy/guards/tenant.guard');
const { ThemesController } = require('../dist/themes/themes.controller');
const { ThemesRepository } = require('../dist/themes/themes.repository');
const { ThemesService } = require('../dist/themes/themes.service');
const { PERMISSIONS } = require('../dist/auth/constants/permission.constants');
const { REQUIRED_PERMISSIONS_KEY } = require('../dist/rbac/decorators/permissions.decorator');

const STORE_ID = '11111111-1111-4111-8111-111111111111';
const ACTIVE_USER = {
  id: '22222222-2222-4222-8222-222222222222',
  storeId: STORE_ID,
  email: 'owner@example.com',
  fullName: 'Store Owner',
  role: 'owner',
  permissions: ['*'],
  sessionId: '33333333-3333-4333-8333-333333333333',
};

const state = {
  themesByStore: new Map(),
  themeVersions: [],
  previewTokens: new Map(),
  domainsById: new Map(),
  outboxEvents: [],
  dnsPairs: new Set(),
};

const componentTemplates = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    template_key: 'general-starter',
    name: 'General Starter',
    description: 'General storefront component template.',
    category: 'general',
    renderer_type: 'component',
    component_key: 'general-starter',
    thumbnail_url: null,
    preview_image_url: null,
    preview_images: [],
    assets: {},
    settings_schema: {
      'hero.headline': { type: 'text', label: 'عنوان الواجهة' },
      'products.limit': { type: 'number', label: 'عدد المنتجات', min: 4, max: 16 },
    },
    default_config: buildComponentThemeConfig('general-starter', 'general-starter'),
    capabilities: { rtl: true, responsive: true },
    is_premium: false,
    allowed_plans: [],
    status: 'published',
    version: 1,
    draft_config: buildComponentThemeConfig('general-starter', 'general-starter'),
    published_config: buildComponentThemeConfig('general-starter', 'general-starter'),
    published_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    template_key: 'fashion-editorial',
    name: 'Fashion Editorial',
    description: 'Editorial fashion component template.',
    category: 'fashion',
    renderer_type: 'component',
    component_key: 'fashion-editorial',
    thumbnail_url: null,
    preview_image_url: null,
    preview_images: [],
    assets: {},
    settings_schema: {
      'hero.headline': { type: 'text', label: 'عنوان الهيرو' },
      'story.title': { type: 'text', label: 'عنوان القصة' },
      'products.limit': { type: 'number', label: 'عدد المنتجات', min: 4, max: 12 },
    },
    default_config: buildComponentThemeConfig('fashion-editorial', 'fashion-editorial'),
    capabilities: { rtl: true, responsive: true },
    is_premium: false,
    allowed_plans: [],
    status: 'published',
    version: 1,
    draft_config: buildComponentThemeConfig('fashion-editorial', 'fashion-editorial'),
    published_config: buildComponentThemeConfig('fashion-editorial', 'fashion-editorial'),
    published_at: new Date(),
    updated_at: new Date(),
  },
];

const themesRepositoryMock = {
  async findByStoreId(storeId) {
    return state.themesByStore.get(storeId) ?? null;
  },
  async createDefaultTheme(storeId, config) {
    if (state.themesByStore.has(storeId)) {
      return null;
    }

    const row = {
      id: randomUUID(),
      store_id: storeId,
      draft_config: config,
      published_config: config,
      version: 1,
    };
    state.themesByStore.set(storeId, row);
    return row;
  },
  async updateDraft(storeId, config) {
    const current = state.themesByStore.get(storeId);
    const updated = {
      ...current,
      draft_config: config,
    };
    state.themesByStore.set(storeId, updated);
    return updated;
  },
  async publishDraft(storeId) {
    const current = state.themesByStore.get(storeId);
    const updated = {
      ...current,
      published_config: current.draft_config,
      version: current.version + 1,
    };
    state.themesByStore.set(storeId, updated);
    return updated;
  },
  async createThemeVersion(input) {
    const row = {
      id: randomUUID(),
      store_id: input.storeId,
      theme_id: input.themeId,
      version: input.version,
      config: input.config,
      published_by: input.publishedBy,
      published_at: new Date(),
      change_summary: input.changeSummary,
    };
    const existingIndex = state.themeVersions.findIndex(
      (entry) => entry.store_id === input.storeId && entry.version === input.version,
    );
    if (existingIndex >= 0) {
      state.themeVersions[existingIndex] = row;
    } else {
      state.themeVersions.push(row);
    }
    return row;
  },
  async listThemeVersions(storeId) {
    return state.themeVersions
      .filter((entry) => entry.store_id === storeId)
      .sort((a, b) => b.version - a.version);
  },
  async findThemeVersion(storeId, version) {
    return (
      state.themeVersions.find(
        (entry) => entry.store_id === storeId && entry.version === version,
      ) ?? null
    );
  },
  async createPreviewToken(storeId, token, expiresAt) {
    const row = { id: randomUUID(), store_id: storeId, token, expires_at: expiresAt };
    state.previewTokens.set(token, row);
    return row;
  },
  async findValidPreviewToken(token) {
    const row = state.previewTokens.get(token);
    if (!row || row.expires_at.getTime() <= Date.now()) {
      return null;
    }
    return row;
  },
  async deleteExpiredPreviewTokens() {
    for (const [token, row] of state.previewTokens.entries()) {
      if (row.expires_at.getTime() <= Date.now()) {
        state.previewTokens.delete(token);
      }
    }
  },
  async listPublishedThemeTemplates() {
    return componentTemplates;
  },
  async listPublishedComponentKeys() {
    return componentTemplates.map((template) => template.component_key).sort();
  },
  async findPublishedThemeTemplateByKeyOrId(identifier) {
    return (
      componentTemplates.find(
        (template) => template.template_key === identifier || template.id === identifier,
      ) ?? null
    );
  },
};

const domainsRepositoryMock = {
  async create(input) {
    const duplicate = [...state.domainsById.values()].find(
      (row) => row.hostname.toLowerCase() === input.hostname.toLowerCase(),
    );
    if (duplicate) {
      const error = new Error('duplicate');
      error.code = '23505';
      throw error;
    }

    const row = {
      id: randomUUID(),
      store_id: input.storeId,
      hostname: input.hostname,
      verification_token: input.verificationToken,
      status: 'pending',
      ssl_status: 'pending',
      ssl_provider: input.sslProvider ?? 'manual',
      ssl_mode: input.sslMode ?? 'full_strict',
      cloudflare_zone_id: input.cloudflareZoneId ?? null,
      cloudflare_hostname_id: null,
      ssl_validation_records: [],
      last_dns_check_at: null,
      last_dns_check_result: [],
      support_required: false,
      technical_error_code: null,
      technical_error_message: null,
      ssl_last_checked_at: null,
      ssl_error: null,
      verified_at: null,
      activated_at: null,
    };
    state.domainsById.set(row.id, row);
    return row;
  },
  async list(storeId) {
    return [...state.domainsById.values()].filter((row) => row.store_id === storeId);
  },
  async findById(storeId, domainId) {
    const row = state.domainsById.get(domainId);
    return row && row.store_id === storeId ? row : null;
  },
  async markVerified(storeId, domainId) {
    const row = state.domainsById.get(domainId);
    if (!row || row.store_id !== storeId) {
      return null;
    }

    row.status = 'verified';
    row.verified_at = row.verified_at ?? new Date();
    state.domainsById.set(row.id, row);
    return row;
  },
  async markActive(input) {
    const row = state.domainsById.get(input.domainId);
    if (!row || row.store_id !== input.storeId) {
      return null;
    }

    row.status = 'active';
    row.ssl_status = input.sslStatus;
    row.cloudflare_hostname_id = input.cloudflareHostnameId ?? row.cloudflare_hostname_id;
    row.ssl_validation_records = input.validationRecords ?? row.ssl_validation_records;
    row.ssl_last_checked_at = new Date();
    row.ssl_error = input.sslError;
    row.support_required = input.sslStatus === 'error';
    row.activated_at = row.activated_at ?? new Date();
    state.domainsById.set(row.id, row);
    return row;
  },
  async updateSslState(input) {
    const row = state.domainsById.get(input.domainId);
    if (!row || row.store_id !== input.storeId) {
      return null;
    }

    row.ssl_status = input.sslStatus;
    row.cloudflare_hostname_id = input.cloudflareHostnameId ?? row.cloudflare_hostname_id;
    row.ssl_validation_records = input.validationRecords ?? row.ssl_validation_records;
    row.ssl_last_checked_at = new Date();
    row.ssl_error = input.sslError;
    row.support_required = input.sslStatus === 'error';
    state.domainsById.set(row.id, row);
    return row;
  },
  async updateDnsCheck(input) {
    const row = state.domainsById.get(input.domainId);
    if (!row || row.store_id !== input.storeId) {
      return null;
    }

    row.last_dns_check_at = new Date();
    row.last_dns_check_result = input.result;
    state.domainsById.set(row.id, row);
    return row;
  },
  async markVerifiedWithSslError(input) {
    const row = state.domainsById.get(input.domainId);
    if (!row || row.store_id !== input.storeId) {
      return null;
    }

    row.status = 'verified';
    row.ssl_status = 'error';
    row.ssl_error = input.sslError;
    row.support_required = true;
    row.technical_error_code = input.technicalErrorCode ?? null;
    row.technical_error_message = input.technicalErrorMessage ?? null;
    row.verified_at = row.verified_at ?? new Date();
    row.activated_at = null;
    state.domainsById.set(row.id, row);
    return row;
  },
  async delete(storeId, domainId) {
    const row = state.domainsById.get(domainId);
    if (!row || row.store_id !== storeId) {
      return false;
    }
    state.domainsById.delete(domainId);
    return true;
  },
};

const domainDnsInspectorServiceMock = {
  async checkRecord(record) {
    return {
      record: record.name,
      expected: record.value,
      found: record.value,
      status: 'valid',
    };
  },
};

const dnsResolverServiceMock = {
  async hasVerificationRecord(hostname, token, prefix) {
    return state.dnsPairs.has(`${prefix}.${hostname}:${token}`);
  },
  async hasRoutingCname() {
    return true;
  },
};

const cloudflareDomainsServiceMock = {
  isEnabled() {
    return false;
  },
  async createCustomHostname() {
    return { cloudflareHostnameId: 'cf-hostname-id', sslStatus: 'requested' };
  },
  async getCustomHostname() {
    return { sslStatus: 'issued' };
  },
  async deleteCustomHostname() {
    return;
  },
};

const outboxServiceMock = {
  async enqueue(event) {
    state.outboxEvents.push(event);
  },
};

const auditServiceMock = {
  async log() {
    return;
  },
};

const saasServiceMock = {
  async assertFeatureEnabled() {
    return;
  },
  async assertMetricCanGrow() {
    return;
  },
  async recordUsageEvent() {
    return;
  },
};

describe('Sprint 5 themes/domains e2e', () => {
  let app;
  let baseUrl = '';

  before(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ThemesController, DomainsController],
      providers: [
        ThemesService,
        DomainsService,
        { provide: ThemesRepository, useValue: themesRepositoryMock },
        { provide: DomainsRepository, useValue: domainsRepositoryMock },
        { provide: DnsResolverService, useValue: dnsResolverServiceMock },
        { provide: DomainDnsInspectorService, useValue: domainDnsInspectorServiceMock },
        { provide: OutboxService, useValue: outboxServiceMock },
        { provide: AuditService, useValue: auditServiceMock },
        { provide: SaasService, useValue: saasServiceMock },
        { provide: CloudflareDomainsService, useValue: cloudflareDomainsServiceMock },
        {
          provide: ConfigService,
          useValue: {
            get(key, fallback) {
              if (key === 'DOMAIN_VERIFY_TXT_PREFIX') {
                return '_kaleem-verify';
              }
              if (key === 'THEME_PREVIEW_TOKEN_TTL_MINUTES') {
                return 30;
              }
              if (key === 'DOMAIN_SSL_PROVIDER') {
                return 'manual';
              }
              return fallback;
            },
          },
        },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate(context) {
          const request = context.switchToHttp().getRequest();
          request.user = ACTIVE_USER;
          request.storeId = ACTIVE_USER.storeId;
          return true;
        },
      })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  beforeEach(() => {
    state.themesByStore.clear();
    state.themeVersions.length = 0;
    state.previewTokens.clear();
    state.domainsById.clear();
    state.outboxEvents.length = 0;
    state.dnsPairs.clear();
  });

  after(async () => {
    await app.close();
  });

  it('updates and publishes theme config', async () => {
    const initial = await requestJson(
      '/themes/draft',
      { method: 'GET', headers: adminHeaders(false) },
      200,
      baseUrl,
    );
    assert.equal(initial.version, 1);

    const updated = await requestJson(
      '/themes/draft',
      {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify({
          config: buildComponentThemeConfig('general-starter', 'general-starter', {
            hero: {
              headline: 'واجهة جديدة',
              subheadline: 'نص تجريبي',
              primaryCtaLabel: 'تسوق',
              primaryCtaHref: '/categories',
              imageUrl: '',
            },
            products: { source: 'featured', limit: 8 },
          }),
        }),
      },
      200,
      baseUrl,
    );

    assert.equal(updated.draftConfig.settings.hero.headline, 'واجهة جديدة');

    const token = await requestJson(
      '/themes/preview-token',
      { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ expiresInMinutes: 5 }) },
      200,
      baseUrl,
    );
    assert.equal(typeof token.previewToken, 'string');

    const published = await requestJson(
      '/themes/publish',
      { method: 'POST', headers: adminHeaders(false) },
      200,
      baseUrl,
    );
    assert.equal(published.version, 2);
    assert.equal(published.publishedConfig.settings.hero.headline, 'واجهة جديدة');

    const event = state.outboxEvents.find((entry) => entry.eventType === 'theme.published');
    assert.equal(Boolean(event), true);
    assert.equal(event.payload.storeId, STORE_ID);
    assert.equal(event.payload.version, 2);
    assert.equal(Array.isArray(event.payload.invalidationPaths), true);

    const versions = await requestJson(
      '/themes/versions',
      { method: 'GET', headers: adminHeaders(false) },
      200,
      baseUrl,
    );
    assert.equal(versions.items.length, 1);
    assert.equal(versions.items[0].version, 2);

    await requestJson(
      '/themes/draft',
      {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify({
          config: buildComponentThemeConfig('general-starter', 'general-starter', {
            hero: {
              headline: 'واجهة أخرى',
              subheadline: 'نص تجريبي',
              primaryCtaLabel: 'تسوق',
              primaryCtaHref: '/categories',
              imageUrl: '',
            },
            products: { source: 'featured', limit: 8 },
          }),
        }),
      },
      200,
      baseUrl,
    );

    const restored = await requestJson(
      '/themes/versions/2/restore',
      { method: 'POST', headers: adminHeaders(false) },
      200,
      baseUrl,
    );
    assert.equal(restored.draftConfig.settings.hero.headline, 'واجهة جديدة');
  });

  it('lists and applies component templates to draft only', async () => {
    const templates = await requestJson(
      '/themes/templates',
      { method: 'GET', headers: adminHeaders(false) },
      200,
      baseUrl,
    );

    assert.equal(Array.isArray(templates.items), true);
    assert.equal(templates.items.length, 2);

    const fashionTemplate = templates.items.find(
      (entry) => entry.templateKey === 'fashion-editorial',
    );
    assert.equal(Boolean(fashionTemplate), true);
    assert.equal(fashionTemplate.rendererType, 'component');
    assert.equal(fashionTemplate.componentKey, 'fashion-editorial');
    assert.equal(fashionTemplate.defaultConfig.schemaVersion, 3);

    for (const template of templates.items) {
      const appliedTemplate = await requestJson(
        '/themes/apply-template',
        {
          method: 'POST',
          headers: adminHeaders(),
          body: JSON.stringify({ templateKey: template.templateKey }),
        },
        200,
        baseUrl,
      );

      assert.equal(appliedTemplate.draftConfig.template.id, template.templateKey);
      assert.equal(appliedTemplate.draftConfig.template.renderer, 'component');
      assert.equal(appliedTemplate.publishedConfig.template.id, 'general-starter');
    }

    const applied = await requestJson(
      '/themes/apply-template',
      {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ templateKey: 'fashion-editorial' }),
      },
      200,
      baseUrl,
    );

    assert.equal(applied.version, 1);
    assert.equal(applied.draftConfig.template.id, 'fashion-editorial');
    assert.equal(applied.draftConfig.template.componentKey, 'fashion-editorial');
    assert.equal(applied.publishedConfig.template.id, 'general-starter');

    const storedTheme = state.themesByStore.get(STORE_ID);
    assert.equal(storedTheme.draft_config.template.id, 'fashion-editorial');
    assert.equal(storedTheme.published_config.template.id, 'general-starter');
  });

  it('updates store identity design as draft and keeps published config unchanged', async () => {
    const presets = await requestJson(
      '/themes/design-presets',
      { method: 'GET', headers: adminHeaders(false) },
      200,
      baseUrl,
    );
    assert.equal(
      presets.items.some((preset) => preset.key === 'modern-tech'),
      true,
    );

    const initialDesign = await requestJson(
      '/themes/current/design',
      { method: 'GET', headers: adminHeaders(false) },
      200,
      baseUrl,
    );
    assert.equal(initialDesign.design.colors.primary, '#2563eb');

    const updated = await requestJson(
      '/themes/current/design',
      {
        method: 'PATCH',
        headers: adminHeaders(),
        body: JSON.stringify({
          design: { colors: { primary: '#0f766e' }, typography: { headingFont: 'Cairo' } },
        }),
      },
      200,
      baseUrl,
    );
    assert.equal(updated.draftConfig.design.colors.primary, '#0f766e');
    assert.equal(updated.draftConfig.design.typography.headingFont, 'Cairo');
    assert.equal(updated.publishedConfig.design.colors.primary, '#2563eb');
    assert.equal(updated.hasUnpublishedChanges, true);

    const presetApplied = await requestJson(
      '/themes/current/design/apply-preset',
      {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ presetKey: 'modern-tech' }),
      },
      200,
      baseUrl,
    );
    assert.equal(presetApplied.draftConfig.design.preset, 'modern-tech');
    assert.equal(presetApplied.publishedConfig.design.preset, 'default-clean');

    const contrast = await requestJson(
      '/themes/design/validate-contrast',
      {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ colors: presetApplied.draftConfig.design.colors }),
      },
      200,
      baseUrl,
    );
    assert.equal(
      contrast.items.some((item) => item.pair === 'primary/primaryForeground'),
      true,
    );

    const restored = await requestJson(
      '/themes/current/restore-published',
      { method: 'POST', headers: adminHeaders(false) },
      200,
      baseUrl,
    );
    assert.equal(restored.hasUnpublishedChanges, false);
    assert.equal(restored.draftConfig.design.preset, restored.publishedConfig.design.preset);
  });

  it('validates every template against the component schema', async () => {
    const templates = await requestJson(
      '/themes/templates',
      { method: 'GET', headers: adminHeaders(false) },
      200,
      baseUrl,
    );

    for (const template of templates.items) {
      assert.equal(template.rendererType, 'component');
      assert.equal(template.defaultConfig.schemaVersion, 3);
      assert.equal(template.defaultConfig.template.renderer, 'component');
      assert.equal(template.defaultConfig.template.componentKey, template.componentKey);
      assert.equal(Array.isArray(template.defaultConfig.sections), false);
    }
  });

  it('rejects old configs, unsafe content, and oversized payloads', async () => {
    await requestError(
      '/themes/draft',
      {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify({ config: { schemaVersion: 2, sections: [] } }),
      },
      400,
      'Theme config schemaVersion must be 3',
      baseUrl,
    );

    await requestError(
      '/themes/draft',
      {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify({ config: { ...buildComponentThemeConfig(), sections: [] } }),
      },
      400,
      'Theme config sections[] is not supported in schemaVersion 3',
      baseUrl,
    );

    await requestError(
      '/themes/draft',
      {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify({
          config: buildComponentThemeConfig('general-starter', 'general-starter', {
            hero: { headline: '<strong>Bad</strong>' },
            products: { limit: 8 },
          }),
        }),
      },
      400,
      'Theme setting config.settings.hero.headline cannot contain HTML',
      baseUrl,
    );

    await requestError(
      '/themes/draft',
      {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify({
          config: buildComponentThemeConfig('general-starter', 'general-starter', {
            hero: { primaryCtaHref: 'javascript:alert(1)' },
            products: { limit: 8 },
          }),
        }),
      },
      400,
      'Theme setting config.settings.hero.primaryCtaHref cannot contain unsafe URLs',
      baseUrl,
    );

    await requestError(
      '/themes/draft',
      {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify({
          config: buildComponentThemeConfig('general-starter', 'general-starter', {
            hero: { headline: 'A'.repeat(70000) },
            products: { limit: 8 },
          }),
        }),
      },
      400,
      'Theme config cannot exceed 65536 bytes',
      baseUrl,
    );
  });

  it('does not expose draft config for expired preview tokens', async () => {
    await requestJson(
      '/themes/preview-token',
      { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ expiresInMinutes: 1 }) },
      200,
      baseUrl,
    );

    const expiredToken = 'expired-preview-token';
    state.previewTokens.set(expiredToken, {
      id: randomUUID(),
      store_id: STORE_ID,
      token: expiredToken,
      expires_at: new Date(Date.now() - 1_000),
    });

    const service = app.get(ThemesService);
    await assert.rejects(
      () => service.getStorefrontTheme(STORE_ID, expiredToken),
      (error) => error.message === 'Preview token is invalid or expired',
    );
  });

  it('requires dedicated publish and rollback permissions', () => {
    const publishPermissions = Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      ThemesController.prototype.publish,
    );
    const rollbackPermissions = Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      ThemesController.prototype.restoreVersion,
    );

    assert.deepEqual(publishPermissions, [PERMISSIONS.themesWrite, PERMISSIONS.themesPublish]);
    assert.deepEqual(rollbackPermissions, [PERMISSIONS.themesWrite, PERMISSIONS.themesRollback]);
  });

  it('verifies and activates a custom domain with ssl issued status', async () => {
    const created = await requestJson(
      '/domains',
      {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ hostname: 'shop.example.com' }),
      },
      201,
      baseUrl,
    );

    await requestError(
      `/domains/${created.id}/verify`,
      { method: 'POST', headers: adminHeaders(false) },
      400,
      'Domain verification token not found in DNS TXT records',
      baseUrl,
    );

    state.dnsPairs.add(`${created.verificationDnsHost}:${created.verificationToken}`);

    const verified = await requestJson(
      `/domains/${created.id}/verify`,
      { method: 'POST', headers: adminHeaders(false) },
      200,
      baseUrl,
    );
    assert.equal(verified.status, 'verified');

    const activated = await requestJson(
      `/domains/${created.id}/activate`,
      { method: 'POST', headers: adminHeaders(false) },
      200,
      baseUrl,
    );
    assert.equal(activated.status, 'active');
    assert.equal(activated.sslStatus, 'issued');
    assert.equal(activated.routingType, 'cname');
    assert.equal(activated.routingHost, 'shop.example.com');
    assert.equal(activated.sslProvider, 'manual');
    assert.equal(typeof activated.routingTarget, 'string');
    assert.equal(activated.routingTarget.length > 0, true);

    const listed = await requestJson(
      '/domains',
      { method: 'GET', headers: adminHeaders(false) },
      200,
      baseUrl,
    );
    assert.equal(listed.length, 1);
    assert.equal(listed[0].hostname, 'shop.example.com');

    const verifiedEvent = state.outboxEvents.find((entry) => entry.eventType === 'domain.verified');
    const activatedEvent = state.outboxEvents.find(
      (entry) => entry.eventType === 'domain.activated',
    );
    assert.equal(Boolean(verifiedEvent), true);
    assert.equal(Boolean(activatedEvent), true);
  });
});

function adminHeaders(withBody = true) {
  const headers = {
    authorization: 'Bearer smoke-test-token',
    'x-store-id': STORE_ID,
  };

  if (withBody) {
    headers['content-type'] = 'application/json';
  }

  return headers;
}

async function requestJson(path, init, expectedStatus, baseUrl) {
  const response = await fetch(`${baseUrl}${path}`, init);
  if (response.status !== expectedStatus) {
    const errorBody = await response.text();
    assert.equal(
      response.status,
      expectedStatus,
      `Expected ${expectedStatus} for ${path} but got ${response.status}. Body: ${errorBody}`,
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function requestError(path, init, expectedStatus, expectedMessage, baseUrl) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json();

  assert.equal(response.status, expectedStatus, `Unexpected status for ${path}`);
  assert.equal(body.message, expectedMessage);
}

function buildComponentThemeConfig(
  templateKey = 'general-starter',
  componentKey = 'general-starter',
  settings = undefined,
) {
  return {
    schemaVersion: 3,
    template: {
      id: templateKey,
      renderer: 'component',
      componentKey,
      version: 1,
    },
    settings: settings ?? {
      hero: {
        headline: 'مرحباً بك في متجرنا',
        subheadline: 'تجربة تسوق سهلة وسريعة.',
        primaryCtaLabel: 'تصفح المنتجات',
        primaryCtaHref: '/categories',
        imageUrl: '',
      },
      products: { source: 'featured', limit: 8 },
    },
  };
}
