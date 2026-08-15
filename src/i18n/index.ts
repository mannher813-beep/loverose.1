import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";

// Namespaces map to feature areas of the app. Keeping them separate (rather
// than one giant file) is what makes lazy loading actually useful: a user
// landing on /connexion only pays for auth.json + common.json, not the
// entire app's strings.
export const NAMESPACES = [
  "common", // buttons, generic labels, menus, toasts shared across screens
  "auth",
  "onboarding",
  "discover",
  "feed",
  "creator", // CreatorDashboard + CreatorOnboarding
  "notifications",
  "settings",
  "payments",
  "profile",
  "errors", // shared validation / error message strings
] as const;

export const SUPPORTED_LANGUAGES = ["fr", "en", "es"] as const;

i18n
  // Loads translation JSON on demand from /public/locales/{{lng}}/{{ns}}.json
  // instead of bundling every language into the main JS chunk.
  .use(HttpBackend)
  // Detects the visitor's language (localStorage, then browser navigator),
  // and persists an explicit choice back to localStorage.
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    ns: NAMESPACES as unknown as string[],
    defaultNS: "common",
    // Only load namespaces as components request them via useTranslation("x"),
    // not every namespace on every page load.
    partialBundledLanguages: true,
    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json",
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "loverose_lang",
    },
    interpolation: {
      // React already escapes output, and this app injects some values
      // (names, bios) that must never be interpreted as HTML — keep escaping
      // ON rather than the common "escapeValue: false" i18next React recipe.
      escapeValue: true,
    },
    react: {
      useSuspense: false, // avoids a full-app Suspense boundary requirement app-wide
    },
  });

export default i18n;
