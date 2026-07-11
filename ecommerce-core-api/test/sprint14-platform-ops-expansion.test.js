require('reflect-metadata');

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { randomUUID } = require('node:crypto');

const { SaasService } = require('../dist/saas/saas.service');

const CURRENT_ADMIN = {
  id: randomUUID(),
  email: 'ops@example.com',
  fullName: 'Ops Manager',
  status: 'active',
  permissions: ['*'],
  roleCodes: ['ops_manager'],
  sessionId: randomUUID(),
};

const CONTEXT = {
  requestId: randomUUID(),
  ipAddress: '127.0.0.1',
  userAgent: 'test-agent',
};

describe('Sprint 14 platform ops expansion', () => {
  it('creates automation rule and manual run', async () => {
    const actions = [];
    let persistedRule = null;
    const repository = {
      async createPlatformAutomationRule(input) {
        const rule = {
          id: randomUUID(),
          name: input.name,
          description: input.description,
          trigger_type: input.triggerType,
          trigger_config: input.triggerConfig,
          action_type: input.actionType,
          action_config: input.actionConfig,
          is_active: input.isActive,
          last_run_at: null,
          created_by_admin_id: input.createdByAdminId,
          updated_by_admin_id: input.createdByAdminId,
          created_at: new Date(),
          updated_at: new Date(),
        };
        persistedRule = rule;
        actions.push(['createRule', input]);
        return rule;
      },
      async findPlatformAutomationRuleById(ruleId) {
        if (!persistedRule || persistedRule.id !== ruleId) {
          return null;
        }
        return persistedRule;
      },
      async createPlatformAutomationRun(input) {
        actions.push(['createRun', input]);
        return {
          id: randomUUID(),
          rule_id: input.ruleId,
          status: input.status,
          triggered_by_admin_id: input.triggeredByAdminId,
          store_id: input.storeId,
          started_at: new Date(),
          finished_at: new Date(),
          logs: input.logs,
          metadata: input.metadata,
          created_at: new Date(),
        };
      },
      async updatePlatformAutomationRun(input) {
        actions.push(['updateRun', input]);
        return {
          id: randomUUID(),
          rule_id: persistedRule?.id ?? randomUUID(),
          status: input.status,
          triggered_by_admin_id: CURRENT_ADMIN.id,
          store_id: null,
          started_at: new Date(),
          finished_at: input.status === 'running' ? null : new Date(),
          logs: input.logs ?? null,
          metadata: {},
          created_at: new Date(),
        };
      },
    };
    const auditService = {
      async log(entry) {
        actions.push(['audit', entry.action]);
      },
    };
    const service = new SaasService(repository, auditService);

    const createdRule = await service.createPlatformAutomationRule(
      {
        name: 'Follow-up unpaid invoices',
        triggerType: 'schedule',
        triggerConfig: { cron: '0 */4 * * *' },
        actionType: 'notify',
        actionConfig: { channel: 'email' },
      },
      CURRENT_ADMIN,
      CONTEXT,
    );
    assert.equal(createdRule.name, 'Follow-up unpaid invoices');

    const run = await service.triggerPlatformAutomationRule(
      createdRule.id,
      { metadata: { source: 'test' } },
      CURRENT_ADMIN,
      CONTEXT,
    );
    assert.equal(run.ruleId, createdRule.id);
    assert.equal(run.status, 'queued');
    assert.equal(
      actions.some((entry) => entry[0] === 'audit'),
      true,
    );
  });

  it('creates and updates support case', async () => {
    const createdId = randomUUID();
    const repository = {
      async createPlatformSupportCase(input) {
        return {
          id: createdId,
          store_id: input.storeId,
          subject: input.subject,
          description: input.description,
          priority: input.priority,
          status: input.status,
          queue: input.queue,
          assignee_admin_id: input.assigneeAdminId,
          assignee_name: null,
          sla_due_at: null,
          impact_score: input.impactScore,
          created_by_admin_id: input.createdByAdminId,
          created_by_name: null,
          resolved_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        };
      },
      async createPlatformSupportCaseEvent() {
        return;
      },
      async updatePlatformSupportCase(input) {
        return {
          id: input.caseId,
          store_id: null,
          subject: 'Case',
          description: 'Case description',
          priority: 'high',
          status: input.status ?? 'open',
          queue: input.queue ?? 'general',
          assignee_admin_id: input.assigneeAdminId ?? null,
          assignee_name: null,
          sla_due_at: null,
          impact_score: 80,
          created_by_admin_id: CURRENT_ADMIN.id,
          created_by_name: CURRENT_ADMIN.fullName,
          resolved_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        };
      },
    };
    const auditService = {
      async log() {
        return;
      },
    };
    const service = new SaasService(repository, auditService);

    const created = await service.createPlatformSupportCase(
      {
        subject: 'Store checkout failing',
        description: 'Customer cannot complete checkout',
        priority: 'high',
      },
      CURRENT_ADMIN,
      CONTEXT,
    );
    assert.equal(created.id, createdId);

    const updated = await service.updatePlatformSupportCase(
      createdId,
      { status: 'in_progress' },
      CURRENT_ADMIN,
      CONTEXT,
    );
    assert.equal(updated.status, 'in_progress');
  });

  it('returns finance overview from repository', async () => {
    const repository = {
      async getPlatformFinanceOverview() {
        return {
          totalMrr: 1234,
          openInvoicesAmount: 200,
          failedInvoicesAmount: 50,
          overdueInvoicesCount: 3,
          activePaidSubscriptions: 20,
        };
      },
      async listPlatformFinanceAging() {
        return [];
      },
      async listPlatformFinanceCollections() {
        return [];
      },
    };
    const auditService = {
      async log() {
        return;
      },
    };
    const service = new SaasService(repository, auditService);

    const overview = await service.getPlatformFinanceOverview();
    assert.equal(overview.totalMrr, 1234);
    assert.equal(overview.overdueInvoicesCount, 3);
  });
});
