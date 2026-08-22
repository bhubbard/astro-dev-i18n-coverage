// node_modules/astro/dist/toolbar/index.js
function defineToolbarApp(app) {
  return app;
}

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

// src/app.ts
var DEFAULT_LOCALES = [
  { code: "en", label: "English (en)" },
  { code: "es", label: "Spanish (es)" },
  { code: "fr", label: "French (fr)" },
  { code: "de", label: "German (de)" },
  { code: "ja", label: "Japanese (ja)" },
  { code: "zh", label: "Chinese (zh)" },
  { code: "it", label: "Italian (it)" },
  { code: "pt", label: "Portuguese (pt)" }
];
var app_default = defineToolbarApp({
  init(canvas, app) {
    let sourceLocale = "en";
    let targetLocale = "es";
    let missingMatches = [];
    const translations = new Map;
    let isTranslating = false;
    let highlightEnabled = false;
    let aiStatus = null;
    let highlightedElements = [];
    const container = document.createElement("div");
    container.className = "i18n-coverage-panel";
    container.innerHTML = `
      <style>
        :host, .i18n-coverage-panel {
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          color: #e2e8f0;
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          width: 480px;
          max-height: 600px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          position: fixed;
          bottom: 72px;
          right: 24px;
          z-index: 9999999;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: rgba(30, 41, 59, 0.8);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 14px;
          color: #f8fafc;
        }

        .badge-count {
          background: #f43f5e;
          color: white;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 9999px;
        }

        .badge-count.zero {
          background: #10b981;
        }

        .ai-status-pill {
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .ai-status-pill.ready {
          background: rgba(16, 185, 129, 0.2);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .ai-status-pill.fallback {
          background: rgba(245, 158, 11, 0.2);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .controls {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: rgba(15, 23, 42, 0.6);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          flex-wrap: wrap;
        }

        .locale-select {
          background: #1e293b;
          color: #f8fafc;
          border: 1px solid #334155;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 12px;
          outline: none;
        }
        .locale-select:focus {
          border-color: #6366f1;
        }

        .btn {
          background: #334155;
          color: #f8fafc;
          border: 1px solid #475569;
          border-radius: 6px;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .btn:hover {
          background: #475569;
        }
        .btn-primary {
          background: #6366f1;
          border-color: #818cf8;
        }
        .btn-primary:hover {
          background: #4f46e5;
        }
        .btn-success {
          background: #059669;
          border-color: #10b981;
        }
        .btn-success:hover {
          background: #047857;
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .content-area {
          flex: 1;
          overflow-y: auto;
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 380px;
        }

        .empty-state {
          text-align: center;
          padding: 32px 16px;
          color: #94a3b8;
        }
        .empty-icon {
          font-size: 28px;
          margin-bottom: 8px;
        }

        .card {
          background: rgba(30, 41, 59, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .key-name {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12px;
          color: #38bdf8;
          font-weight: 600;
          word-break: break-all;
        }

        .pattern-badge {
          font-size: 10px;
          background: #334155;
          color: #cbd5e1;
          padding: 1px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .diff-view {
          display: flex;
          flex-direction: column;
          gap: 4px;
          background: rgba(15, 23, 42, 0.8);
          border-radius: 6px;
          padding: 8px;
          font-size: 12px;
        }

        .diff-source {
          color: #f87171;
          display: flex;
          gap: 6px;
        }

        .diff-target {
          color: #34d399;
          display: flex;
          gap: 6px;
          font-weight: 500;
        }

        .card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 4px;
        }

        .ai-method-badge {
          font-size: 10px;
          color: #a5b4fc;
        }

        .footer {
          padding: 10px 16px;
          background: rgba(30, 41, 59, 0.8);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .toast {
          position: absolute;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          background: #10b981;
          color: white;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .toast.show {
          opacity: 1;
        }
      </style>

      <div class="toast" id="toast">Copied to clipboard!</div>

      <div class="header">
        <div class="header-title">
          <span>\uD83C\uDF10 i18n Coverage</span>
          <span class="badge-count" id="badge-count">0</span>
        </div>
        <div id="ai-status-container"></div>
      </div>

      <div class="controls">
        <label style="font-size:11px;color:#94a3b8;">Source:</label>
        <select class="locale-select" id="source-locale-select">
          ${DEFAULT_LOCALES.map((l) => `<option value="${l.code}" ${l.code === "en" ? "selected" : ""}>${l.code}</option>`).join("")}
        </select>

        <label style="font-size:11px;color:#94a3b8;margin-left:4px;">Target:</label>
        <select class="locale-select" id="target-locale-select">
          ${DEFAULT_LOCALES.map((l) => `<option value="${l.code}" ${l.code === "es" ? "selected" : ""}>${l.code}</option>`).join("")}
        </select>

        <button class="btn" id="btn-rescan" title="Rescan DOM">\uD83D\uDD04 Scan</button>
        <button class="btn btn-primary" id="btn-translate-all">✨ Translate All</button>
      </div>

      <div class="content-area" id="content-list">
        <div class="empty-state">
          <div class="empty-icon">\uD83D\uDD0D</div>
          <div>Scanning page for missing i18n keys...</div>
        </div>
      </div>

      <div class="footer">
        <button class="btn" id="btn-toggle-highlight">\uD83C\uDFAF Highlight in Page</button>
        <button class="btn btn-success" id="btn-copy-json" disabled>\uD83D\uDCCB Copy Locale JSON</button>
      </div>
    `;
    canvas.appendChild(container);
    const badgeCountEl = container.querySelector("#badge-count");
    const aiStatusEl = container.querySelector("#ai-status-container");
    const sourceSelect = container.querySelector("#source-locale-select");
    const targetSelect = container.querySelector("#target-locale-select");
    const btnRescan = container.querySelector("#btn-rescan");
    const btnTranslateAll = container.querySelector("#btn-translate-all");
    const btnCopyJson = container.querySelector("#btn-copy-json");
    const btnToggleHighlight = container.querySelector("#btn-toggle-highlight");
    const contentList = container.querySelector("#content-list");
    const toast = container.querySelector("#toast");
    function showToast(message = "Copied to clipboard!") {
      toast.textContent = message;
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 2000);
    }
    async function checkStatus() {
      aiStatus = await getTranslatorStatus(sourceLocale, targetLocale);
      const isReady = aiStatus.hasTranslator || aiStatus.hasLanguageModel;
      aiStatusEl.innerHTML = `
        <span class="ai-status-pill ${isReady ? "ready" : "fallback"}">
          ${isReady ? "⚡ Chrome AI" : "\uD83D\uDCA1 Heuristic"}
        </span>
      `;
    }
    function clearHighlights() {
      highlightedElements.forEach((el) => {
        el.style.outline = "";
        el.style.outlineOffset = "";
        el.removeAttribute("data-i18n-highlighted");
      });
      highlightedElements = [];
    }
    function applyHighlights() {
      clearHighlights();
      if (!highlightEnabled)
        return;
      missingMatches.forEach((match) => {
        if (match.element && match.element instanceof HTMLElement) {
          match.element.style.outline = "2px dashed #f43f5e";
          match.element.style.outlineOffset = "2px";
          match.element.setAttribute("data-i18n-highlighted", "true");
          highlightedElements.push(match.element);
        }
      });
    }
    function renderList() {
      const count = missingMatches.length;
      badgeCountEl.textContent = String(count);
      if (count === 0) {
        badgeCountEl.classList.add("zero");
      } else {
        badgeCountEl.classList.remove("zero");
      }
      const appWithNotification = app;
      if (typeof appWithNotification?.setNotification === "function") {
        appWithNotification.setNotification({
          state: count > 0,
          level: count > 0 ? "warning" : "info"
        });
      }
      btnCopyJson.disabled = translations.size === 0;
      if (count === 0) {
        contentList.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">✅</div>
            <div style="font-weight: 600; color: #34d399; margin-bottom: 4px;">100% i18n Coverage!</div>
            <div>No missing translation keys or placeholders detected in the current DOM.</div>
          </div>
        `;
        return;
      }
      contentList.innerHTML = missingMatches.map((item) => {
        const trans = translations.get(item.key);
        const targetText = trans ? trans.translatedText : "Pending translation...";
        const method = trans ? trans.method : "";
        return `
          <div class="card" data-key="${item.key}">
            <div class="card-header">
              <span class="key-name">${item.key}</span>
              <span class="pattern-badge">${item.patternType}</span>
            </div>
            <div class="diff-view">
              <div class="diff-source">
                <span>−</span>
                <span>${item.fallbackValue || item.rawText}</span>
              </div>
              <div class="diff-target" style="color: ${trans ? "#34d399" : "#94a3b8"}">
                <span>+</span>
                <span>${targetText}</span>
              </div>
            </div>
            <div class="card-footer">
              <span class="ai-method-badge">${method ? `Via ${method}` : ""}</span>
              <button class="btn btn-primary btn-translate-single" data-key="${item.key}" style="font-size:11px;padding:3px 8px;">
                ${trans ? "Re-translate" : "✨ Translate"}
              </button>
            </div>
          </div>
        `;
      }).join("");
      contentList.querySelectorAll(".btn-translate-single").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const target = e.currentTarget;
          const key = target.getAttribute("data-key");
          const match = missingMatches.find((m) => m.key === key);
          if (!match)
            return;
          target.disabled = true;
          target.textContent = "Translating...";
          const result = await translateKey(match, sourceLocale, targetLocale);
          translations.set(match.key, result);
          renderList();
        });
      });
      if (highlightEnabled) {
        applyHighlights();
      }
    }
    async function scan() {
      missingMatches = scanDom(document, {
        sourceLocale,
        targetLocale,
        detectDotNotation: true
      });
      renderList();
    }
    async function translateAll() {
      if (isTranslating || missingMatches.length === 0)
        return;
      isTranslating = true;
      btnTranslateAll.disabled = true;
      btnTranslateAll.textContent = "Translating...";
      for (const match of missingMatches) {
        try {
          const result = await translateKey(match, sourceLocale, targetLocale);
          translations.set(match.key, result);
          renderList();
        } catch (err) {
          console.error("[i18n-coverage] Translation error for key", match.key, err);
        }
      }
      isTranslating = false;
      btnTranslateAll.disabled = false;
      btnTranslateAll.textContent = "✨ Translate All";
      showToast(`Generated ${translations.size} translations!`);
    }
    function copyLocaleJson() {
      if (translations.size === 0)
        return;
      const flatList = Array.from(translations.values()).map((t) => ({
        key: t.key,
        value: t.translatedText
      }));
      const jsonTree = buildLocaleJsonTree(flatList);
      const formatted = formatLocaleJson(jsonTree);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(formatted).then(() => {
          showToast(`Copied ${targetLocale}.json tree!`);
        });
      }
    }
    sourceSelect.addEventListener("change", () => {
      sourceLocale = sourceSelect.value;
      checkStatus();
    });
    targetSelect.addEventListener("change", () => {
      targetLocale = targetSelect.value;
      checkStatus();
    });
    btnRescan.addEventListener("click", () => {
      scan();
    });
    btnTranslateAll.addEventListener("click", () => {
      translateAll();
    });
    btnCopyJson.addEventListener("click", () => {
      copyLocaleJson();
    });
    btnToggleHighlight.addEventListener("click", () => {
      highlightEnabled = !highlightEnabled;
      btnToggleHighlight.style.background = highlightEnabled ? "#e11d48" : "";
      btnToggleHighlight.textContent = highlightEnabled ? "\uD83D\uDEAB Clear Highlights" : "\uD83C\uDFAF Highlight in Page";
      if (highlightEnabled) {
        applyHighlights();
      } else {
        clearHighlights();
      }
    });
    if (typeof MutationObserver !== "undefined") {
      const observer = new MutationObserver(() => {
        scan();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    checkStatus();
    scan();
  }
});
export {
  app_default as default
};
