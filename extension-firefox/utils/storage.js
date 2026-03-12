// storage.js — Utility for reading/writing browser.storage.local (Firefox)

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
 * Load all settings from browser.storage.sync, merged with defaults.
 * @returns {Promise<object>}
 */
export function loadSettings() {
  return browser.storage.local.get(DEFAULTS);
}

/**
 * Save partial settings to browser.storage.sync.
 * @param {object} settings
 * @returns {Promise<void>}
 */
export function saveSettings(settings) {
  return browser.storage.local.set(settings);
}
