const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { PlatformCoreController } = require('../dist/platform-admin/core/platform-core.controller');
const {
  PlatformBillingController,
} = require('../dist/platform-admin/billing/platform-billing.controller');
const {
  PlatformOperationsController,
} = require('../dist/platform-admin/operations/platform-operations.controller');
const {
  PLATFORM_REQUIRED_PERMISSIONS_KEY,
} = require('../dist/platform/decorators/require-platform-permissions.decorator');
const {
  PLATFORM_PERMISSIONS,
} = require('../dist/platform/constants/platform-permissions.constants');

describe('Sprint 15 platform admin permission matrix', () => {
  it('keeps read/write permission mapping on key platform endpoints', () => {
    const mapping = [
      [PlatformCoreController, 'getDashboardSummary', PLATFORM_PERMISSIONS.dashboardRead],
      [PlatformCoreController, 'listDomains', PLATFORM_PERMISSIONS.domainsRead],
      [PlatformCoreController, 'recheckDomain', PLATFORM_PERMISSIONS.domainsWrite],
      [PlatformCoreController, 'createIncident', PLATFORM_PERMISSIONS.healthWrite],
      [PlatformCoreController, 'updateIncidentStatus', PLATFORM_PERMISSIONS.healthWrite],
      [PlatformCoreController, 'listAuditLogs', PLATFORM_PERMISSIONS.auditRead],
      [PlatformBillingController, 'listPlans', PLATFORM_PERMISSIONS.plansRead],
      [PlatformBillingController, 'createPlan', PLATFORM_PERMISSIONS.plansWrite],
      [PlatformBillingController, 'assignStorePlan', PLATFORM_PERMISSIONS.subscriptionsWrite],
      [PlatformBillingController, 'listSubscriptions', PLATFORM_PERMISSIONS.subscriptionsRead],
      [PlatformBillingController, 'getFinanceOverview', PLATFORM_PERMISSIONS.financeRead],
      [PlatformOperationsController, 'listSupportCases', PLATFORM_PERMISSIONS.supportRead],
      [PlatformOperationsController, 'createSupportCase', PLATFORM_PERMISSIONS.supportWrite],
      [PlatformOperationsController, 'updateSupportCase', PLATFORM_PERMISSIONS.supportWrite],
      [PlatformOperationsController, 'listRiskViolations', PLATFORM_PERMISSIONS.riskRead],
      [PlatformOperationsController, 'createRiskViolation', PLATFORM_PERMISSIONS.riskWrite],
      [PlatformOperationsController, 'updateRiskViolationStatus', PLATFORM_PERMISSIONS.riskWrite],
      [PlatformOperationsController, 'listComplianceTasks', PLATFORM_PERMISSIONS.complianceRead],
      [PlatformOperationsController, 'createComplianceTask', PLATFORM_PERMISSIONS.complianceWrite],
      [
        PlatformOperationsController,
        'updateComplianceTaskStatus',
        PLATFORM_PERMISSIONS.complianceWrite,
      ],
    ];

    for (const [controller, methodName, expectedPermission] of mapping) {
      const handler = controller.prototype[methodName];
      const controllerName = controller.name ?? 'UnknownController';
      assert.ok(handler, `Missing handler ${controllerName}.${methodName}`);
      const requiredPermissions =
        Reflect.getMetadata(PLATFORM_REQUIRED_PERMISSIONS_KEY, handler) ?? [];
      assert.ok(
        requiredPermissions.includes(expectedPermission),
        `Expected ${controllerName}.${methodName} to require ${expectedPermission}. Got: ${requiredPermissions.join(', ')}`,
      );
    }
  });
});
