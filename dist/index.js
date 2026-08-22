// src/scanner.ts
var I18N_PATTERNS = {
  missingTag: /\[(?:missing|MISSING|untranslated|i18n_missing):\s*['"]?([a-zA-Z0-9_.\-]+)['"]?(?:\s*\|\s*([^\]]+))?\]/g,
  missingPrefix: /(?:MISSING_TRANSLATION|MISSING_I18N|I18N_MISSING):\s*['"]?([a-zA-Z0-9_.\-]+)['"]?/g,
  templateTag: /\{\{(?:t|missing|i18n|translate):\s*['"]?([a-zA-Z0-9_.\-]+)['"]?(?:\s*\|\s*([^}]+))?\}\}/g,
  bracketTag: /\[\[([a-zA-Z0-9_.\-]+)\]\]|\[i18n:\s*([a-zA-Z0-9_.\-]+)\]/g,
  dotNotationStrict: /\b((?:nav|common|home|homepage|page|header|footer|auth|user|settings|errors?|messages?|buttons?|labels?|forms?|checkout|cart)\.[a-zA-Z0-9_\-]+(?:\.[a-zA-Z0-9_\-]+)+)\b/g,
  dotNotationGeneric: /\b([a-z][a-zA-Z0-9_]*(?:\.[a-z][a-zA-Z0-9_\-]+){1,6})\b/g
};
var IGNORED_DOT_PATTERNS = new Set([
  "window.ai",
  "console.log",
  "console.error",
  "console.warn",
  "document.body",
  "document.documentElement",
  "process.env",
  "import.meta",
  "e.g",
  "i.e",
  "etc.",
  "vs.",
  "al.",
  "astro.build",
  "schema.org",
  "w3.org",
  "github.com",
  "localhost.localdomain"
]);
var FILE_EXTENSIONS = /\.(?:js|mjs|cjs|ts|tsx|jsx|json|html|css|scss|svg|png|jpg|jpeg|webp|gif|woff|woff2|ttf|wasm|astro|vue|svelte|md|mdx|map)$/i;
function isDotNotationKey(token) {
  if (!token || token.length < 3 || token.length > 120)
    return false;
  if (IGNORED_DOT_PATTERNS.has(token.toLowerCase()))
    return false;
  if (FILE_EXTENSIONS.test(token))
    return false;
  if (token.includes("://") || token.startsWith("/") || token.startsWith("."))
    return false;
  if (token.includes(" ") || token.includes(`
`) || token.includes("\t"))
    return false;
  const parts = token.split(".");
  if (parts.length < 2)
    return false;
  const identifierRegex = /^[a-zA-Z0-9_\-]+$/;
  for (const part of parts) {
    if (!part || !identifierRegex.test(part))
      return false;
    if (/^\d+$/.test(part) && parts.length <= 4 && parts.every((p) => /^\d+$/.test(p))) {
      return false;
    }
  }
  return true;
}
function scanText(text, options = {}) {
  if (!text || typeof text !== "string")
    return [];
  const results = [];
  const seenKeys = new Set;
  function addMatch(key, rawText, confidence, patternType, fallbackValue) {
    const trimmedKey = key.trim();
    if (!trimmedKey || seenKeys.has(trimmedKey))
      return;
    seenKeys.add(trimmedKey);
    const index = text.indexOf(rawText);
    const start = Math.max(0, index - 40);
    const end = Math.min(text.length, index + rawText.length + 40);
    const context = text.slice(start, end).replace(/\s+/g, " ").trim();
    results.push({
      id: `match-${results.length + 1}-${trimmedKey.replace(/[^a-zA-Z0-9]/g, "_")}`,
      key: trimmedKey,
      rawText,
      context,
      fallbackValue: fallbackValue?.trim(),
      confidence,
      patternType,
      sourceLanguage: options.sourceLocale || "en"
    });
  }
  let match;
  const missingTagRegex = new RegExp(I18N_PATTERNS.missingTag.source, "g");
  while ((match = missingTagRegex.exec(text)) !== null) {
    addMatch(match[1], match[0], "high", "missing-tag", match[2]);
  }
  const missingPrefixRegex = new RegExp(I18N_PATTERNS.missingPrefix.source, "g");
  while ((match = missingPrefixRegex.exec(text)) !== null) {
    addMatch(match[1], match[0], "high", "missing-tag");
  }
  const templateTagRegex = new RegExp(I18N_PATTERNS.templateTag.source, "g");
  while ((match = templateTagRegex.exec(text)) !== null) {
    addMatch(match[1], match[0], "high", "template-tag", match[2]);
  }
  const bracketTagRegex = new RegExp(I18N_PATTERNS.bracketTag.source, "g");
  while ((match = bracketTagRegex.exec(text)) !== null) {
    const key = match[1] || match[2];
    if (key) {
      addMatch(key, match[0], "high", "template-tag");
    }
  }
  if (options.customPatterns) {
    for (const pattern of options.customPatterns) {
      const customRegex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
      while ((match = customRegex.exec(text)) !== null) {
        const key = match[1] || match[0];
        addMatch(key, match[0], "medium", "custom");
      }
    }
  }
  if (options.detectDotNotation !== false) {
    const minSegments = options.minDotNotationSegments ?? 2;
    const dotRegex = new RegExp(I18N_PATTERNS.dotNotationGeneric.source, "g");
    while ((match = dotRegex.exec(text)) !== null) {
      const candidate = match[1];
      if (isDotNotationKey(candidate)) {
        const segCount = candidate.split(".").length;
        if (segCount >= minSegments) {
          const isStrictNamespace = I18N_PATTERNS.dotNotationStrict.test(candidate);
          I18N_PATTERNS.dotNotationStrict.lastIndex = 0;
          addMatch(candidate, candidate, isStrictNamespace ? "medium" : "low", "dot-notation");
        }
      }
    }
  }
  return results;
}
function extractElementContext(el, maxLength = 160) {
  try {
    const parts = [];
    const tagName = el.tagName.toLowerCase();
    parts.push(`<${tagName}>`);
    const section = el.closest("section, article, main, header, footer, form, nav");
    if (section) {
      const heading = section.querySelector("h1, h2, h3, h4, h5, h6");
      if (heading && heading.textContent) {
        parts.push(`[Section: "${heading.textContent.trim().slice(0, 40)}"]`);
      }
    }
    const ownText = el.textContent?.replace(/\s+/g, " ").trim() || "";
    if (ownText) {
      parts.push(`Text: "${ownText.slice(0, maxLength)}"`);
    }
    return parts.join(" ");
  } catch {
    return el.textContent?.slice(0, maxLength) || "";
  }
}
function scanDom(root = typeof document !== "undefined" ? document : null, options = {}) {
  if (!root)
    return [];
  const results = [];
  const seenKeys = new Set;
  const ignoreSelectors = [
    "script",
    "style",
    "noscript",
    "template",
    "astro-dev-toolbar",
    "[data-astro-dev-toolbar]",
    "astro-dev-toolbar-window",
    ...options.ignoreSelectors || []
  ].join(",");
  const explicitElements = root.querySelectorAll?.("[data-i18n-missing], [data-i18n-untranslated], [data-missing-key]");
  if (explicitElements) {
    explicitElements.forEach((el, idx) => {
      if (el.closest(ignoreSelectors))
        return;
      const key = el.getAttribute("data-i18n-missing") || el.getAttribute("data-i18n-untranslated") || el.getAttribute("data-missing-key") || el.getAttribute("data-i18n-key") || el.textContent?.trim() || "";
      const fallback = el.getAttribute("data-i18n-fallback") || el.getAttribute("data-i18n-default") || el.textContent?.trim();
      if (key && !seenKeys.has(key)) {
        seenKeys.add(key);
        results.push({
          id: `dom-attr-${idx}-${key.replace(/[^a-zA-Z0-9]/g, "_")}`,
          key,
          rawText: el.textContent || key,
          context: extractElementContext(el),
          fallbackValue: fallback && fallback !== key ? fallback : undefined,
          confidence: "high",
          patternType: "attribute",
          sourceLanguage: options.sourceLocale || "en",
          element: el
        });
      }
    });
  }
  if (typeof document !== "undefined" && "createTreeWalker" in document && root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent)
          return NodeFilter.FILTER_REJECT;
        if (parent.closest(ignoreSelectors))
          return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || node.nodeValue.trim() === "")
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let currentNode = walker.nextNode();
    while (currentNode) {
      const text = currentNode.nodeValue || "";
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
// src/translator.ts
async function getTranslatorStatus(sourceLocale = "en", targetLocale = "es") {
  if (typeof window === "undefined") {
    return {
      hasChromeAI: false,
      hasTranslator: false,
      hasLanguageModel: false,
      availability: "unavailable",
      details: "Not in browser environment"
    };
  }
  const ai = window.ai;
  const translation = window.translation;
  let hasTranslator = false;
  let hasLanguageModel = false;
  let availability = "no";
  if (ai?.translator) {
    try {
      const caps = await ai.translator.capabilities();
      const pairAvail = caps.languagePairAvailable(sourceLocale, targetLocale);
      hasTranslator = pairAvail !== "no";
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
      hasTranslator = can !== "no";
      availability = can;
    } catch {
      hasTranslator = false;
    }
  }
  if (ai?.languageModel) {
    try {
      const caps = await ai.languageModel.capabilities();
      if (caps.available !== "no") {
        hasLanguageModel = true;
        if (availability === "no" || availability === "unavailable") {
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
    availability: hasTranslator || hasLanguageModel ? availability : "no",
    details: hasTranslator ? "Chrome Translator API ready" : hasLanguageModel ? "Gemini Nano LanguageModel ready for translation" : "Chrome Built-in AI flags not enabled"
  };
}
function keyToHumanLabel(key) {
  const parts = key.split(".");
  const lastPart = parts[parts.length - 1] || key;
  return lastPart.replace(/[_\-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}
function buildLanguageModelPrompt(key, sourceText, sourceLocale, targetLocale, context) {
  return `You are an expert i18n localization assistant for a web application.
Translate the following UI string or i18n key into the target language "${targetLocale}".

Source Language: ${sourceLocale}
Target Language: ${targetLocale}
i18n Key: "${key}"
Source Text / Fallback: "${sourceText}"
${context ? `Surrounding UI Context: "${context}"` : ""}

Instructions:
1. Provide ONLY the direct, natural translation for the UI element.
2. Preserve any interpolated placeholders (such as {name}, %s, or {{count}}).
3. Do not include quotation marks, markdown formatting, explanations, or labels in your output.
4. Output the raw translated string directly.`;
}
async function translateKey(item, sourceLocale = "en", targetLocale = "es") {
  const sourceText = item.fallbackValue || keyToHumanLabel(item.key);
  const context = item.context || "";
  if (typeof window !== "undefined") {
    const ai = window.ai;
    const translation = window.translation;
    if (ai?.translator) {
      try {
        const translator = await ai.translator.create({
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
            method: "chrome-translator",
            confidence: 0.95
          };
        }
      } catch (err) {}
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
            method: "chrome-translator",
            confidence: 0.95
          };
        }
      } catch (err) {}
    }
    if (ai?.languageModel) {
      try {
        const session = await ai.languageModel.create({
          temperature: 0.2,
          topK: 3
        });
        const prompt = buildLanguageModelPrompt(item.key, sourceText, sourceLocale, targetLocale, context);
        const rawOutput = await session.prompt(prompt);
        session.destroy?.();
        const cleaned = rawOutput.replace(/^["']|["']$/g, "").replace(/^Translation:\s*/i, "").trim();
        if (cleaned) {
          return {
            key: item.key,
            sourceText,
            translatedText: cleaned,
            sourceLocale,
            targetLocale,
            method: "gemini-nano",
            confidence: 0.9
          };
        }
      } catch (err) {}
    }
  }
  return {
    key: item.key,
    sourceText,
    translatedText: sourceText,
    sourceLocale,
    targetLocale,
    method: "heuristic-fallback",
    confidence: 0.5
  };
}
function buildLocaleJsonTree(translations) {
  const result = {};
  const entries = Array.isArray(translations) ? translations.map((t) => [t.key, t.value]) : Object.entries(translations);
  for (const [key, value] of entries) {
    if (!key)
      continue;
    const parts = key.split(".");
    let current = result;
    for (let i = 0;i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      if (isLast) {
        current[part] = value;
      } else {
        if (typeof current[part] !== "object" || current[part] === null || Array.isArray(current[part])) {
          current[part] = {};
        }
        current = current[part];
      }
    }
  }
  return result;
}
function formatLocaleJson(tree, indent = 2) {
  return JSON.stringify(tree, null, indent);
}
function deepMergeLocaleJson(target, source) {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = output[key];
    if (srcVal && typeof srcVal === "object" && !Array.isArray(srcVal) && tgtVal && typeof tgtVal === "object" && !Array.isArray(tgtVal)) {
      output[key] = deepMergeLocaleJson(tgtVal, srcVal);
    } else {
      output[key] = srcVal;
    }
  }
  return output;
}
function flattenLocaleJson(obj, prefix = "") {
  const result = {};
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val && typeof val === "object" && !Array.isArray(val)) {
      Object.assign(result, flattenLocaleJson(val, fullKey));
    } else if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      result[fullKey] = String(val);
    }
  }
  return result;
}

// src/index.ts
var I18N_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
function astroDevI18nCoverage(options = {}) {
  return {
    name: "astro-dev-i18n-coverage",
    hooks: {
      "astro:config:setup": ({ addDevToolbarApp }) => {
        const appEntry = new URL("./app.js", import.meta.url).pathname;
        addDevToolbarApp({
          id: "astro-dev-i18n-coverage",
          name: "i18n Coverage",
          icon: I18N_ICON,
          entrypoint: appEntry
        });
      }
    }
  };
}
var src_default = astroDevI18nCoverage;
export {
  translateKey,
  scanText,
  scanDom,
  keyToHumanLabel,
  isDotNotationKey,
  getTranslatorStatus,
  formatLocaleJson,
  flattenLocaleJson,
  extractElementContext,
  src_default as default,
  deepMergeLocaleJson,
  buildLocaleJsonTree,
  buildLanguageModelPrompt,
  astroDevI18nCoverage,
  I18N_PATTERNS
};
