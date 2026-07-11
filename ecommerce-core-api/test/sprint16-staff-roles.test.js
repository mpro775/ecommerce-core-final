const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  STORE_ROLE_PRESETS,
  TEAM_ROLE_CODES,
} = require('../dist/auth/constants/store-role-presets.constants');
const { UsersService } = require('../dist/users/users.service');

describe('Sprint 16 staff role presets', () => {
  it('keeps owner and legacy staff out of assignable team roles', () => {
    assert.ok(!TEAM_ROLE_CODES.includes('owner'));
    assert.ok(!TEAM_ROLE_CODES.includes('staff'));
    assert.ok(TEAM_ROLE_CODES.includes('manager'));
  });

  it('does not grant wildcard permissions through team role presets', () => {
    for (const preset of STORE_ROLE_PRESETS) {
      assert.ok(
        !preset.defaultPermissions.includes('*'),
        `${preset.code} grants wildcard by default`,
      );
      assert.ok(!preset.allowedPermissions.includes('*'), `${preset.code} allows wildcard`);
    }
  });

  it('rejects permissions outside the selected role scope', () => {
    const service = new UsersService({}, {}, {}, {}, {});

    assert.throws(
      () => service.resolvePermissionsForRole('support', ['products:write']),
      /outside the allowed scope/,
    );
  });

  it('rejects wildcard permissions for non-owner roles', () => {
    const service = new UsersService({}, {}, {}, {}, {});

    assert.throws(
      () => service.resolvePermissionsForRole('manager', ['*']),
      /Full access is reserved/,
    );
  });
});
