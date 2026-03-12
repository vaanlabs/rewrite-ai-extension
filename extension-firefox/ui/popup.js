// popup.js — Extension action popup script

document.getElementById('open-settings-btn').addEventListener('click', () => {
  browser.runtime.openOptionsPage();
});
