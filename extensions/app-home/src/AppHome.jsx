import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';

// Bundled defaults from the validation function: shown as placeholders and used when a field is left blank.
import {LOCALES, DEFAULT_LOCALE, FALLBACK_MESSAGE} from '../../quantity-limit/src/settings.js';

// App-owned shop metafield read by the validation function
// (extensions/quantity-limit/src/cart_validations_generate_run.graphql).
const NAMESPACE = '$app:quantity-limit';
const KEY = 'messages';

export default async () => {
  render(<App />, document.body);
};

/** Admin API (direct access from the app home). */
async function adminGraphql(query, variables) {
  const response = await fetch('shopify:admin/api/2026-07/graphql.json', {
    method: 'POST',
    body: JSON.stringify({query, variables}),
  });
  const json = await response.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data;
}

/** Store language code → message key used by the function (pt-BR → pt-br). */
const toKey = (locale) => locale.toLowerCase();

let displayNames;
try {
  displayNames = new Intl.DisplayNames(['en'], {type: 'language'});
} catch (e) {
  displayNames = null;
}
/** "fr" → "French", "pt-br" → "Brazilian Portuguese" (falls back to the code). */
const languageName = (key) => {
  try {
    return displayNames?.of(key) ?? key;
  } catch (e) {
    return key;
  }
};

/**
 * Languages to show, automatically from the store (Settings > Languages): every added
 * language, published or not, primary first. A message saved for a language that was
 * later removed from the store stays listed so it can still be edited or cleared.
 * @param {{locale: string, name: string, primary: boolean, published: boolean}[]} shopLocales
 * @param {Record<string, string>} stored
 */
function buildLanguages(shopLocales, stored) {
  const languages = new Map();
  for (const {locale, name, primary, published} of shopLocales) {
    languages.set(toKey(locale), {key: toKey(locale), name, primary, published, inStore: true});
  }
  for (const key of Object.keys(stored)) {
    if (!languages.has(key)) {
      languages.set(key, {key, name: languageName(key), primary: false, published: false, inStore: false});
    }
  }
  return [...languages.values()].sort(
    (a, b) => Number(b.primary) - Number(a.primary) || Number(b.published) - Number(a.published) || a.name.localeCompare(b.name),
  );
}

const fieldLabel = ({name, primary, published, inStore}) => {
  if (primary) return `${name} (default language)`;
  if (!inStore) return `${name} (removed from your store's languages)`;
  return published ? name : `${name} (not published yet)`;
};

const defaultMessage = (key) =>
  LOCALES[key]?.limitMessage || LOCALES[key.split('-')[0]]?.limitMessage || LOCALES[DEFAULT_LOCALE]?.limitMessage || FALLBACK_MESSAGE;

function App() {
  const [shopId, setShopId] = useState('');
  const [languages, setLanguages] = useState(
    /** @type {{key: string, name: string, primary: boolean, published: boolean, inStore: boolean}[]} */ ([]),
  );
  const [messages, setMessages] = useState(/** @type {Record<string, string>} */ ({}));
  const [saved, setSaved] = useState(/** @type {Record<string, string>} */ ({}));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await adminGraphql(`#graphql
          query QuantityLimitMessages($namespace: String!, $key: String!) {
            shop {
              id
              metafield(namespace: $namespace, key: $key) { jsonValue }
            }
            shopLocales { locale name primary published }
          }`, {namespace: NAMESPACE, key: KEY});

        const stored = data.shop.metafield?.jsonValue ?? {};

        setShopId(data.shop.id);
        setLanguages(buildLanguages(data.shopLocales, stored));
        setMessages(stored);
        setSaved(stored);
      } catch (e) {
        setError(`Couldn't load the messages: ${e.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const dirty = JSON.stringify(clean(messages)) !== JSON.stringify(clean(saved));

  async function save() {
    setSaving(true);
    setError('');
    try {
      const value = clean(messages);
      const data = await adminGraphql(`#graphql
        mutation SaveQuantityLimitMessages($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            userErrors { field message }
          }
        }`, {
        metafields: [{ownerId: shopId, namespace: NAMESPACE, key: KEY, type: 'json', value: JSON.stringify(value)}],
      });

      const userErrors = data.metafieldsSet.userErrors;
      if (userErrors.length) throw new Error(userErrors.map((e) => e.message).join('; '));

      setMessages(value);
      setSaved(value);
      shopify.toast.show('Messages saved');
    } catch (e) {
      setError(`Couldn't save the messages: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <s-page heading="Quantity limit messages">
      <s-button slot="primary-action" variant="primary" onClick={save} disabled={loading || !dirty} loading={saving}>
        Save
      </s-button>

      {error && (
        <s-banner tone="critical" heading="Something went wrong">
          {error}
        </s-banner>
      )}

      <s-section heading="Checkout message">
        <s-paragraph>
          Shown at checkout when a product is over its <s-text type="strong">quantity.max</s-text> limit. Use{' '}
          <s-text type="strong">[title]</s-text> for the product name and <s-text type="strong">[max]</s-text> for the
          limit. Leave a field blank to use the default message.
        </s-paragraph>
        <s-paragraph>
          Buyers see the message for their checkout language. The list follows your store's languages
          (Settings → Languages): add a language there and it appears here. Unpublished languages are used once
          you publish them.
        </s-paragraph>

        {loading ? (
          <s-spinner accessibilityLabel="Loading messages" />
        ) : (
          <s-stack gap="base">
            {languages.map((language) => {
              const {key} = language;
              return (
                <s-text-field
                  key={key}
                  label={fieldLabel(language)}
                  placeholder={defaultMessage(key)}
                  value={messages[key] ?? ''}
                  details={`Example: ${preview(messages[key] || defaultMessage(key))}`}
                  onInput={(event) => setMessages({...messages, [key]: event.currentTarget.value})}
                />
              );
            })}
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}

/** Drops blank messages so the function falls back to the defaults for them. */
function clean(messages) {
  return Object.fromEntries(
    Object.entries(messages)
      .map(([key, message]) => [key, (message ?? '').trim()])
      .filter(([, message]) => message),
  );
}

const preview = (template) => template.replace('[max]', '4').replace('[title]', 'Green Snowboard');
