// storage.js — Utility for reading/writing chrome.storage.local

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

/**
 * Load all settings from chrome.storage.sync, merged with defaults.
 * @returns {Promise<object>}
 */
export function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULTS, (result) => {
      resolve(result);
    });
  });
}

/**
 * Save partial settings to chrome.storage.sync.
 * @param {object} settings
 * @returns {Promise<void>}
 */
export function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set(settings, resolve);
  });
}
