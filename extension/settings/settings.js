// settings.js — Extension options page logic

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

const $provider     = document.getElementById('provider');
const $groqKey      = document.getElementById('groq-key');
const $openaiKey    = document.getElementById('openai-key');
const $geminiKey    = document.getElementById('gemini-key');
const $groqModel    = document.getElementById('groq-model');
const $openaiModel  = document.getElementById('openai-model');
const $geminiModel  = document.getElementById('gemini-model');
const $rewriteStyle = document.getElementById('rewrite-style');
const $statusMsg    = document.getElementById('status-msg');

const $groqKeyGroup     = document.getElementById('groq-key-group');
const $openaiKeyGroup   = document.getElementById('openai-key-group');
const $geminiKeyGroup   = document.getElementById('gemini-key-group');
const $groqModelGroup   = document.getElementById('groq-model-group');
const $openaiModelGroup = document.getElementById('openai-model-group');
const $geminiModelGroup = document.getElementById('gemini-model-group');

// ── Load saved settings on page open ───────────────────────────

chrome.storage.local.get(DEFAULTS, (settings) => {
  $provider.value     = settings.provider;
  $groqKey.value      = settings.groqKey;
  $openaiKey.value    = settings.openaiKey;
  $geminiKey.value    = settings.geminiKey;
  $groqModel.value    = settings.groqModel;
  $openaiModel.value  = settings.openaiModel;
  $geminiModel.value  = settings.geminiModel;
  $rewriteStyle.value = settings.rewriteStyle;

  updateVisibility();
});

// ── Toggle field visibility based on selected provider ─────────

$provider.addEventListener('change', updateVisibility);

function updateVisibility() {
  const p = $provider.value;

  $groqKeyGroup.classList.toggle('hidden', p !== 'groq');
  $groqModelGroup.classList.toggle('hidden', p !== 'groq');
  $openaiKeyGroup.classList.toggle('hidden', p !== 'openai');
  $openaiModelGroup.classList.toggle('hidden', p !== 'openai');
  $geminiKeyGroup.classList.toggle('hidden', p !== 'gemini');
  $geminiModelGroup.classList.toggle('hidden', p !== 'gemini');
}

// ── Save settings ──────────────────────────────────────────────

document.getElementById('settings-form').addEventListener('submit', (e) => {
  e.preventDefault();

  const settings = {
    provider:     $provider.value,
    groqKey:      $groqKey.value.trim(),
    openaiKey:    $openaiKey.value.trim(),
    geminiKey:    $geminiKey.value.trim(),
    groqModel:    $groqModel.value,
    openaiModel:  $openaiModel.value,
    geminiModel:  $geminiModel.value,
    rewriteStyle: $rewriteStyle.value
  };

  chrome.storage.local.set(settings, () => {
    $statusMsg.textContent = '✓ Settings saved';
    setTimeout(() => { $statusMsg.textContent = ''; }, 2500);
  });
});
