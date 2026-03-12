// rewriteService.js — Unified rewrite service that delegates to the active provider

import { callGroq } from './groq.js';
import { callOpenAI } from './openai.js';
import { callGemini } from './gemini.js';

const MAX_TEXT_LENGTH = 5000;

const ALLOWED_MODELS = {
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it', 'mixtral-8x7b-32768'],
  openai: ['gpt-4o-mini', 'gpt-3.5-turbo'],
  gemini: ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro']
};

const ALLOWED_STYLES = ['Improve grammar', 'Professional', 'Friendly', 'Shorter', 'Clearer'];

/**
 * Rewrite text using the user's configured AI provider.
 * @param {string} text – the selected text to rewrite
 * @param {object} settings – user settings from browser.storage.local
 * @returns {Promise<string[]>} array of up to 5 rewrite suggestions
 */
export async function rewriteText(text, settings) {
  if (!text || typeof text !== 'string') {
    throw new Error('No text provided.');
  }

  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`Text too long (${text.length} chars). Please select fewer than ${MAX_TEXT_LENGTH} characters.`);
  }

  const { provider, groqKey, openaiKey, geminiKey, groqModel, openaiModel, geminiModel, rewriteStyle } = settings;

  const style = ALLOWED_STYLES.includes(rewriteStyle) ? rewriteStyle : 'Improve grammar';

  if (provider === 'groq') {
    if (!groqKey) {
      throw new Error('Groq API key not configured. Get a free key at console.groq.com, then open extension settings.');
    }
    if (!ALLOWED_MODELS.groq.includes(groqModel)) {
      throw new Error('Invalid Groq model. Please check extension settings.');
    }
    return await callGroq(text, groqKey, groqModel, style);
  }

  if (provider === 'openai') {
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured. Please open extension settings.');
    }
    if (!ALLOWED_MODELS.openai.includes(openaiModel)) {
      throw new Error('Invalid OpenAI model. Please check extension settings.');
    }
    return await callOpenAI(text, openaiKey, openaiModel, style);
  }

  if (provider === 'gemini') {
    if (!geminiKey) {
      throw new Error('Gemini API key not configured. Please open extension settings.');
    }
    if (!ALLOWED_MODELS.gemini.includes(geminiModel)) {
      throw new Error('Invalid Gemini model. Please check extension settings.');
    }
    return await callGemini(text, geminiKey, geminiModel, style);
  }

  throw new Error('Unknown provider. Please check extension settings.');
}
