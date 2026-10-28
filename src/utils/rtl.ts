import { Recipe } from '../types';

const RTL_LANGS = ['he', 'iw', 'ar', 'fa', 'ur', 'yi'];

/** True when the text contains Hebrew/Arabic-script characters. */
export const isRtlText = (s: string) => /[֐-ࣿ]/.test(s);

// Saved recipes default to language 'en' even when scanned in Hebrew, so also sniff the title.
export const isRtlRecipe = (r: Recipe) => RTL_LANGS.includes(r.language) || isRtlText(r.title);
