# astro-dev-i18n-coverage

[![npm version](https://img.shields.io/badge/npm-v1.0.0-blue.svg)](https://www.npmjs.com)
[![Astro](https://img.shields.io/badge/Astro-5.0+-BC52EE.svg)](https://astro.build)
[![Chrome AI](https://img.shields.io/badge/Chrome_Built--in_AI-Gemini_Nano-4285F4.svg)](https://developer.chrome.com/docs/ai/built-in)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-3178C6.svg)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-code.brandonhubbard.com-brightgreen?logo=github)](https://code.brandonhubbard.com/astro-dev-i18n-coverage/)

**`astro-dev-i18n-coverage`** is an **Astro Dev Toolbar** integration that scans the rendered DOM in real-time for missing or untranslated i18n keys and placeholder tags. It passes surrounding DOM context to **Chrome Built-in AI** (`window.ai.translator` or `window.ai.languageModel` / Gemini Nano) and renders an interactive diff card with suggested translations and a **1-click "Copy to locale JSON"** button.

> 🎮 **Live Interactive Visualizer & Demo:** [astro-dev-i18n-coverage on code.brandonhubbard.com](https://code.brandonhubbard.com/astro-dev-i18n-coverage/)

---

## 🚀 Features

- 🔍 **Live DOM Scanner**: Automatically detects missing translations, bracketed keys (`[missing: key]`), template tags (`{{t:key}}`), and bare dot-notation keys (`homepage.hero.title`).
- ⚡ **Chrome Built-in AI**: Uses on-device `window.ai.translator` or Gemini Nano (`window.ai.languageModel`) for zero-latency, private, localized translation suggestions without API keys or cloud costs.
- 🎯 **Context-Aware Translations**: Passes parent element tags, section headings, and surrounding text to the model to produce contextually accurate UI copy.
- 🔄 **Interactive Diff Cards**: Visualizes source text vs suggested localized translations with confidence badges and translation method indicators.
- 📋 **1-Click JSON Tree Exporter**: Generates properly nested locale JSON structures (e.g. `{ "homepage": { "hero": { "title": "..." } } }`) ready to paste into `es.json`, `fr.json`, or your Astro i18n dictionary.
- 💡 **In-Page Visual Highlighter**: Outlines elements missing translations directly on your web page with dashed highlighting.
- 🔄 **Dynamic Mutation Tracking**: Watches for client-side island changes and dynamic DOM mutations with `MutationObserver`.

---

## 📦 Installation

```bash
# Using bun
bun add astro-dev-i18n-coverage

# Using pnpm
pnpm add astro-dev-i18n-coverage

# Using npm
npm install astro-dev-i18n-coverage
```

---

## 🛠️ Usage

Add the integration to your `astro.config.mjs`:

```javascript
import { defineConfig } from 'astro/config';
import astroDevI18nCoverage from 'astro-dev-i18n-coverage';

export default defineConfig({
  integrations: [
    astroDevI18nCoverage({
      defaultSourceLocale: 'en',
      defaultTargetLocale: 'es',
      detectDotNotation: true
    })
  ]
});
```

Start your dev server:

```bash
bun dev
```

Open your Astro site in Chrome and click on the **🌐 i18n Coverage** icon in the Astro Dev Toolbar.

---

## 🌐 Supported i18n Detection Patterns

`astro-dev-i18n-coverage` recognizes standard missing key patterns used across popular i18n frameworks (Astro i18n, vue-i18n, i18next, astro-i18next, Rosetta, etc.):

| Pattern Type | Syntax Example | Detected Key & Fallback |
| :--- | :--- | :--- |
| **Missing Tags** | `[missing: nav.home]` or `[missing: nav.home \| Home]` | Key: `nav.home`, Fallback: `Home` |
| **Prefix Markers** | `MISSING_TRANSLATION: auth.login.btn` | Key: `auth.login.btn` |
| **Template Tags** | `{{t: cart.checkout \| Checkout}}` | Key: `cart.checkout`, Fallback: `Checkout` |
| **Bracket Tags** | `[[footer.privacy]]` or `[i18n: footer.terms]` | Key: `footer.privacy`, `footer.terms` |
| **Data Attributes** | `<span data-i18n-missing="hero.title">Hero</span>` | Key: `hero.title`, Fallback: `Hero` |
| **Dot Notation** | `<h1>homepage.hero.title</h1>` | Key: `homepage.hero.title` |

---

## ⚙️ Configuration Options

```typescript
export interface I18nCoverageIntegrationOptions {
  /**
   * Default source locale code (e.g. 'en'). Defaults to 'en'.
   */
  defaultSourceLocale?: string;

  /**
   * Default target locale code (e.g. 'es', 'fr', 'de', 'ja'). Defaults to 'es'.
   */
  defaultTargetLocale?: string;

  /**
   * Whether to detect bare dot-notation keys in rendered text. Defaults to true.
   */
  detectDotNotation?: boolean;

  /**
   * Custom regex patterns to detect custom placeholder formats.
   */
  customPatterns?: RegExp[];

  /**
   * CSS selectors to ignore during DOM scans (e.g. `['.ignore-i18n']`).
   */
  ignoreSelectors?: string[];
}
```

---

## 🧪 Chrome Built-in AI Prerequisites

To enable Chrome's on-device AI translation and Gemini Nano models in your browser:

1. Use **Chrome 128+** (or Chrome Canary/Dev).
2. Open `chrome://flags` and configure:
   - **Translation API**: Set `#translation-api` to `Enabled`.
   - **Prompt API for Gemini Nano**: Set `#prompt-api-for-gemini-nano` to `Enabled`.
   - **Enables optimization guide on device**: Set `#optimization-guide-on-device-model` to `Enabled ByPassPerfRequirement`.
3. Restart Chrome.
4. Navigate to `chrome://components` and ensure **Optimization Guide On Device Model** is downloaded and updated.

> [!NOTE]
> When Chrome Built-in AI flags are disabled or unavailable, `astro-dev-i18n-coverage` gracefully falls back to structured heuristic key labels so your dev workflow never breaks.

---

## 🧰 Programmatic Utilities

`astro-dev-i18n-coverage` exports modular functions for headless usage and custom build pipelines:

```typescript
import {
  scanText,
  scanDom,
  translateKey,
  buildLocaleJsonTree,
  formatLocaleJson,
  deepMergeLocaleJson,
  flattenLocaleJson
} from 'astro-dev-i18n-coverage';

// 1. Scan arbitrary HTML/strings for missing keys
const matches = scanText('<p>[missing: nav.about | About Us]</p>');

// 2. Build nested JSON trees from dot keys
const jsonTree = buildLocaleJsonTree([
  { key: 'nav.links.home', value: 'Inicio' },
  { key: 'nav.links.about', value: 'Acerca de' }
]);

// Result:
// {
//   "nav": {
//     "links": {
//       "home": "Inicio",
//       "about": "Acerca de"
//     }
//   }
// }

const formatted = formatLocaleJson(jsonTree);
```

---

## 👨‍💻 Development & Testing

```bash
# Install dependencies
bun install

# Run test suite
bun test

# Run TypeScript type check
bun run typecheck

# Build bundle
bun run build
```

---

## 📄 License

MIT © [bhubbard](https://github.com/bhubbard)
