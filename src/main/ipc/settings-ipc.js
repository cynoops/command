'use strict';

const ALLOWED_LANGUAGES = new Set(['en','de','fr','es','it']);
const DEFAULT_LANGUAGE = 'en';

const normalizeLanguage = (value) => {
  const key = String(value ?? '').toLowerCase();
  return ALLOWED_LANGUAGES.has(key) ? key : DEFAULT_LANGUAGE;
};

function registerSettingsIPC({ ipcMain }, state) {
  if (!state.appSettings) state.appSettings = { language: DEFAULT_LANGUAGE };
  if (!state.appSettings.language) state.appSettings.language = DEFAULT_LANGUAGE;

  ipcMain.handle('settings:setLanguage', (_event, payload) => {
    const nextLang = normalizeLanguage(payload?.language);
    state.appSettings.language = nextLang;
    return { language: nextLang };
  });

  ipcMain.handle('settings:getLanguage', () => {
    const lang = normalizeLanguage(state.appSettings?.language);
    state.appSettings.language = lang;
    return { language: lang };
  });
}

module.exports = { registerSettingsIPC };
