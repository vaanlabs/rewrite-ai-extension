// content.js — Content script injected into every page.
// Handles selection capture, popup management, and message flow with the background worker.
// NOTE: Content scripts cannot use ES module imports, so all utils are inlined here.

(() => {
  'use strict';

  // ── Constants ─────────────────────────────────────────────────
  const POPUP_ID = 'rcr-ai-popup';

  // ── Proactive Selection Tracking ──────────────────────────────
  // Web editors (CodeMirror, Monaco, Google Docs, etc.) may clear
  // or modify the DOM selection before the context-menu message
  // arrives.  Track the last good selection continuously.

  let lastKnownSelection = null;

  function trackSelection() {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : '';
    if (!text) return;

    const rect = (sel.rangeCount > 0)
      ? sel.getRangeAt(0).getBoundingClientRect()
      : null;

    const activeEl = document.activeElement;
    let saved = null;

    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      const s = activeEl.selectionStart;
      const e = activeEl.selectionEnd;
      if (s !== null && e !== null && s !== e) {
        saved = { text: activeEl.value.substring(s, e), type: 'input', element: activeEl, start: s, end: e };
      }
    }
    if (!saved && sel && sel.rangeCount > 0) {
      saved = { text, type: 'range', range: sel.getRangeAt(0).cloneRange(), activeElement: document.activeElement };
    }

    lastKnownSelection = { text, rect, saved };
  }

  document.addEventListener('selectionchange', trackSelection);
  // Capture right-click (button 2) in capture phase before editors can clear selection
  document.addEventListener('mousedown', (e) => {
    if (e.button === 2) trackSelection();
  }, true);

  // ── Selection Utilities ───────────────────────────────────────

  function getSelectedText() {
    const selection = window.getSelection();
    return selection ? selection.toString().trim() : '';
  }

  function getSelectionRect() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    return selection.getRangeAt(0).getBoundingClientRect();
  }

  function replaceSelectedText(newText, saved) {
    // Use saved selection data for reliable replacement after popup interaction
    if (saved) {
      // Handle saved input/textarea selection
      if (saved.type === 'input' && saved.element) {
        const el = saved.element;
        el.focus();
        el.selectionStart = saved.start;
        el.selectionEnd = saved.end;
        if (!document.execCommand('insertText', false, newText)) {
          const before = el.value.substring(0, saved.start);
          const after = el.value.substring(saved.end);
          el.value = before + newText + after;
          el.selectionStart = saved.start;
          el.selectionEnd = saved.start + newText.length;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }

      // Handle saved range selection
      if (saved.type === 'range' && saved.range) {
        try {
          const container = saved.range.commonAncestorContainer;
          const node = container.nodeType === 1 ? container : container.parentElement;
          const editableParent = node ? node.closest('[contenteditable="true"]') : null;
          const isEditable = !!editableParent || (document.designMode === 'on');

          // Focus the original active element or editable parent to re-enter the editor
          if (saved.activeElement && saved.activeElement !== document.body) {
            saved.activeElement.focus();
          } else if (editableParent) {
            editableParent.focus();
          }

          // Restore selection range
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(saved.range);

          if (isEditable) {
            if (document.execCommand('insertText', false, newText)) return;
            // Fallback: direct DOM manipulation for contenteditable
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(newText));
            sel.collapseToEnd();
            return;
          }
        } catch (_) {
          // Range may have become invalid; fall through to clipboard
        }

        // Non-editable HTML content: copy to clipboard
        copyToClipboard(newText);
        return;
      }
    }

    // No saved selection — try current state
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      const start = activeEl.selectionStart;
      const end = activeEl.selectionEnd;
      if (start !== null && end !== null && start !== end) {
        activeEl.focus();
        if (!document.execCommand('insertText', false, newText)) {
          const before = activeEl.value.substring(0, start);
          const after = activeEl.value.substring(end);
          activeEl.value = before + newText + after;
          activeEl.selectionStart = start;
          activeEl.selectionEnd = start + newText.length;
          activeEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }
    }

    if (document.execCommand('insertText', false, newText)) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      copyToClipboard(newText);
      return;
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(newText));
    selection.collapseToEnd();
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard \u2014 paste to replace');
    }).catch(() => {
      showToast('Could not copy automatically. Please copy the suggestion manually.');
    });
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: #1f2937; color: #fff; padding: 10px 20px; border-radius: 8px;
      font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 2147483647; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      opacity: 0; transition: opacity 200ms ease;
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; });
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, 3000);
  }

  // ── DOM Utilities ─────────────────────────────────────────────

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function removePopup() {
    const existing = document.getElementById(POPUP_ID);
    if (existing) {
      existing.style.opacity = '0';
      existing.style.transform = 'scale(0.96)';
      setTimeout(() => existing.remove(), 150);
    }
    savedSelection = null;
  }

  function createPopup(rect) {
    removeExistingPopupImmediately();

    const popup = document.createElement('div');
    popup.id = POPUP_ID;

    const top = rect.bottom + window.scrollY + 8;
    let left = rect.left + window.scrollX;

    // Keep popup within viewport
    if (left + 390 > window.innerWidth + window.scrollX) {
      left = window.innerWidth + window.scrollX - 400;
    }
    left = Math.max(8, left);

    popup.style.cssText = `
      position: absolute;
      top: ${top}px;
      left: ${left}px;
      z-index: 2147483647;
      width: 380px;
      max-height: 440px;
      overflow-y: auto;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,.14), 0 1.5px 6px rgba(0,0,0,.08);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      padding: 16px;
      opacity: 0;
      transform: scale(0.96);
      transition: opacity 150ms ease, transform 150ms ease;
      box-sizing: border-box;
    `;

    document.body.appendChild(popup);

    // Trigger entrance animation
    requestAnimationFrame(() => {
      popup.style.opacity = '1';
      popup.style.transform = 'scale(1)';
    });

    return popup;
  }

  function removeExistingPopupImmediately() {
    const existing = document.getElementById(POPUP_ID);
    if (existing) existing.remove();
  }

  function renderLoading(popup) {
    popup.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px 0;">
        <div style="
          width:28px;height:28px;
          border:3px solid #e5e7eb;
          border-top-color:#6366f1;
          border-radius:50%;
          animation: rcr-spin .7s linear infinite;
        "></div>
        <span style="color:#6b7280;font-size:14px;">Generating suggestions…</span>
      </div>
      <style>
        @keyframes rcr-spin { to { transform: rotate(360deg); } }
      </style>
    `;
  }

  function renderError(popup, message) {
    popup.innerHTML = `
      <div style="padding:4px 0;">
        <div style="font-weight:600;font-size:15px;color:#111827;margin-bottom:12px;">Rewrite Suggestions</div>
        <div style="color:#ef4444;font-size:13px;line-height:1.5;padding:12px;background:#fef2f2;border-radius:8px;">
          ${escapeHtml(message)}
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button data-action="settings" style="
            flex:1;padding:8px 0;border:1px solid #e5e7eb;
            border-radius:8px;background:#fff;color:#6366f1;font-size:13px;cursor:pointer;
            transition:background 120ms;
          ">Open Settings</button>
          <button data-action="cancel" style="
            flex:1;padding:8px 0;border:1px solid #e5e7eb;
            border-radius:8px;background:#fff;color:#6b7280;font-size:13px;cursor:pointer;
            transition:background 120ms;
          ">Cancel</button>
        </div>
      </div>
    `;

    popup.querySelector('[data-action="cancel"]').addEventListener('click', removePopup);
    popup.querySelector('[data-action="settings"]').addEventListener('click', () => {
      browser.runtime.sendMessage({ type: 'OPEN_SETTINGS' });
      removePopup();
    });
  }

  function renderSuggestions(popup, suggestions, onSelect) {
    const copyIconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    const checkIconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

    const cardsHtml = suggestions.map((text, i) => `
      <div class="rcr-card" data-index="${i}" style="
        padding: 10px 14px;
        margin-bottom: 8px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        font-size: 13.5px;
        line-height: 1.55;
        color: #1f2937;
        cursor: pointer;
        transition: background 120ms ease, box-shadow 120ms ease, transform 120ms ease;
        background: #fff;
        display: flex;
        align-items: flex-start;
        gap: 8px;
      ">
        <span style="flex:1;">${escapeHtml(text)}</span>
        <button class="rcr-copy-btn" data-index="${i}" title="Copy to clipboard" style="
          flex-shrink:0;background:none;border:1px solid #e5e7eb;border-radius:6px;
          padding:4px;cursor:pointer;color:#6b7280;display:flex;align-items:center;
          justify-content:center;transition:color 120ms,background 120ms;
        ">${copyIconSvg}</button>
      </div>
    `).join('');

    popup.innerHTML = `
      <div style="font-weight:600;font-size:15px;color:#111827;margin-bottom:12px;">Rewrite Suggestions</div>
      ${cardsHtml}
      <button id="rcr-cancel-btn" style="
        margin-top:4px;width:100%;padding:8px 0;border:1px solid #e5e7eb;
        border-radius:8px;background:#fff;color:#6b7280;font-size:13px;cursor:pointer;
        transition:background 120ms;
      ">Cancel</button>
      <style>
        #${POPUP_ID} .rcr-card:hover {
          background: #f5f3ff !important;
          box-shadow: 0 2px 8px rgba(99,102,241,.12) !important;
          transform: translateY(-1px);
        }
        #${POPUP_ID} .rcr-copy-btn:hover {
          background: #f3f4f6 !important;
          color: #4f46e5 !important;
        }
        #${POPUP_ID} #rcr-cancel-btn:hover {
          background: #f9fafb !important;
        }
      </style>
    `;

    popup.querySelectorAll('.rcr-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.rcr-copy-btn')) return;
        const idx = parseInt(card.dataset.index, 10);
        onSelect(suggestions[idx]);
      });
    });

    popup.querySelectorAll('.rcr-copy-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        navigator.clipboard.writeText(suggestions[idx]).then(() => {
          btn.innerHTML = checkIconSvg;
          setTimeout(() => { btn.innerHTML = copyIconSvg; }, 1500);
        }).catch(() => {
          showToast('Could not copy to clipboard');
        });
      });
    });

    popup.querySelector('#rcr-cancel-btn').addEventListener('click', removePopup);
  }

  // ── Core Rewrite Flow ─────────────────────────────────────────

  /**
   * Stores the selected text and range so we can restore it after getting suggestions.
   */
  let savedSelection = null;

  function saveCurrentSelection() {
    const activeEl = document.activeElement;

    // Save input / textarea selection
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      const start = activeEl.selectionStart;
      const end = activeEl.selectionEnd;
      if (start !== null && end !== null && start !== end) {
        return {
          text: activeEl.value.substring(start, end),
          type: 'input',
          element: activeEl,
          start,
          end
        };
      }
    }

    // Save regular DOM / contenteditable selection
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    return {
      text: sel.toString().trim(),
      type: 'range',
      range: sel.getRangeAt(0).cloneRange(),
      activeElement: document.activeElement
    };
  }

  function startRewriteFlow(fallbackText) {
    let text = getSelectedText();
    let rect = text ? getSelectionRect() : null;

    // Fallback: use proactively tracked selection (handles editors that clear selection on right-click)
    if (!text && lastKnownSelection) {
      text = lastKnownSelection.text;
      rect = lastKnownSelection.rect;
    }

    // Final fallback: use selectionText from context-menu API
    if (!text && fallbackText) {
      text = fallbackText;
    }

    if (!text) return;

    // Save selection for later replacement
    savedSelection = saveCurrentSelection() || (lastKnownSelection ? lastKnownSelection.saved : null);

    // Default popup position when rect is missing or zero-sized
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      rect = { bottom: 120, left: Math.max(8, window.innerWidth / 2 - 190) };
    }

    const popup = createPopup(rect);
    renderLoading(popup);

    // Request rewrite from background script (Firefox Promise-based API)
    browser.runtime.sendMessage({ type: 'REWRITE_REQUEST', text }).then((response) => {
      if (!response) {
        renderError(popup, 'No response from extension. Please reload the page and try again.');
        return;
      }

      if (!response.success) {
        renderError(popup, response.error || 'An unknown error occurred.');
        return;
      }

      if (!response.suggestions || response.suggestions.length === 0) {
        renderError(popup, 'No suggestions were generated. Please try again.');
        return;
      }

      renderSuggestions(popup, response.suggestions, (chosen) => {
        replaceSelectedText(chosen, savedSelection);
        removePopup();
      });
    }).catch((err) => {
      renderError(popup, err.message || 'Failed to communicate with extension.');
    });
  }

  // ── Message Listener ──────────────────────────────────────────

  browser.runtime.onMessage.addListener((message) => {
    if (message.type === 'START_REWRITE') {
      startRewriteFlow(message.selectionText);
    }
  });

  // ── Click-outside to close popup ──────────────────────────────

  document.addEventListener('mousedown', (e) => {
    const popup = document.getElementById(POPUP_ID);
    if (popup && !popup.contains(e.target)) {
      removePopup();
    }
  });

  // ── Escape key to close popup ─────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      removePopup();
    }
  });

})();
