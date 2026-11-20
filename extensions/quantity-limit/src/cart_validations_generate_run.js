// @ts-check
import { LOCALES, DEFAULT_LOCALE, FALLBACK_MESSAGE } from './settings';

/**
 * @typedef {import("../generated/api").CartValidationsGenerateRunInput} CartValidationsGenerateRunInput
 * @typedef {import("../generated/api").CartValidationsGenerateRunResult} CartValidationsGenerateRunResult
 */

/**
 * Per-order quantity limit (product metafield `quantity.max`).
 *
 * Adds up each product's quantity across all cart lines (one-time and subscription
 * lines of the same product count together) and blocks checkout when the total is
 * above the product's limit. This catches what the theme can't: cart permalinks
 * (/cart/VARIANT:QTY), `return_to=/checkout` links, express checkout and other apps.
 *
 * Cart interactions are left to the theme, which caps requests and trims an
 * over-limit cart itself; blocking them here would make those corrective
 * requests fail while the cart is over the limit.
 */

const isMessage = (value) => typeof value === 'string' && value.trim() !== '';

/**
 * Message template for the buyer's language. Languages are tried in order: exact
 * code (PT_BR → pt-br), base language (pt), DEFAULT_LOCALE. For each one the message
 * edited on the app page wins over the bundled locale file; blank ones are skipped.
 * FALLBACK_MESSAGE is the last resort.
 * @param {string} isoCode
 * @param {unknown} shopMessages `{ "en": "...", "fr": "..." }` from the shop metafield
 * @returns {string}
 */
function limitTemplate(isoCode, shopMessages) {
  const edited = shopMessages && typeof shopMessages === 'object' ? shopMessages : {};
  const code = isoCode.toLowerCase().replace('_', '-');
  for (const candidate of [code, code.split('-')[0], DEFAULT_LOCALE]) {
    for (const message of [edited[candidate], LOCALES[candidate]?.limitMessage]) {
      if (isMessage(message)) return message;
    }
  }
  return FALLBACK_MESSAGE;
}

/**
 * @param {CartValidationsGenerateRunInput} input
 * @returns {CartValidationsGenerateRunResult}
 */
export function cartValidationsGenerateRun(input) {
  const errors = [];

  if (input.buyerJourney.step !== 'CART_INTERACTION') {
    /** @type {Map<string, { title: string, max: number, quantity: number }>} */
    const totals = new Map();

    for (const { quantity, merchandise } of input.cart.lines) {
      const product = 'product' in merchandise ? merchandise.product : null;
      const max = Number(product?.quantityMax?.value);
      if (!product || !(max > 0)) continue;

      const total = totals.get(product.id);
      if (total) total.quantity += quantity;
      else totals.set(product.id, { title: product.title, max, quantity });
    }

    let template;
    for (const { title, max, quantity } of totals.values()) {
      if (quantity <= max) continue;
      template ??= limitTemplate(input.localization.language.isoCode, input.shop.messages?.jsonValue);
      // Checkout shows errors at the top of the page, so the message names the product.
      const message = template.replace('[max]', String(max)).replace('[title]', title);
      errors.push({ message, target: '$.cart' });
    }
  }

  return { operations: [{ validationAdd: { errors } }] };
}
