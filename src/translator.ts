/**
 * Translation service bridging Chrome Built-in AI (window.ai.translator and window.ai.languageModel)
 * with structured JSON tree formatting for Astro i18n workflows.
 */

import type { MissingTranslationMatch } from './scanner';
import type { AITranslator, AILanguageModel } from './chrome-ai';

export interface TranslationResult {
  key: string;
  sourceText: string;
  translatedText: string;
  sourceLocale: string;
  targetLocale: string;
  method: 'chrome-translator' | 'gemini-nano' | 'heuristic-fallback';
  confidence: number;
}

export interface TranslatorStatus {
  hasChromeAI: boolean;
  hasTranslator: boolean;
  hasLanguageModel: boolean;
  availability: 'readily' | 'after-download' | 'no' | 'unavailable';
  details?: string;
}

/**
 * Checks the availability of Chrome Built-in AI APIs.
 */
export async function getTranslatorStatus(
  sourceLocale = 'en',
  targetLocale = 'es'
): Promise<TranslatorStatus> {
  if (typeof window === 'undefined') {
    return {
      hasChromeAI: false,
      hasTranslator: false,
      hasLanguageModel: false,
      availability: 'unavailable',
      details: 'Not in browser environment'
    };
  }

  const ai = window.ai;
  const translation = window.translation;

  let hasTranslator = false;
  let hasLanguageModel = false;
  let availability: TranslatorStatus['availability'] = 'no';

  // 1. Check window.ai.translator or window.translation
  if (ai?.translator) {
    try {
      const caps = await ai.translator.capabilities();
      const pairAvail = caps.languagePairAvailable(sourceLocale, targetLocale);
      hasTranslator = pairAvail !== 'no';
      availability = pairAvail;
    } catch {
      hasTranslator = false;
    }
  } else if (translation?.canTranslate) {
    try {
      const can = await translation.canTranslate({
        sourceLanguage: sourceLocale,
        targetLanguage: targetLocale
      });
      hasTranslator = can !== 'no';
      availability = can;
    } catch {
      hasTranslator = false;
    }
  }

  // 2. Check window.ai.languageModel (Gemini Nano)
  if (ai?.languageModel) {
    try {
      const caps = await ai.languageModel.capabilities();
      if (caps.available !== 'no') {
        hasLanguageModel = true;
        if (availability === 'no' || (availability as string) === 'unavailable') {
          availability = caps.available;
        }
      }
    } catch {
      hasLanguageModel = false;
    }
  }

  return {
    hasChromeAI: !!(ai || translation),
    hasTranslator,
    hasLanguageModel,
    availability: (hasTranslator || hasLanguageModel) ? availability : 'no',
    details: hasTranslator
      ? 'Chrome Translator API ready'
      : hasLanguageModel
      ? 'Gemini Nano LanguageModel ready for translation'
      : 'Chrome Built-in AI flags not enabled'
  };
}

/**
 * Converts a dot-key identifier into human-readable English words as a heuristic fallback.
 * e.g. "homepage.hero.cta_button" -> "Cta Button"
 */
export function keyToHumanLabel(key: string): string {
  const parts = key.split('.');
  const lastPart = parts[parts.length - 1] || key;
  return lastPart
    .replace(/[_\-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

/**
 * Formats a contextual prompt for Gemini Nano (window.ai.languageModel).
 */
export function buildLanguageModelPrompt(
  key: string,
  sourceText: string,
  sourceLocale: string,
  targetLocale: string,
  context?: string
): string {
  return `You are an expert i18n localization assistant for a web application.
Translate the following UI string or i18n key into the target language "${targetLocale}".

Source Language: ${sourceLocale}
Target Language: ${targetLocale}
i18n Key: "${key}"
Source Text / Fallback: "${sourceText}"
${context ? `Surrounding UI Context: "${context}"` : ''}

Instructions:
1. Provide ONLY the direct, natural translation for the UI element.
2. Preserve any interpolated placeholders (such as {name}, %s, or {{count}}).
3. Do not include quotation marks, markdown formatting, explanations, or labels in your output.
4. Output the raw translated string directly.`;
}

/**
 * Translates a single missing key item using Chrome Translator, Gemini Nano, or Heuristic fallback.
 */
export async function translateKey(
  item: MissingTranslationMatch,
  sourceLocale = 'en',
  targetLocale = 'es'
): Promise<TranslationResult> {
  const sourceText = item.fallbackValue || keyToHumanLabel(item.key);
  const context = item.context || '';

  // 1. Try Chrome Translator API (window.ai.translator or window.translation)
  if (typeof window !== 'undefined') {
    const ai = window.ai;
    const translation = window.translation;

    if (ai?.translator) {
      try {
        const translator: AITranslator = await ai.translator.create({
          sourceLanguage: sourceLocale,
          targetLanguage: targetLocale
        });
        const translated = await translator.translate(sourceText);
        translator.destroy?.();
        if (translated && translated.trim()) {
          return {
            key: item.key,
            sourceText,
            translatedText: translated.trim(),
            sourceLocale,
            targetLocale,
            method: 'chrome-translator',
            confidence: 0.95
          };
        }
      } catch (err) {
        // Fall through to languageModel
      }
    } else if (translation?.createTranslator) {
      try {
        const translator = await translation.createTranslator({
          sourceLanguage: sourceLocale,
          targetLanguage: targetLocale
        });
        const translated = await translator.translate(sourceText);
        translator.destroy?.();
        if (translated && translated.trim()) {
          return {
            key: item.key,
            sourceText,
            translatedText: translated.trim(),
            sourceLocale,
            targetLocale,
            method: 'chrome-translator',
            confidence: 0.95
          };
        }
      } catch (err) {
        // Fall through to languageModel
      }
    }

    // 2. Try window.ai.languageModel (Gemini Nano)
    if (ai?.languageModel) {
      try {
        const session: AILanguageModel = await ai.languageModel.create({
          temperature: 0.2,
          topK: 3
        });
        const prompt = buildLanguageModelPrompt(item.key, sourceText, sourceLocale, targetLocale, context);
        const rawOutput = await session.prompt(prompt);
        session.destroy?.();

        const cleaned = rawOutput
          .replace(/^["']|["']$/g, '')
          .replace(/^Translation:\s*/i, '')
          .trim();

        if (cleaned) {
          return {
            key: item.key,
            sourceText,
            translatedText: cleaned,
            sourceLocale,
            targetLocale,
            method: 'gemini-nano',
            confidence: 0.9
          };
        }
      } catch (err) {
        // Fall through to heuristic
      }
    }
  }

  // 3. Fallback heuristic
  return {
    key: item.key,
    sourceText,
    translatedText: sourceText,
    sourceLocale,
    targetLocale,
    method: 'heuristic-fallback',
    confidence: 0.5
  };
}

/**
 * Builds a nested JSON locale object from flat dot-notation keys.
 * e.g. { "nav.links.home": "Inicio", "nav.links.about": "Acerca de" }
 * -> { nav: { links: { home: "Inicio", about: "Acerca de" } } }
 */
export function buildLocaleJsonTree(
  translations: Array<{ key: string; value: string }> | Record<string, string>
): Record<string, any> {
  const result: Record<string, any> = {};

  const entries: Array<[string, string]> = Array.isArray(translations)
    ? translations.map(t => [t.key, t.value])
    : Object.entries(translations);

  for (const [key, value] of entries) {
    if (!key) continue;
    const parts = key.split('.');
    let current = result;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        current[part] = value;
      } else {
        if (
          typeof current[part] !== 'object' ||
          current[part] === null ||
          Array.isArray(current[part])
        ) {
          current[part] = {};
        }
        current = current[part];
      }
    }
  }

  return result;
}

/**
 * Formats a locale tree object into clean, indented JSON.
 */
export function formatLocaleJson(tree: Record<string, any>, indent = 2): string {
  return JSON.stringify(tree, null, indent);
}

/**
 * Deeply merges two locale JSON objects without overwriting existing nested objects.
 */
export function deepMergeLocaleJson(
  target: Record<string, any>,
  source: Record<string, any>
): Record<string, any> {
  const output: Record<string, any> = { ...target };

  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = output[key];

    if (
      srcVal &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      tgtVal &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal)
    ) {
      output[key] = deepMergeLocaleJson(tgtVal, srcVal);
    } else {
      output[key] = srcVal;
    }
  }

  return output;
}

/**
 * Flattens a nested locale JSON object into dot-notation keys.
 */
export function flattenLocaleJson(
  obj: Record<string, any>,
  prefix = ''
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];

    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenLocaleJson(val, fullKey));
    } else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      result[fullKey] = String(val);
    }
  }

  return result;
}
