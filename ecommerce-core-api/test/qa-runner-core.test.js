const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const { calculateQaScore } = require('../dist/qa/utils/qa-score.util');
const { createQaScenarioChecksum } = require('../dist/qa/utils/qa-scenario-checksum');
const { normalizeQaScenario } = require('../dist/qa/utils/qa-scenario-normalizer');
const { QaImportService } = require('../dist/qa/qa-import.service');
const { QaSummaryService } = require('../dist/qa/qa-summary.service');

function scenarioFixture() {
  return {
    scenarioId: 'merchant-test',
    version: '1.0.0',
    title: 'سيناريو اختبار',
    description: 'وصف',
    metadata: { checksum: 'sha256:abc' },
    phases: [
      {
        phaseId: 'MJ-TEST-PH-001',
        order: 1,
        title: 'مرحلة',
        sourceTitle: 'المرحلة الأولى: مرحلة',
        instructions: [{ instructionId: 'MJ-TEST-PH-001-INST-001', order: 1, text: 'افعل' }],
        checks: [{ checkId: 'MJ-TEST-PH-001-CHK-001', order: 1, text: 'تحقق', type: 'status' }],
        questions: [
          { questionId: 'MJ-TEST-PH-001-Q-001', order: 1, text: 'ما رأيك؟', type: 'textarea' },
        ],
      },
    ],
  };
}

describe('QA runner core utilities', () => {
  it('calculates readiness with blocking issues', () => {
    const score = calculateQaScore({
      totalChecks: 2,
      answers: [
        { phaseId: 'phase-1', status: 'pass' },
        { phaseId: 'phase-1', status: 'pass' },
      ],
      issues: [{ phaseId: 'phase-1', severity: 'critical', isBlocking: true }],
    });

    assert.equal(score.successPercent, 100);
    assert.equal(score.readinessStatus, 'blocked');
    assert.equal(score.criticalIssuesCount, 1);
  });

  it('creates deterministic checksums independent of object key order', () => {
    const left = createQaScenarioChecksum({ b: 2, a: { y: 1, x: 2 } });
    const right = createQaScenarioChecksum({ a: { x: 2, y: 1 }, b: 2 });
    assert.equal(left, right);
  });

  it('normalizes scenario definitions and extracts counts', () => {
    const normalized = normalizeQaScenario(scenarioFixture());
    assert.equal(normalized.scenarioKey, 'merchant-test');
    assert.equal(normalized.phases.length, 1);
    assert.equal(normalized.phases[0].checks.length, 1);
    assert.equal(normalized.phases[0].questions.length, 1);
  });

  it('accepts scenarioKey as the scenario identifier', () => {
    const scenario = scenarioFixture();
    scenario.scenarioKey = 'merchant-key-test';
    delete scenario.scenarioId;
    const normalized = normalizeQaScenario(scenario);
    assert.equal(normalized.scenarioKey, 'merchant-key-test');
  });

  it('rejects malformed optional phase arrays', () => {
    const scenario = scenarioFixture();
    scenario.phases[0].checks = {};
    assert.throws(
      () => normalizeQaScenario(scenario),
      /Invalid QA scenario JSON: phase\[0\]\.checks must be an array/,
    );
  });

  it('rejects duplicate check keys during normalization', () => {
    const scenario = scenarioFixture();
    scenario.phases[0].checks.push({ ...scenario.phases[0].checks[0] });
    assert.throws(() => normalizeQaScenario(scenario), /Duplicate checkId/);
  });
});

describe('QA import and summary services', () => {
  it('imports a normalized scenario through repository transaction', async () => {
    const imported = [];
    const service = new QaImportService({
      async transaction(callback) {
        return callback({});
      },
      async upsertScenario(scenario) {
        imported.push(scenario.scenarioKey);
        return {
          imported: true,
          scenario: {
            id: 'scenario-1',
            scenario_key: scenario.scenarioKey,
            version: scenario.version,
            checksum: scenario.checksum,
          },
        };
      },
      async logRunEvent() {},
    });

    const result = await service.importScenario(scenarioFixture(), true);
    assert.deepEqual(imported, ['merchant-test']);
    assert.equal(result.imported, true);
    assert.equal(result.phases, 1);
    assert.equal(result.checks, 1);
  });

  it('persists summary service output', async () => {
    let summaryInput;
    const service = new QaSummaryService({
      async findRunById() {
        return { id: 'run-1', scenario_id: 'scenario-1' };
      },
      async listAnswers() {
        return [
          { check_id: 'check-1', phase_id: 'phase-1', status: 'pass' },
          { check_id: 'check-2', phase_id: 'phase-1', status: 'fail' },
        ];
      },
      async listRunIssues() {
        return [{ phase_id: 'phase-1', severity: 'high', is_blocking: false }];
      },
      async countScenarioChecks() {
        return 2;
      },
      async upsertSummary(input) {
        summaryInput = input;
        return { id: 'summary-1', ...input };
      },
    });

    const summary = await service.calculateAndPersist('run-1');
    assert.equal(summaryInput.successPercent, 50);
    assert.equal(summary.readinessStatus, 'not_ready');
    assert.equal(summary.highIssuesCount, 1);
  });
});
