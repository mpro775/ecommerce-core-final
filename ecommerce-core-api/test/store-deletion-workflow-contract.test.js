const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { describe, it } = require('node:test');

const { PlatformCoreController } = require('../dist/platform-admin/core/platform-core.controller');
const {
  PLATFORM_REQUIRED_PERMISSIONS_KEY,
} = require('../dist/platform/decorators/require-platform-permissions.decorator');
const {
  PLATFORM_PERMISSIONS,
} = require('../dist/platform/constants/platform-permissions.constants');

describe('store deletion workflow contract', () => {
  it('exposes deletion endpoints behind dedicated dangerous permissions', () => {
    const mapping = [
      ['previewStoreDeletion', PLATFORM_PERMISSIONS.storesDeletePreview],
      ['confirmStoreDeletion', PLATFORM_PERMISSIONS.storesDeleteConfirm],
      ['getStoreDeletionStatus', PLATFORM_PERMISSIONS.storesDeleteStatus],
      ['retryStorePurge', PLATFORM_PERMISSIONS.storesPurgeRetry],
    ];

    for (const [methodName, expectedPermission] of mapping) {
      const handler = PlatformCoreController.prototype[methodName];
      assert.ok(handler, `Missing handler PlatformCoreController.${methodName}`);
      const requiredPermissions =
        Reflect.getMetadata(PLATFORM_REQUIRED_PERMISSIONS_KEY, handler) ?? [];
      assert.ok(
        requiredPermissions.includes(expectedPermission),
        `Expected ${methodName} to require ${expectedPermission}. Got: ${requiredPermissions.join(', ')}`,
      );
    }
  });

  it('keeps the migration soft-delete based and releases active email uniqueness', () => {
    const migration = readFileSync(
      join(__dirname, '..', 'migrations', '087_store_deletion_workflow.up.sql'),
      'utf8',
    );

    assert.match(migration, /ADD COLUMN IF NOT EXISTS status/i);
    assert.match(migration, /ADD COLUMN IF NOT EXISTS deleted_at/i);
    assert.match(migration, /ADD COLUMN IF NOT EXISTS original_email_hash/i);
    assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uniq_store_users_active_email/i);
    assert.match(migration, /WHERE deleted_at IS NULL/i);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS store_deletion_purge_jobs/i);
    assert.doesNotMatch(migration, /DELETE\s+FROM\s+stores/i);
  });
});
