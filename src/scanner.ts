/**
 * Scanner module for detecting missing or untranslated i18n keys in DOM and text strings.
 */

export interface MissingTranslationMatch {
  id: string;
  key: string;
  rawText: string;
  context: string;
  fallbackValue?: string;
  confidence: 'high' | 'medium' | 'low';
  patternType: 'attribute' | 'missing-tag' | 'dot-notation' | 'template-tag' | 'custom';
  sourceLanguage?: string;
  element?: any;
}

export interface ScanOptions {
  sourceLocale?: string;
  targetLocale?: string;
  customPatterns?: RegExp[];
  ignoreSelectors?: string[];
  detectDotNotation?: boolean;
  minDotNotationSegments?: number;
}

/**
 * Built-in regex patterns for missing key tags in various i18n frameworks.
 */
export const I18N_PATTERNS = {
  // [missing: "key.name"] or [missing: key.name] or [missing: key | Fallback]
  missingTag: /\[(?:missing|MISSING|untranslated|i18n_missing):\s*['"]?([a-zA-Z0-9_.\-]+)['"]?(?:\s*\|\s*([^\]]+))?\]/g,
  
  // MISSING_TRANSLATION: key.name or MISSING_I18N: key.name
  missingPrefix: /(?:MISSING_TRANSLATION|MISSING_I18N|I18N_MISSING):\s*['"]?([a-zA-Z0-9_.\-]+)['"]?/g,
  
  // {{t:key.name}} or {{missing:key.name}} or {{i18n:key.name}}
  templateTag: /\{\{(?:t|missing|i18n|translate):\s*['"]?([a-zA-Z0-9_.\-]+)['"]?(?:\s*\|\s*([^}]+))?\}\}/g,
  
  // [i18n: key.name] or [[key.name]]
  bracketTag: /\[\[([a-zA-Z0-9_.\-]+)\]\]|\[i18n:\s*([a-zA-Z0-9_.\-]+)\]/g,
  
  // Pure dot notation: e.g. homepage.hero.title, auth.login.button_label
  // Must have at least 2 dots (3 segments) or common namespace prefix like common., nav., header., error.
  dotNotationStrict: /\b((?:nav|common|home|homepage|page|header|footer|auth|user|settings|errors?|messages?|buttons?|labels?|forms?|checkout|cart)\.[a-zA-Z0-9_\-]+(?:\.[a-zA-Z0-9_\-]+)+)\b/g,
  
  // Generic dot notation key pattern (at least 2 segments with lowercase/camelCase words)
  dotNotationGeneric: /\b([a-z][a-zA-Z0-9_]*(?:\.[a-z][a-zA-Z0-9_\-]+){1,6})\b/g,
};

/**
 * Common false positives to exclude from dot-notation key detection.
 */
const IGNORED_DOT_PATTERNS = new Set([
  'window.ai',
  'console.log',
  'console.error',
  'console.warn',
  'document.body',
  'document.documentElement',
  'process.env',
  'import.meta',
  'e.g',
  'i.e',
  'etc.',
  'vs.',
  'al.',
  'astro.build',
  'schema.org',
  'w3.org',
  'github.com',
  'localhost.localdomain'
]);

const FILE_EXTENSIONS = /\.(?:js|mjs|cjs|ts|tsx|jsx|json|html|css|scss|svg|png|jpg|jpeg|webp|gif|woff|woff2|ttf|wasm|astro|vue|svelte|md|mdx|map)$/i;

/**
 * Checks whether a token is likely an i18n key in dot notation rather than code, URL, or plain text.
 */
export function isDotNotationKey(token: string): boolean {
  if (!token || token.length < 3 || token.length > 120) return false;
  if (IGNORED_DOT_PATTERNS.has(token.toLowerCase())) return false;
  if (FILE_EXTENSIONS.test(token)) return false;
  if (token.includes('://') || token.startsWith('/') || token.startsWith('.')) return false;
  if (token.includes(' ') || token.includes('\n') || token.includes('\t')) return false;

  const parts = token.split('.');
  if (parts.length < 2) return false;

  // Each segment must look like an identifier
  const identifierRegex = /^[a-zA-Z0-9_\-]+$/;
  for (const part of parts) {
    if (!part || !identifierRegex.test(part)) return false;
    // Disallow purely numeric segments if it looks like an IP address or version number
    if (/^\d+$/.test(part) && parts.length <= 4 && parts.every(p => /^\d+$/.test(p))) {
      return false;
    }
  }

  return true;
}

/**
 * Scans a string of raw text or HTML for missing translation patterns.
 */
export function scanText(text: string, options: ScanOptions = {}): MissingTranslationMatch[] {
  if (!text || typeof text !== 'string') return [];

  const results: MissingTranslationMatch[] = [];
  const seenKeys = new Set<string>();

  function addMatch(
    key: string,
    rawText: string,
    confidence: MissingTranslationMatch['confidence'],
    patternType: MissingTranslationMatch['patternType'],
    fallbackValue?: string
  ) {
    const trimmedKey = key.trim();
    if (!trimmedKey || seenKeys.has(trimmedKey)) return;
    seenKeys.add(trimmedKey);

    // Extract surrounding snippet as context
    const index = text.indexOf(rawText);
    const start = Math.max(0, index - 40);
    const end = Math.min(text.length, index + rawText.length + 40);
    const context = text.slice(start, end).replace(/\s+/g, ' ').trim();

    results.push({
      id: `match-${results.length + 1}-${trimmedKey.replace(/[^a-zA-Z0-9]/g, '_')}`,
      key: trimmedKey,
      rawText,
      context,
      fallbackValue: fallbackValue?.trim(),
      confidence,
      patternType,
      sourceLanguage: options.sourceLocale || 'en'
    });
  }

  // 1. Explicit [missing: key | Fallback] tags (High confidence)
  let match: RegExpExecArray | null;
  const missingTagRegex = new RegExp(I18N_PATTERNS.missingTag.source, 'g');
  while ((match = missingTagRegex.exec(text)) !== null) {
    addMatch(match[1], match[0], 'high', 'missing-tag', match[2]);
  }

  // 2. MISSING_TRANSLATION: key
  const missingPrefixRegex = new RegExp(I18N_PATTERNS.missingPrefix.source, 'g');
  while ((match = missingPrefixRegex.exec(text)) !== null) {
    addMatch(match[1], match[0], 'high', 'missing-tag');
  }

  // 3. Template tags {{t:key}} or {{missing:key}}
  const templateTagRegex = new RegExp(I18N_PATTERNS.templateTag.source, 'g');
  while ((match = templateTagRegex.exec(text)) !== null) {
    addMatch(match[1], match[0], 'high', 'template-tag', match[2]);
  }

  // 4. Bracket tags [[key]] or [i18n: key]
  const bracketTagRegex = new RegExp(I18N_PATTERNS.bracketTag.source, 'g');
  while ((match = bracketTagRegex.exec(text)) !== null) {
    const key = match[1] || match[2];
    if (key) {
      addMatch(key, match[0], 'high', 'template-tag');
    }
  }

  // 5. Custom regex patterns if provided
  if (options.customPatterns) {
    for (const pattern of options.customPatterns) {
      const customRegex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
      while ((match = customRegex.exec(text)) !== null) {
        const key = match[1] || match[0];
        addMatch(key, match[0], 'medium', 'custom');
      }
    }
  }

  // 6. Dot notation detection if enabled
  if (options.detectDotNotation !== false) {
    const minSegments = options.minDotNotationSegments ?? 2;
    const dotRegex = new RegExp(I18N_PATTERNS.dotNotationGeneric.source, 'g');
    while ((match = dotRegex.exec(text)) !== null) {
      const candidate = match[1];
      if (isDotNotationKey(candidate)) {
        const segCount = candidate.split('.').length;
        if (segCount >= minSegments) {
          const isStrictNamespace = I18N_PATTERNS.dotNotationStrict.test(candidate);
          // reset regex state
          I18N_PATTERNS.dotNotationStrict.lastIndex = 0;
          addMatch(
            candidate,
            candidate,
            isStrictNamespace ? 'medium' : 'low',
            'dot-notation'
          );
        }
      }
    }
  }

  return results;
}

/**
 * Extracts context around an element (tag name, heading context, parent text).
 */
export function extractElementContext(el: Element, maxLength = 160): string {
  try {
    const parts: string[] = [];
    const tagName = el.tagName.toLowerCase();
    parts.push(`<${tagName}>`);

    // Look for closest heading or section
    const section = el.closest('section, article, main, header, footer, form, nav');
    if (section) {
      const heading = section.querySelector('h1, h2, h3, h4, h5, h6');
      if (heading && heading.textContent) {
        parts.push(`[Section: "${heading.textContent.trim().slice(0, 40)}"]`);
      }
    }

    // Include element's own text or sibling text
    const ownText = el.textContent?.replace(/\s+/g, ' ').trim() || '';
    if (ownText) {
      parts.push(`Text: "${ownText.slice(0, maxLength)}"`);
    }

    return parts.join(' ');
  } catch {
    return el.textContent?.slice(0, maxLength) || '';
  }
}

/**
 * Scans the live DOM tree for missing i18n keys.
 */
export function scanDom(
  root: Document | Element | null = typeof document !== 'undefined' ? document : null,
  options: ScanOptions = {}
): MissingTranslationMatch[] {
  if (!root) return [];

  const results: MissingTranslationMatch[] = [];
  const seenKeys = new Set<string>();

  const ignoreSelectors = [
    'script',
    'style',
    'noscript',
    'template',
    'astro-dev-toolbar',
    '[data-astro-dev-toolbar]',
    'astro-dev-toolbar-window',
    ...(options.ignoreSelectors || [])
  ].join(',');

  // 1. Explicit data attributes: [data-i18n-missing], [data-i18n-key], [data-i18n-untranslated]
  const explicitElements = root.querySelectorAll?.(
    '[data-i18n-missing], [data-i18n-untranslated], [data-missing-key]'
  );

  if (explicitElements) {
    explicitElements.forEach((el, idx) => {
      if (el.closest(ignoreSelectors)) return;
      const key =
        el.getAttribute('data-i18n-missing') ||
        el.getAttribute('data-i18n-untranslated') ||
        el.getAttribute('data-missing-key') ||
        el.getAttribute('data-i18n-key') ||
        el.textContent?.trim() ||
        '';

      const fallback = el.getAttribute('data-i18n-fallback') || el.getAttribute('data-i18n-default') || el.textContent?.trim();

      if (key && !seenKeys.has(key)) {
        seenKeys.add(key);
        results.push({
          id: `dom-attr-${idx}-${key.replace(/[^a-zA-Z0-9]/g, '_')}`,
          key,
          rawText: el.textContent || key,
          context: extractElementContext(el),
          fallbackValue: fallback && fallback !== key ? fallback : undefined,
          confidence: 'high',
          patternType: 'attribute',
          sourceLanguage: options.sourceLocale || 'en',
          element: el
        });
      }
    });
  }

  // 2. TreeWalker to scan all visible text nodes
  if (typeof document !== 'undefined' && 'createTreeWalker' in document && root) {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node: Node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (parent.closest(ignoreSelectors)) return NodeFilter.FILTER_REJECT;
          if (!node.nodeValue || node.nodeValue.trim() === '') return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let currentNode = walker.nextNode();
    while (currentNode) {
      const text = currentNode.nodeValue || '';
      const textMatches = scanText(text, options);

      for (const m of textMatches) {
        if (!seenKeys.has(m.key)) {
          seenKeys.add(m.key);
          const parentEl = currentNode.parentElement;
          results.push({
            ...m,
            element: parentEl || undefined,
            context: parentEl ? extractElementContext(parentEl) : m.context
          });
        }
      }
      currentNode = walker.nextNode();
    }
  }

  return results;
}
