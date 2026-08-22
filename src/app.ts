/**
 * Astro Dev Toolbar App for i18n Coverage & Chrome AI Translation Generation.
 */

import { defineToolbarApp } from 'astro/toolbar';
import { scanDom, type MissingTranslationMatch } from './scanner';
import {
  translateKey,
  getTranslatorStatus,
  buildLocaleJsonTree,
  formatLocaleJson,
  type TranslationResult,
  type TranslatorStatus
} from './translator';

const DEFAULT_LOCALES = [
  { code: 'en', label: 'English (en)' },
  { code: 'es', label: 'Spanish (es)' },
  { code: 'fr', label: 'French (fr)' },
  { code: 'de', label: 'German (de)' },
  { code: 'ja', label: 'Japanese (ja)' },
  { code: 'zh', label: 'Chinese (zh)' },
  { code: 'it', label: 'Italian (it)' },
  { code: 'pt', label: 'Portuguese (pt)' }
];

export default defineToolbarApp({
  init(canvas, app) {
    let sourceLocale = 'en';
    let targetLocale = 'es';
    let missingMatches: MissingTranslationMatch[] = [];
    const translations: Map<string, TranslationResult> = new Map();
    let isTranslating = false;
    let highlightEnabled = false;
    let aiStatus: TranslatorStatus | null = null;
    let highlightedElements: HTMLElement[] = [];

    // Main UI container setup
    const container = document.createElement('div');
    container.className = 'i18n-coverage-panel';
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
          <span>🌐 i18n Coverage</span>
          <span class="badge-count" id="badge-count">0</span>
        </div>
        <div id="ai-status-container"></div>
      </div>

      <div class="controls">
        <label style="font-size:11px;color:#94a3b8;">Source:</label>
        <select class="locale-select" id="source-locale-select">
          ${DEFAULT_LOCALES.map(l => `<option value="${l.code}" ${l.code === 'en' ? 'selected' : ''}>${l.code}</option>`).join('')}
        </select>

        <label style="font-size:11px;color:#94a3b8;margin-left:4px;">Target:</label>
        <select class="locale-select" id="target-locale-select">
          ${DEFAULT_LOCALES.map(l => `<option value="${l.code}" ${l.code === 'es' ? 'selected' : ''}>${l.code}</option>`).join('')}
        </select>

        <button class="btn" id="btn-rescan" title="Rescan DOM">🔄 Scan</button>
        <button class="btn btn-primary" id="btn-translate-all">✨ Translate All</button>
      </div>

      <div class="content-area" id="content-list">
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <div>Scanning page for missing i18n keys...</div>
        </div>
      </div>

      <div class="footer">
        <button class="btn" id="btn-toggle-highlight">🎯 Highlight in Page</button>
        <button class="btn btn-success" id="btn-copy-json" disabled>📋 Copy Locale JSON</button>
      </div>
    `;

    canvas.appendChild(container);

    // DOM Elements
    const badgeCountEl = container.querySelector('#badge-count') as HTMLElement;
    const aiStatusEl = container.querySelector('#ai-status-container') as HTMLElement;
    const sourceSelect = container.querySelector('#source-locale-select') as HTMLSelectElement;
    const targetSelect = container.querySelector('#target-locale-select') as HTMLSelectElement;
    const btnRescan = container.querySelector('#btn-rescan') as HTMLButtonElement;
    const btnTranslateAll = container.querySelector('#btn-translate-all') as HTMLButtonElement;
    const btnCopyJson = container.querySelector('#btn-copy-json') as HTMLButtonElement;
    const btnToggleHighlight = container.querySelector('#btn-toggle-highlight') as HTMLButtonElement;
    const contentList = container.querySelector('#content-list') as HTMLElement;
    const toast = container.querySelector('#toast') as HTMLElement;

    function showToast(message = 'Copied to clipboard!') {
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    }

    async function checkStatus() {
      aiStatus = await getTranslatorStatus(sourceLocale, targetLocale);
      const isReady = aiStatus.hasTranslator || aiStatus.hasLanguageModel;
      aiStatusEl.innerHTML = `
        <span class="ai-status-pill ${isReady ? 'ready' : 'fallback'}">
          ${isReady ? '⚡ Chrome AI' : '💡 Heuristic'}
        </span>
      `;
    }

    function clearHighlights() {
      highlightedElements.forEach(el => {
        el.style.outline = '';
        el.style.outlineOffset = '';
        el.removeAttribute('data-i18n-highlighted');
      });
      highlightedElements = [];
    }

    function applyHighlights() {
      clearHighlights();
      if (!highlightEnabled) return;

      missingMatches.forEach(match => {
        if (match.element && match.element instanceof HTMLElement) {
          match.element.style.outline = '2px dashed #f43f5e';
          match.element.style.outlineOffset = '2px';
          match.element.setAttribute('data-i18n-highlighted', 'true');
          highlightedElements.push(match.element);
        }
      });
    }

    function renderList() {
      const count = missingMatches.length;
      badgeCountEl.textContent = String(count);
      if (count === 0) {
        badgeCountEl.classList.add('zero');
      } else {
        badgeCountEl.classList.remove('zero');
      }

      // Update toolbar app notification badge if available
      const appWithNotification = app as unknown as { setNotification?: (opts: { state: boolean; level: string }) => void };
      if (typeof appWithNotification?.setNotification === 'function') {
        appWithNotification.setNotification({
          state: count > 0,
          level: count > 0 ? 'warning' : 'info'
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

      contentList.innerHTML = missingMatches.map(item => {
        const trans = translations.get(item.key);
        const targetText = trans ? trans.translatedText : 'Pending translation...';
        const method = trans ? trans.method : '';

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
              <div class="diff-target" style="color: ${trans ? '#34d399' : '#94a3b8'}">
                <span>+</span>
                <span>${targetText}</span>
              </div>
            </div>
            <div class="card-footer">
              <span class="ai-method-badge">${method ? `Via ${method}` : ''}</span>
              <button class="btn btn-primary btn-translate-single" data-key="${item.key}" style="font-size:11px;padding:3px 8px;">
                ${trans ? 'Re-translate' : '✨ Translate'}
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Bind single item translate buttons
      contentList.querySelectorAll('.btn-translate-single').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const target = e.currentTarget as HTMLButtonElement;
          const key = target.getAttribute('data-key');
          const match = missingMatches.find(m => m.key === key);
          if (!match) return;

          target.disabled = true;
          target.textContent = 'Translating...';
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
      if (isTranslating || missingMatches.length === 0) return;
      isTranslating = true;
      btnTranslateAll.disabled = true;
      btnTranslateAll.textContent = 'Translating...';

      for (const match of missingMatches) {
        try {
          const result = await translateKey(match, sourceLocale, targetLocale);
          translations.set(match.key, result);
          renderList();
        } catch (err) {
          console.error('[i18n-coverage] Translation error for key', match.key, err);
        }
      }

      isTranslating = false;
      btnTranslateAll.disabled = false;
      btnTranslateAll.textContent = '✨ Translate All';
      showToast(`Generated ${translations.size} translations!`);
    }

    function copyLocaleJson() {
      if (translations.size === 0) return;
      const flatList = Array.from(translations.values()).map(t => ({
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

    // Event Listeners
    sourceSelect.addEventListener('change', () => {
      sourceLocale = sourceSelect.value;
      checkStatus();
    });

    targetSelect.addEventListener('change', () => {
      targetLocale = targetSelect.value;
      checkStatus();
    });

    btnRescan.addEventListener('click', () => {
      scan();
    });

    btnTranslateAll.addEventListener('click', () => {
      translateAll();
    });

    btnCopyJson.addEventListener('click', () => {
      copyLocaleJson();
    });

    btnToggleHighlight.addEventListener('click', () => {
      highlightEnabled = !highlightEnabled;
      btnToggleHighlight.style.background = highlightEnabled ? '#e11d48' : '';
      btnToggleHighlight.textContent = highlightEnabled ? '🚫 Clear Highlights' : '🎯 Highlight in Page';
      if (highlightEnabled) {
        applyHighlights();
      } else {
        clearHighlights();
      }
    });

    // Observe DOM mutations to auto-detect dynamically loaded missing keys
    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => {
        // Debounce scan
        scan();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    // Initialize
    checkStatus();
    scan();
  }
});
