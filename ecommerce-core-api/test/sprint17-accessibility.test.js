const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
  assertThemeAccessibility,
  auditThemeAccessibility,
  validateThemeConfig,
} = require('../dist/themes/theme-config.validator');

function buildThemeConfig(color = {}) {
  return {
    schemaVersion: 3,
    template: {
      id: 'general-starter',
      renderer: 'component',
      componentKey: 'general-starter',
      version: 1,
    },
    globals: {
      color,
    },
    settings: {
      hero: {
        headline: 'Accessible storefront',
      },
    },
  };
}

describe('accessibility theme audit', () => {
  it('normalizes accessibility settings into theme config', () => {
    const config = validateThemeConfig(buildThemeConfig());
    assert.deepEqual(config.accessibility, {
      contrastMode: 'normal',
      reducedMotion: false,
      fontScale: 1,
      underlineLinks: false,
      strongFocusRing: true,
      accessibleAnimations: true,
    });
  });

  it('blocks critical color contrast failures', () => {
    const config = buildThemeConfig({
      bg: '#ffffff',
      text: '#ffffff',
      textMuted: '#ffffff',
      primary: '#ffffff',
      primaryContrast: '#ffffff',
      heroText: '#ffffff',
      heroSecondary: '#ffffff',
    });

    const audit = auditThemeAccessibility(config);
    assert.ok(audit.issues.some((issue) => issue.severity === 'critical'));
    assert.throws(() => assertThemeAccessibility(config), /critical accessibility contrast/i);
  });

  it('reports serious non-contrast accessibility issues without blocking publish', () => {
    const config = buildThemeConfig();
    config.accessibility = {
      strongFocusRing: false,
      reducedMotion: false,
      accessibleAnimations: false,
    };
    config.settings.hero.imageUrl = 'https://cdn.example.com/hero.jpg';

    const audit = auditThemeAccessibility(config);
    assert.ok(audit.issues.some((issue) => issue.severity === 'serious'));
    assert.doesNotThrow(() => assertThemeAccessibility(config));
  });
});
