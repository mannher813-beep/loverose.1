// Liste mondiale des pays / indicatifs téléphoniques.
//
// Remplace l'ancienne table Supabase "country_codes" (restreinte à une liste
// figée de pays autorisés). Les données viennent de deux bibliothèques
// maintenues, jamais d'une liste codée en dur :
//   - libphonenumber-js  → liste des pays reconnus + indicatif international
//   - Intl.DisplayNames  → nom du pays dans la langue de l'utilisateur (API
//     navigateur standard, alimentée par les données ICU/CLDR maintenues par
//     Unicode, pas de traduction maison à entretenir)
//
// Le drapeau est calculé à la volée à partir du code ISO 3166-1 alpha-2
// (conversion en "indicateurs régionaux" Unicode) — aucune image ni liste
// d'émojis à maintenir.

import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js";

export interface CountryOption {
  iso2: CountryCode;
  name: string;
  dialCode: string; // ex: "+237"
  flag: string; // emoji
}

export function flagEmoji(iso2: string): string {
  if (!iso2 || iso2.length !== 2) return "🏳️";
  const codePoints = iso2
    .toUpperCase()
    .split("")
    .map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

let cachedList: CountryOption[] | null = null;
let cachedLocale = "";

export function getCountryList(locale = "fr"): CountryOption[] {
  if (cachedList && cachedLocale === locale) return cachedList;

  let displayNames: Intl.DisplayNames | null = null;
  try {
    displayNames = new Intl.DisplayNames([locale, "fr", "en"], { type: "region" });
  } catch {
    displayNames = null;
  }

  const list = getCountries()
    .map((iso2) => {
      let name = iso2;
      try {
        name = displayNames?.of(iso2) || iso2;
      } catch {
        name = iso2;
      }
      let dialCode = "";
      try {
        dialCode = `+${getCountryCallingCode(iso2)}`;
      } catch {
        dialCode = "";
      }
      return {
        iso2,
        name,
        dialCode,
        flag: flagEmoji(iso2),
      } as CountryOption;
    })
    .filter((c) => c.dialCode)
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  cachedList = list;
  cachedLocale = locale;
  return list;
}

// Détection automatique du pays de l'utilisateur, au meilleur effort :
// 1) géolocalisation par IP (rapide, pas de permission navigateur requise)
// 2) à défaut, la région déduite de la langue du navigateur
// 3) à défaut, repli sur le Cameroun (marché principal actuel de LoveRose)
export async function detectUserCountry(fallback: CountryCode = "CM"): Promise<CountryCode> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch("https://ipapi.co/json/", { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const iso = (data?.country_code || data?.country) as string | undefined;
      if (iso && getCountries().includes(iso as CountryCode)) {
        return iso as CountryCode;
      }
    }
  } catch {
    // Réseau indisponible / bloqué / timeout : on continue avec les autres méthodes.
  }

  try {
    const locale = new Intl.Locale(navigator.language);
    const region = (locale as any).region || navigator.language.split("-")[1];
    if (region && getCountries().includes(region as CountryCode)) {
      return region as CountryCode;
    }
  } catch {
    // Intl.Locale indisponible sur ce navigateur : on garde le repli.
  }

  return fallback;
}
