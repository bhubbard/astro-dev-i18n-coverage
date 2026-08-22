import { describe, it, expect } from 'bun:test';
import {
  scanText,
  isDotNotationKey,
  I18N_PATTERNS
} from '../src/scanner';

describe('scanner: isDotNotationKey', () => {
  it('accepts valid nested i18n keys', () => {
    expect(isDotNotationKey('homepage.hero.title')).toBe(true);
    expect(isDotNotationKey('nav.links.about')).toBe(true);
    expect(isDotNotationKey('auth.login.submit_btn')).toBe(true);
    expect(isDotNotationKey('common.errors.not_found')).toBe(true);
  });

  it('rejects code identifiers and runtime globals', () => {
    expect(isDotNotationKey('window.ai')).toBe(false);
    expect(isDotNotationKey('console.log')).toBe(false);
    expect(isDotNotationKey('process.env')).toBe(false);
  });

  it('rejects file paths and asset extensions', () => {
    expect(isDotNotationKey('logo.svg')).toBe(false);
    expect(isDotNotationKey('bundle.min.js')).toBe(false);
    expect(isDotNotationKey('styles.module.css')).toBe(false);
    expect(isDotNotationKey('image.webp')).toBe(false);
  });

  it('rejects URLs and plain words', () => {
    expect(isDotNotationKey('https://astro.build')).toBe(false);
    expect(isDotNotationKey('hello-world')).toBe(false);
    expect(isDotNotationKey('192.168.1.1')).toBe(false);
  });
});

describe('scanner: scanText pattern detection', () => {
  it('detects [missing: key] tags', () => {
    const text = 'Welcome to our site! [missing: homepage.welcome_message]';
    const matches = scanText(text);

    expect(matches.length).toBe(1);
    expect(matches[0].key).toBe('homepage.welcome_message');
    expect(matches[0].confidence).toBe('high');
    expect(matches[0].patternType).toBe('missing-tag');
  });

  it('detects [missing: key | Fallback] tags with inline fallback values', () => {
    const text = '<nav><span>[missing: nav.home | Home]</span></nav>';
    const matches = scanText(text);

    expect(matches.length).toBe(1);
    expect(matches[0].key).toBe('nav.home');
    expect(matches[0].fallbackValue).toBe('Home');
    expect(matches[0].patternType).toBe('missing-tag');
  });

  it('detects MISSING_TRANSLATION: prefixes', () => {
    const text = '<div>MISSING_TRANSLATION: auth.login.button</div>';
    const matches = scanText(text);

    expect(matches.length).toBe(1);
    expect(matches[0].key).toBe('auth.login.button');
    expect(matches[0].confidence).toBe('high');
  });

  it('detects template tags {{t:key}} and {{missing:key | Fallback}}', () => {
    const text = '<button>{{t: cart.checkout | Proceed to Checkout}}</button>';
    const matches = scanText(text);

    expect(matches.length).toBe(1);
    expect(matches[0].key).toBe('cart.checkout');
    expect(matches[0].fallbackValue).toBe('Proceed to Checkout');
    expect(matches[0].patternType).toBe('template-tag');
  });

  it('detects bracket tags [[key]] and [i18n: key]', () => {
    const text = '<footer>[[footer.copyright]] and [i18n: footer.privacy]</footer>';
    const matches = scanText(text);

    expect(matches.length).toBe(2);
    expect(matches[0].key).toBe('footer.copyright');
    expect(matches[1].key).toBe('footer.privacy');
  });

  it('detects bare dot notation keys in HTML text', () => {
    const text = '<div><h1>homepage.hero.title</h1><p>Some actual text</p></div>';
    const matches = scanText(text, { detectDotNotation: true });

    expect(matches.some(m => m.key === 'homepage.hero.title')).toBe(true);
  });

  it('supports custom regex patterns', () => {
    const text = '<div>%%custom_i18n:special.key%%</div>';
    const matches = scanText(text, {
      customPatterns: [/%%custom_i18n:([a-zA-Z0-9_.]+)%%/]
    });

    expect(matches.some(m => m.key === 'special.key')).toBe(true);
  });

  it('deduplicates repeating keys in same scan', () => {
    const text = '<div>[missing: common.close] and [missing: common.close]</div>';
    const matches = scanText(text);

    expect(matches.length).toBe(1);
    expect(matches[0].key).toBe('common.close');
  });
});
