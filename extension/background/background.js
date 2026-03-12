// background.js — MV3 Service Worker
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

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'rewrite-with-ai',
    title: 'Rewrite with AI',
    contexts: ['selection']
  });
});

// ── Context Menu Click ────────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'rewrite-with-ai' && tab?.id) {
    triggerRewrite(tab.id, info.selectionText);
  }
});

// ── Keyboard Shortcut ─────────────────────────────────────────

chrome.commands.onCommand.addListener((command) => {
  if (command === 'trigger-rewrite') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        triggerRewrite(tabs[0].id);
      }
    });
  }
});

/**
 * Send a message to the content script to start the rewrite flow.
 * Falls back to injecting the content script if it isn't loaded yet (e.g. pre-existing tabs).
 */
function triggerRewrite(tabId, selectionText) {
  const msg = { type: 'START_REWRITE', selectionText };
  chrome.tabs.sendMessage(tabId, msg, () => {
    if (chrome.runtime.lastError) {
      chrome.scripting.executeScript(
        { target: { tabId }, files: ['content/content.js'] },
        () => {
          if (!chrome.runtime.lastError) {
            chrome.tabs.sendMessage(tabId, msg);
          }
        }
      );
    }
  });
}

// ── Message Listener ──────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'REWRITE_REQUEST') {
    handleRewriteRequest(message.text)
      .then((suggestions) => sendResponse({ success: true, suggestions }))
      .catch((err) => sendResponse({ success: false, error: err.message }));

    // Return true to indicate we will respond asynchronously
    return true;
  }

  if (message.type === 'OPEN_SETTINGS') {
    chrome.runtime.openOptionsPage();
    return false;
  }
});

/**
 * Load settings and call the rewrite service.
 */
async function handleRewriteRequest(text) {
  const settings = await new Promise((resolve) => {
    chrome.storage.local.get(DEFAULTS, resolve);
  });

  return await rewriteText(text, settings);
}
