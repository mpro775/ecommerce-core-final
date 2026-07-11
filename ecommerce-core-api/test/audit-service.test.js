const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { AuditService } = require('../dist/audit/audit.service');

describe('AuditService INSERT statement', () => {
  it('has 18 placeholders and sends valid JSONB for snapshot/metadata fields', async () => {
    let capturedQuery = '';
    let capturedValues = [];

    const mockDb = {
      query: async (queryText, values) => {
        capturedQuery = queryText;
        capturedValues = values;
        return { rows: [], rowCount: 1 };
      },
    };

    // Minimal mock for DatabaseService dependency injection
    const auditService = new AuditService({ db: mockDb });

    const beforeSnapshot = { email: 'old@example.com' };
    const afterSnapshot = { email: 'new@example.com' };
    const metadata = { requestId: 'req-123', source: 'test' };

    await auditService.log(
      {
        storeId: null,
        storeUserId: null,
        platformAdminId: 'admin-1',
        action: 'platform.auth.login_succeeded',
        beforeSnapshot,
        afterSnapshot,
        metadata,
      },
      mockDb,
    );

    // 1. Ensure there are 18 placeholders ($1 ... $18)
    const placeholders = capturedQuery.match(/\$\d+/g) || [];
    assert.equal(placeholders.length, 18, 'INSERT should have 18 placeholders');
    assert.ok(placeholders.includes('$18'), 'Last placeholder should be $18');

    // 2. Ensure there are 18 values
    assert.equal(capturedValues.length, 18, 'Should send exactly 18 values');

    // 3. Ensure metadata is value #18
    assert.deepStrictEqual(capturedValues[17], metadata, 'Value 18 should be metadata');

    // 4. Ensure before_snapshot and after_snapshot are sent as objects (JSONB-ready)
    assert.deepStrictEqual(
      capturedValues[12],
      beforeSnapshot,
      'before_snapshot should be the object',
    );
    assert.deepStrictEqual(
      capturedValues[13],
      afterSnapshot,
      'after_snapshot should be the object',
    );
  });

  it('sends null for absent snapshot/metadata fields', async () => {
    let capturedValues = [];

    const mockDb = {
      query: async (_queryText, values) => {
        capturedValues = values;
        return { rows: [], rowCount: 1 };
      },
    };

    const auditService = new AuditService({ db: mockDb });

    await auditService.log(
      {
        storeId: null,
        storeUserId: null,
        action: 'auth.login',
      },
      mockDb,
    );

    assert.equal(capturedValues.length, 18);
    assert.equal(capturedValues[12], null, 'before_snapshot should be null');
    assert.equal(capturedValues[13], null, 'after_snapshot should be null');
    assert.deepStrictEqual(capturedValues[17], {}, 'metadata should default to empty object');
  });
});
