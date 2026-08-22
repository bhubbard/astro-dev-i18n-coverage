import { describe, it, expect } from 'bun:test';
import {
  keyToHumanLabel,
  buildLanguageModelPrompt,
  buildLocaleJsonTree,
  formatLocaleJson,
  deepMergeLocaleJson,
  flattenLocaleJson,
  translateKey,
  getTranslatorStatus
} from '../src/translator';
import type { MissingTranslationMatch } from '../src/scanner';

describe('translator: keyToHumanLabel', () => {
  it('converts snake_case and kebab-case last segments to title case', () => {
    expect(keyToHumanLabel('homepage.hero.cta_button')).toBe('Cta Button');
    expect(keyToHumanLabel('nav.main_menu.about-us')).toBe('About Us');
    expect(keyToHumanLabel('auth.login.submit')).toBe('Submit');
  });

  it('converts camelCase segments into spaced words', () => {
    expect(keyToHumanLabel('auth.userProfile.forgotPassword')).toBe('Forgot Password');
  });

  it('handles single segment keys', () => {
    expect(keyToHumanLabel('welcome_message')).toBe('Welcome Message');
  });
});

describe('translator: buildLanguageModelPrompt', () => {
  it('constructs prompt with source, target, key, and context', () => {
    const prompt = buildLanguageModelPrompt(
      'nav.links.home',
      'Home',
      'en',
      'es',
      '<nav> [Section: "Navigation"] Text: "Home About Contact"'
    );

    expect(prompt).toContain('Source Language: en');
    expect(prompt).toContain('Target Language: es');
    expect(prompt).toContain('i18n Key: "nav.links.home"');
    expect(prompt).toContain('Source Text / Fallback: "Home"');
    expect(prompt).toContain('Surrounding UI Context');
    expect(prompt).toContain('Preserve any interpolated placeholders');
  });
});

describe('translator: JSON Locale Tree Utilities', () => {
  it('buildLocaleJsonTree transforms flat dot keys into deep nested objects', () => {
    const translations = [
      { key: 'nav.links.home', value: 'Inicio' },
      { key: 'nav.links.about', value: 'Acerca de' },
      { key: 'nav.cta', value: 'Empezar' },
      { key: 'footer.copyright', value: 'Todos los derechos reservados' }
    ];

    const tree = buildLocaleJsonTree(translations);

    expect(tree).toEqual({
      nav: {
        links: {
          home: 'Inicio',
          about: 'Acerca de'
        },
        cta: 'Empezar'
      },
      footer: {
        copyright: 'Todos los derechos reservados'
      }
    });
  });

  it('buildLocaleJsonTree accepts record objects', () => {
    const record = {
      'hero.title': 'Bienvenue',
      'hero.subtitle': 'Découvrez le futur'
    };

    const tree = buildLocaleJsonTree(record);
    expect(tree).toEqual({
      hero: {
        title: 'Bienvenue',
        subtitle: 'Découvrez le futur'
      }
    });
  });

  it('formatLocaleJson outputs formatted JSON string', () => {
    const tree = {
      common: {
        save: 'Guardar'
      }
    };

    const formatted = formatLocaleJson(tree);
    expect(formatted).toBe('{\n  "common": {\n    "save": "Guardar"\n  }\n}');
  });

  it('deepMergeLocaleJson merges objects without overwriting siblings', () => {
    const base = {
      nav: {
        home: 'Home'
      },
      footer: {
        terms: 'Terms'
      }
    };

    const incoming = {
      nav: {
        about: 'About',
        home: 'Home Updated'
      },
      auth: {
        login: 'Login'
      }
    };

    const merged = deepMergeLocaleJson(base, incoming);

    expect(merged).toEqual({
      nav: {
        home: 'Home Updated',
        about: 'About'
      },
      footer: {
        terms: 'Terms'
      },
      auth: {
        login: 'Login'
      }
    });
  });

  it('flattenLocaleJson flattens nested object back into dot notation', () => {
    const nested = {
      checkout: {
        step1: {
          title: 'Shipping',
          zip: 'Postal Code'
        },
        button: 'Pay Now'
      }
    };

    const flat = flattenLocaleJson(nested);

    expect(flat).toEqual({
      'checkout.step1.title': 'Shipping',
      'checkout.step1.zip': 'Postal Code',
      'checkout.button': 'Pay Now'
    });
  });
});

describe('translator: translateKey & getTranslatorStatus fallback', () => {
  it('falls back to heuristic when running in non-browser/non-AI environment', async () => {
    const match: MissingTranslationMatch = {
      id: 'm1',
      key: 'settings.account_security',
      rawText: '[missing: settings.account_security]',
      context: '<section> Text: "Security"',
      confidence: 'high',
      patternType: 'missing-tag'
    };

    const result = await translateKey(match, 'en', 'es');

    expect(result.key).toBe('settings.account_security');
    expect(result.sourceText).toBe('Account Security');
    expect(result.method).toBe('heuristic-fallback');
  });

  it('uses fallbackValue when present in missing match', async () => {
    const match: MissingTranslationMatch = {
      id: 'm2',
      key: 'nav.pricing',
      rawText: '[missing: nav.pricing | Plans & Pricing]',
      context: '<nav>',
      fallbackValue: 'Plans & Pricing',
      confidence: 'high',
      patternType: 'missing-tag'
    };

    const result = await translateKey(match, 'en', 'fr');

    expect(result.sourceText).toBe('Plans & Pricing');
    expect(result.translatedText).toBe('Plans & Pricing');
  });

  it('reports unavailable status in Node/Bun non-window environment', async () => {
    const status = await getTranslatorStatus('en', 'es');
    expect(status.hasChromeAI).toBe(false);
    expect(status.hasTranslator).toBe(false);
    expect(status.availability).toBe('unavailable');
  });
});
