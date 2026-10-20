// Page language. The build renders every page twice: English at /, Traditional
// Chinese (Taiwan) at /zh/. The current language is module state, set once per
// pass by site/build.mjs, so templates can write L('English', '中文') inline.

let current = 'en';

export const LANGS = ['en', 'zh'];
export const setLang = (lang) => { current = lang; };
export const getLang = () => current;
export const isZh = () => current === 'zh';
export const htmlLang = () => (current === 'zh' ? 'zh-Hant-TW' : 'en');

// Pick the string for the current language.
export const L = (en, zh) => (current === 'zh' ? zh : en);

// Internal page link in the current language: href('/groups/') -> '/zh/groups/'.
export const href = (p) => (current === 'zh' && p.startsWith('/') ? `/zh${p}` : p);

// The same page in the other language, for the switcher and hreflang.
export const pathIn = (lang, p) => (lang === 'zh' ? `/zh${p}` : p);
