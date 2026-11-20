# quantity-limit

Server-side per-order quantity limit for Shopify, as a **Cart and Checkout Validation Function**.

Each product can set a limit in the product metafield **`quantity.max`** (integer). The function
adds up that product's quantity across all cart lines (one-time and subscription lines count
together) and blocks checkout with one error per product over its limit:

> [Product title]: Limit [max] per order on this offer.

e.g. "Green Snowboard: Limit 4 per order on this offer." Shopify shows function errors at the top
of checkout, which is why the message names the product.

## Message settings

**Edit in the admin:** Apps → **quantity-limit** (the app page, `extensions/app-home`). It shows one
field per store language, taken automatically from Settings → Languages (published or not), so
adding a language needs no code. Saving applies at checkout right away, no deploy needed.
Placeholders: `[title]` (product title) and `[max]` (the limit). A blank field uses the default.

Saved messages are stored in an app-owned shop metafield (`$app:quantity-limit` / `messages`,
JSON like `{ "en": "...", "fr": "..." }`), which the function reads.

**Defaults** live in the function, `extensions/quantity-limit/src/` (changing them needs `shopify app deploy`):

| File              | What it holds                                                          |
| ----------------- | ---------------------------------------------------------------------- |
| `locales/en.json` | English default message (`limitMessage`)                               |
| `locales/fr.json` | French default message                                                 |
| `settings.js`     | `LOCALES` (which files are used), `DEFAULT_LOCALE`, `FALLBACK_MESSAGE` |

**Which message is used:** the buyer's checkout language first (`PT_BR` → `pt-br`), then its base
language (`pt`), then `DEFAULT_LOCALE` (`en`). For each, the admin message wins over the locale
file; blank ones are skipped. If nothing is found, `FALLBACK_MESSAGE` is used, so checkout never
shows a blank error.

**Add a default language:** create `locales/<code>.json` with `limitMessage`, import it in
`settings.js` and add it to `LOCALES`.

## Why

The theme (Fatty15Rebuild: `assets/cart-quantity-limit.js`, `snippets/upcarrt-subs.liquid`) caps
quantities in the browser, but these skip the theme entirely:

- cart permalinks: `/cart/VARIANT_ID:QTY`
- links with `return_to=/checkout`
- express checkout buttons, the Storefront API, other apps

Shopify runs this function inside checkout, so those are blocked too.

## Behaviour

| Buyer journey step     | Result                                               |
| ---------------------- | ---------------------------------------------------- |
| `CART_INTERACTION`     | No errors (the theme caps and trims the cart itself) |
| `CHECKOUT_INTERACTION` | Error shown while the cart is over a limit           |
| `CHECKOUT_COMPLETION`  | Order can't be placed while the cart is over a limit |
| unknown (`null`)       | Treated like checkout: error shown                   |

Products without `quantity.max` (or with 0) are ignored.

## Store setup

1. **Metafield definition** (Settings → Custom data → Products): namespace and key `quantity.max`,
   type *Integer*. Set a value on the products that need a limit.
2. **Activate the rule** after the app is installed: Settings → Checkout → **Checkout rules** →
   add *Quantity limit per order* → turn it on.

## Develop / test

```bash
npm install
cd extensions/quantity-limit
npm test            # builds the function and runs tests/fixtures/*.json
```

Run against a store (development store first):

```bash
shopify app config link                      # create or pick the app in your Partner org (fills client_id)
shopify app dev --store <store>.myshopify.com
```

Deploy a version:

```bash
shopify app deploy
```

## Notes

- Functions in a custom app (single-store distribution) require Shopify Plus on that store;
  development stores can run them for testing.
- **Reinstalling the app deletes the checkout rule** (this happens e.g. when access scopes change).
  Afterwards, check Settings → Checkout → Checkout rules and re-add *Quantity limit per order*.
  While the rule is missing, checkout isn't limited and the function doesn't run at all.
- Files: `extensions/quantity-limit/src/cart_validations_generate_run.graphql` (input) and
  `src/cart_validations_generate_run.js` (logic); tests in `tests/` (fixtures run against the built
  function, `message-selection.test.js` covers the language fallbacks).
