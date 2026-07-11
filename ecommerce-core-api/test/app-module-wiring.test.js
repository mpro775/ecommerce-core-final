const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { Test } = require('@nestjs/testing');
const { AppModule } = require('../dist/app.module');

describe('AppModule DI Wiring', () => {
  it('should compile successfully and resolve all dependencies', async () => {
    let moduleRef;
    try {
      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      assert.ok(moduleRef, 'AppModule should compile without errors');
    } catch (err) {
      assert.fail(`AppModule failed to compile: ${err.stack}`);
    } finally {
      if (moduleRef) {
        await moduleRef.close();
      }
    }
  });
});
