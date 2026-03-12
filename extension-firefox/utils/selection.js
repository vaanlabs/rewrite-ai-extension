// selection.js — Utility for capturing and replacing selected text

/**
 * Get the currently selected text.
 * @returns {string}
 */
export function getSelectedText() {
  const selection = window.getSelection();
  return selection ? selection.toString().trim() : '';
}

/**
 * Replace the currently selected text with new text.
 * Handles standard elements, contenteditable, input, and textarea.
 * @param {string} newText
 * @param {object} [saved] – optional saved selection state for reliable replacement
 */
export function replaceSelectedText(newText, saved) {
  if (saved) {
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

    if (saved.type === 'range' && saved.range) {
      try {
        const container = saved.range.commonAncestorContainer;
        const node = container.nodeType === 1 ? container : container.parentElement;
        const editableParent = node ? node.closest('[contenteditable="true"]') : null;
        const isEditable = !!editableParent || (document.designMode === 'on');

        if (saved.activeElement && saved.activeElement !== document.body) {
          saved.activeElement.focus();
        } else if (editableParent) {
          editableParent.focus();
        }

        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(saved.range);

        if (isEditable) {
          if (document.execCommand('insertText', false, newText)) return;
          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(newText));
          sel.collapseToEnd();
          return;
        }
      } catch (_) {
        // Range may have become invalid
      }
      return;
    }
  }

  const activeEl = document.activeElement;

  // Handle input / textarea
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

  // Handle standard selection (contenteditable & regular DOM)
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(newText));

  // Collapse selection to end of inserted text
  selection.collapseToEnd();
}

/**
 * Get the bounding rect of the current selection for popup positioning.
 * @returns {DOMRect|null}
 */
export function getSelectionRect() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  return selection.getRangeAt(0).getBoundingClientRect();
}
