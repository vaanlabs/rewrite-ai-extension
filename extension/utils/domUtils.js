// domUtils.js — Utility for creating and managing the floating popup in the page

const POPUP_ID = 'rcr-ai-popup';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Create the floating popup container and inject it into the page.
 * @param {DOMRect} rect – bounding rect of the selected text
 * @returns {HTMLElement}
 */
export function createPopup(rect) {
  removePopup(); // ensure no duplicates

  const popup = document.createElement('div');
  popup.id = POPUP_ID;

  // Position near selection
  const top = rect.bottom + window.scrollY + 8;
  const left = Math.max(8, rect.left + window.scrollX);

  popup.style.cssText = `
    position: absolute;
    top: ${top}px;
    left: ${left}px;
    z-index: 2147483647;
    width: 380px;
    max-height: 440px;
    overflow-y: auto;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,.14), 0 1.5px 6px rgba(0,0,0,.08);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    padding: 16px;
    opacity: 0;
    transform: scale(0.96);
    transition: opacity 150ms ease, transform 150ms ease;
  `;

  document.body.appendChild(popup);

  // Trigger animation
  requestAnimationFrame(() => {
    popup.style.opacity = '1';
    popup.style.transform = 'scale(1)';
  });

  return popup;
}

/**
 * Remove the popup from the page if it exists.
 */
export function removePopup() {
  const existing = document.getElementById(POPUP_ID);
  if (existing) existing.remove();
}

/**
 * Render loading state inside the popup.
 * @param {HTMLElement} popup
 */
export function renderLoading(popup) {
  popup.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px 0;">
      <div class="rcr-spinner"></div>
      <span style="color:#6b7280;font-size:14px;">Generating suggestions…</span>
    </div>
    <style>
      .rcr-spinner {
        width: 28px; height: 28px;
        border: 3px solid #e5e7eb;
        border-top-color: #6366f1;
        border-radius: 50%;
        animation: rcr-spin .7s linear infinite;
      }
      @keyframes rcr-spin { to { transform: rotate(360deg); } }
    </style>
  `;
}

/**
 * Render an error message in the popup.
 * @param {HTMLElement} popup
 * @param {string} message
 */
export function renderError(popup, message) {
  popup.innerHTML = `
    <div style="padding:12px 0;">
      <div style="font-weight:600;font-size:15px;color:#111;margin-bottom:12px;">Rewrite Suggestions</div>
      <div style="color:#ef4444;font-size:13px;line-height:1.5;padding:12px;background:#fef2f2;border-radius:8px;">
        ${escapeHtml(message)}
      </div>
      <button id="rcr-cancel-btn" style="
        margin-top:12px;width:100%;padding:8px 0;border:1px solid #e5e7eb;
        border-radius:8px;background:#fff;color:#6b7280;font-size:13px;cursor:pointer;
      ">Cancel</button>
    </div>
  `;
  popup.querySelector('#rcr-cancel-btn').addEventListener('click', removePopup);
}

/**
 * Render suggestion cards in the popup.
 * @param {HTMLElement} popup
 * @param {string[]} suggestions
 * @param {function} onSelect – callback when a suggestion is clicked
 */
export function renderSuggestions(popup, suggestions, onSelect) {
  const header = `<div style="font-weight:600;font-size:15px;color:#111;margin-bottom:12px;">Rewrite Suggestions</div>`;

  const cards = suggestions.map((text, i) => `
    <div class="rcr-card" data-index="${i}" style="
      padding: 10px 14px;
      margin-bottom: 8px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      font-size: 13.5px;
      line-height: 1.55;
      color: #1f2937;
      cursor: pointer;
      transition: background 120ms, box-shadow 120ms, transform 120ms;
    ">${escapeHtml(text)}</div>
  `).join('');

  const cancelBtn = `
    <button id="rcr-cancel-btn" style="
      margin-top:4px;width:100%;padding:8px 0;border:1px solid #e5e7eb;
      border-radius:8px;background:#fff;color:#6b7280;font-size:13px;cursor:pointer;
      transition: background 120ms;
    ">Cancel</button>
  `;

  const hoverStyle = `
    <style>
      .rcr-card:hover {
        background: #f5f3ff !important;
        box-shadow: 0 2px 8px rgba(99,102,241,.12) !important;
        transform: translateY(-1px);
      }
      #rcr-cancel-btn:hover {
        background: #f9fafb !important;
      }
    </style>
  `;

  popup.innerHTML = header + cards + cancelBtn + hoverStyle;

  // Attach click handlers
  popup.querySelectorAll('.rcr-card').forEach((card) => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.index, 10);
      onSelect(suggestions[idx]);
    });
  });

  popup.querySelector('#rcr-cancel-btn').addEventListener('click', removePopup);
}

/**
 * Basic HTML escaping to prevent XSS when rendering text into the popup.
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
