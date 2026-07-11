const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeThemeConfig,
  setHomeSectionsInConfig,
} = require('../dist/themes/utils/theme-config-normalizer');
const { validateHomeSections } = require('../dist/themes/theme-home-sections');

test('normalizeThemeConfig migrates legacy homeSections into pages.home.sections', () => {
  const normalized = normalizeThemeConfig({
    schemaVersion: 3,
    template: {
      id: 'general-starter',
      renderer: 'component',
      componentKey: 'general-starter',
      version: 1,
    },
    settings: {},
    homeSections: [
      { id: 'hero-main', type: 'hero', variant: 'split', enabled: true, settings: {} },
    ],
  });

  assert.equal(Object.hasOwn(normalized, 'homeSections'), false);
  assert.equal(normalized.pages.home.sections.length, 1);
  assert.equal(normalized.pages.home.sections[0].id, 'hero-main');
});

test('normalizeThemeConfig maps legacy design tokens to the official contract', () => {
  const normalized = normalizeThemeConfig({
    schemaVersion: 3,
    template: {
      id: 'general-starter',
      renderer: 'component',
      componentKey: 'general-starter',
      version: 1,
    },
    settings: {},
    design: {
      buttons: { style: 'outlined' },
      cards: { style: 'not-real' },
      typography: { headingFont: 'Unknown Font' },
    },
  });

  assert.equal(normalized.design.buttons.style, 'outline');
  assert.equal(normalized.design.cards.style, 'soft-shadow');
  assert.equal(normalized.design.typography.headingFont, 'Cairo');
});

test('validateHomeSections strips unsupported source types before save', () => {
  const sections = validateHomeSections([
    {
      id: 'products-main',
      type: 'products',
      variant: 'grid',
      enabled: true,
      settings: {},
      source: { type: 'offers', limit: 5 },
    },
  ]);

  assert.equal(sections[0].source.type, 'featured');
  assert.equal(sections[0].source.limit, 12);
});

test('setHomeSectionsInConfig writes only to pages.home.sections', () => {
  const normalized = setHomeSectionsInConfig(
    {
      schemaVersion: 3,
      template: {
        id: 'general-starter',
        renderer: 'component',
        componentKey: 'general-starter',
        version: 1,
      },
      settings: {},
      homeSections: [
        { id: 'old-hero', type: 'hero', variant: 'split', enabled: true, settings: {} },
      ],
    },
    [{ id: 'new-hero', type: 'hero', variant: 'split', enabled: true, settings: {} }],
  );

  assert.equal(Object.hasOwn(normalized, 'homeSections'), false);
  assert.equal(normalized.pages.home.sections[0].id, 'new-hero');
});
