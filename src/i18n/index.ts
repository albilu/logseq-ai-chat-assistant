import { fr } from "./locales/fr";
import { en } from "./locales/en";
import type { TranslationKey, Translations } from "./types";

type SupportedLocale = "en" | "fr" | "de" | "nl" | "zh";

const TRANSLATIONS: Record<SupportedLocale, Translations> = {
  en,
  fr,
  de: en,
  nl: en,
  zh: en,
};

const LOCALE_MAP: Record<string, SupportedLocale> = {
  fr: "fr",
  de: "de",
  nl: "nl",
  zh: "zh",
};

let activeTranslations: Translations = en;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[part];
  }

  return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, vars?: Record<string, string>): string {
  if (!vars) {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

export type { TranslationKey };

export function resolveLocaleFromPreferredLanguage(preferredLanguage?: string): SupportedLocale {
  const prefix = (preferredLanguage ?? "").split("-")[0].toLowerCase();
  return LOCALE_MAP[prefix] ?? "en";
}

export async function initLocale(runtime: {
  App: { getUserConfigs?(): Promise<{ preferredLanguage: string }> };
}): Promise<void> {
  try {
    if (typeof runtime.App.getUserConfigs !== "function") {
      activeTranslations = en;
      return;
    }

    const { preferredLanguage } = await runtime.App.getUserConfigs();
    const locale = resolveLocaleFromPreferredLanguage(preferredLanguage);
    activeTranslations = TRANSLATIONS[locale];
  } catch {
    activeTranslations = en;
  }
}

export function t(key: TranslationKey, vars?: Record<string, string>): string {
  const value =
    getNestedValue(activeTranslations as unknown as Record<string, unknown>, key) ??
    getNestedValue(en as unknown as Record<string, unknown>, key) ??
    key;

  return interpolate(value, vars);
}

export function getAllTranslationsOf(key: TranslationKey): string[] {
  const seen = new Set<string>();

  for (const locale of Object.values(TRANSLATIONS)) {
    const value = getNestedValue(locale as unknown as Record<string, unknown>, key);
    if (typeof value === "string") {
      seen.add(value);
    }
  }

  const fallback = getNestedValue(en as unknown as Record<string, unknown>, key);
  if (typeof fallback === "string") {
    seen.add(fallback);
  }

  return Array.from(seen);
}
