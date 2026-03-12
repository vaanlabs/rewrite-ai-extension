// background.js — Firefox background script (event page with module support)
// Handles context menu, keyboard command, and message routing to AI providers.

import { rewriteText } from '../services/rewriteService.js';

const DEFAULTS = {
  provider: 'groq',
  groqKey: '',
  openaiKey: '',
  geminiKey: '',
  groqModel: 'llama-3.3-70b-versatile',
  openaiModel: 'gpt-4o-mini',
  geminiModel: 'gemini-1.5-flash',
  rewriteStyle: 'Improve grammar'
};

// ── Context Menu ──────────────────────────────────────────────

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: 'rewrite-with-ai',
    title: 'Rewrite with AI',
    contexts: ['selection']
  });
});

// ── Context Menu Click ────────────────────────────────────────

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'rewrite-with-ai' && tab?.id) {
    triggerRewrite(tab.id, info.selectionText);
  }
});

// ── Keyboard Shortcut ─────────────────────────────────────────

browser.commands.onCommand.addListener((command) => {
  if (command === 'trigger-rewrite') {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]?.id) {
        triggerRewrite(tabs[0].id);
      }
    });
  }
});

/**
 * Send a message to the content script to start the rewrite flow.
 * Falls back to injecting the content script if it isn't loaded yet.
 */
function triggerRewrite(tabId, selectionText) {
  const msg = { type: 'START_REWRITE', selectionText };
  browser.tabs.sendMessage(tabId, msg).catch(() => {
    browser.tabs.executeScript(tabId, { file: 'content/content.js' }).then(() => {
      browser.tabs.sendMessage(tabId, msg);
    }).catch(() => {});
  });
}

// ── Message Listener ──────────────────────────────────────────

browser.runtime.onMessage.addListener((message, _sender) => {
  if (message.type === 'REWRITE_REQUEST') {
    // Return a Promise for async response (Firefox native pattern)
    return handleRewriteRequest(message.text)
      .then((suggestions) => ({ success: true, suggestions }))
      .catch((err) => ({ success: false, error: err.message }));
  }

  if (message.type === 'OPEN_SETTINGS') {
    browser.runtime.openOptionsPage();
    return false;
  }
});

/**
 * Load settings and call the rewrite service.
 */
async function handleRewriteRequest(text) {
  const settings = await browser.storage.local.get(DEFAULTS);
  return await rewriteText(text, settings);
}
