const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { hashTokenDeterministic } = require('../dist/common/security/token-hash.util');
const { PermissionsGuard } = require('../dist/rbac/guards/permissions.guard');

function createHttpContext(user) {
  return {
    getHandler() {
      return 'handler';
    },
    getClass() {
      return 'class';
    },
    switchToHttp() {
      return {
        getRequest() {
          return { user };
        },
      };
    },
  };
}

describe('Phase 1/2 security and RBAC closure', () => {
  it('hashes sensitive tokens deterministically without returning the raw token', () => {
    const token = 'reset-token-123';
    const secret = 'local-test-token-secret-change-me';

    const first = hashTokenDeterministic(token, secret);
    const second = hashTokenDeterministic(token, secret);

    assert.equal(first, second);
    assert.notEqual(first, token);
    assert.match(first, /^[a-f0-9]{64}$/);
  });

  it('keeps store:write as a temporary compatibility super-permission', () => {
    const guard = new PermissionsGuard({
      getAllAndOverride() {
        return ['payments:write'];
      },
    });

    assert.equal(
      guard.canActivate(createHttpContext({ role: 'manager', permissions: ['store:write'] })),
      true,
    );
  });

  it('does not allow read-only reports access to export reports', () => {
    const guard = new PermissionsGuard({
      getAllAndOverride() {
        return ['reports:export'];
      },
    });

    assert.throws(
      () =>
        guard.canActivate(createHttpContext({ role: 'finance', permissions: ['reports:read'] })),
      /Insufficient permissions/,
    );
  });
});
