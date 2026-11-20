import { describe, test, expect, vi } from "vitest";

// Settings with a blank, a missing and a base-language message, to check message selection.
vi.mock("../src/settings", () => ({
  LOCALES: {
    en: { limitMessage: "   " },
    fr: {},
    pt: { limitMessage: "[title]: limite de [max] por pedido nesta oferta." },
  },
  DEFAULT_LOCALE: "en",
  FALLBACK_MESSAGE: "[title]: Limit [max] per order on this offer.",
}));

const { cartValidationsGenerateRun } = await import("../src/cart_validations_generate_run");

const input = (isoCode, shopMessages = null) => ({
  buyerJourney: { step: "CHECKOUT_COMPLETION" },
  localization: { language: { isoCode } },
  shop: { messages: shopMessages ? { jsonValue: shopMessages } : null },
  cart: {
    lines: [
      {
        quantity: 9,
        merchandise: {
          product: { id: "gid://shopify/Product/1", title: "Green Snowboard", quantityMax: { value: "4" } },
        },
      },
    ],
  },
});

const message = (isoCode, shopMessages) =>
  cartValidationsGenerateRun(input(isoCode, shopMessages)).operations[0].validationAdd.errors[0].message;

describe("message selection", () => {
  test("regional code uses the base language (PT_BR → pt)", () => {
    expect(message("PT_BR")).toBe("Green Snowboard: limite de 4 por pedido nesta oferta.");
  });

  test("blank default-language message uses FALLBACK_MESSAGE", () => {
    expect(message("EN")).toBe("Green Snowboard: Limit 4 per order on this offer.");
  });

  test("message edited on the app page wins over the locale files", () => {
    expect(message("EN", { en: "Max [max] for [title]." })).toBe("Max 4 for Green Snowboard.");
  });

  test("regional code uses an edited base-language message", () => {
    expect(message("PT_PT", { pt: "Máximo [max]: [title]." })).toBe("Máximo 4: Green Snowboard.");
  });

  test("invalid shop setting is ignored", () => {
    expect(message("EN", "not an object")).toBe("Green Snowboard: Limit 4 per order on this offer.");
  });

  test("missing buyer-language message falls through to FALLBACK_MESSAGE", () => {
    expect(message("FR")).toBe("Green Snowboard: Limit 4 per order on this offer.");
  });
});
