const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { AuditService } = require('../dist/audit/audit.service');

describe('AuditService INSERT statement', () => {
  it('has 17 placeholders and sends valid JSONB for snapshot/metadata fields', async () => {
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
        action: 'auth.login_succeeded',
        beforeSnapshot,
        afterSnapshot,
        metadata,
      },
      mockDb,
    );

    // 1. Ensure there are 17 placeholders ($1 ... $17)
    const placeholders = capturedQuery.match(/\$\d+/g) || [];
    assert.equal(placeholders.length, 17, 'INSERT should have 17 placeholders');
    assert.ok(placeholders.includes('$17'), 'Last placeholder should be $17');

    // 2. Ensure there are 17 values
    assert.equal(capturedValues.length, 17, 'Should send exactly 17 values');

    // 3. Ensure metadata is value #17
    assert.deepStrictEqual(capturedValues[16], metadata, 'Value 17 should be metadata');

    // 4. Ensure before_snapshot and after_snapshot are sent as objects (JSONB-ready)
    assert.deepStrictEqual(
      capturedValues[11],
      beforeSnapshot,
      'before_snapshot should be the object',
    );
    assert.deepStrictEqual(
      capturedValues[12],
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

    assert.equal(capturedValues.length, 17);
    assert.equal(capturedValues[11], null, 'before_snapshot should be null');
    assert.equal(capturedValues[12], null, 'after_snapshot should be null');
    assert.deepStrictEqual(capturedValues[16], {}, 'metadata should default to empty object');
  });
});
