// All settings for the quantity-limit function.
//
// Messages: one file per language in ./locales, key `limitMessage`, placeholders [title] and [max].
// To add a language: create locales/<code>.json and add it to LOCALES below.
// Keys are lowercase language codes; regional variants use a dash, e.g. 'pt-br'.
import en from './locales/en.json';
import fr from './locales/fr.json';

export const LOCALES = {
  en,
  fr,
};

/** Used when the buyer's language has no message. */
export const DEFAULT_LOCALE = 'en';

/** Used when the locale files have no message (missing or empty). */
export const FALLBACK_MESSAGE = '[title]: Limit [max] per order on this offer.';
