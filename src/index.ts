/**
 * astro-dev-i18n-coverage
 * Astro Dev Toolbar integration that scans rendered DOM for missing/untranslated i18n keys,
 * translates them using Chrome Built-in AI, and outputs ready-to-use locale JSON files.
 */

import type { AstroIntegration } from 'astro';

export interface I18nCoverageIntegrationOptions {
  /**
   * Default source locale (defaults to 'en').
   */
  defaultSourceLocale?: string;

  /**
   * Default target locale (defaults to 'es').
   */
  defaultTargetLocale?: string;

  /**
   * Whether to scan bare dot-notation tokens (e.g. `homepage.hero.title`).
   * Defaults to true.
   */
  detectDotNotation?: boolean;

  /**
   * Additional custom regex patterns to detect missing translations.
   */
  customPatterns?: RegExp[];

  /**
   * CSS selectors to ignore during DOM scans (e.g. `['.ignore-i18n']`).
   */
  ignoreSelectors?: string[];
}

const I18N_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;

export function astroDevI18nCoverage(options: I18nCoverageIntegrationOptions = {}): AstroIntegration {
  return {
    name: 'astro-dev-i18n-coverage',
    hooks: {
      'astro:config:setup': ({ addDevToolbarApp }) => {
        const appEntry = new URL('./app.js', import.meta.url).pathname;

        addDevToolbarApp({
          id: 'astro-dev-i18n-coverage',
          name: 'i18n Coverage',
          icon: I18N_ICON,
          entrypoint: appEntry
        });
      }
    }
  };
}

export default astroDevI18nCoverage;

export * from './scanner';
export * from './translator';
