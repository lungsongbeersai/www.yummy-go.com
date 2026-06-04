"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const COMMON_FLAG_CODES = ["LA", "TH", "US", "JP", "CN", "VN", "KR", "SG", "MY", "KH", "MM", "EU"];
const FALLBACK_COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
  "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN",
  "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE",
  "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF",
  "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM",
  "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM",
  "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC",
  "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK",
  "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA",
  "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG",
  "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO",
  "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
  "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW"
];

export interface CurrencyFlagOption {
  code: string;
  label: string;
  englishLabel: string;
  searchText: string;
  custom?: boolean;
}

function appLanguageToRegionLocale(language: string) {
  return language === "en" ? "en" : "lo";
}

function displayName(code: string, locale: string) {
  try {
    return new Intl.DisplayNames([locale, "en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function supportedCountryCodes() {
  return FALLBACK_COUNTRY_CODES.filter((code) => /^[A-Z]{2}$/.test(code));
}

export function currencyFlagOptions(language: string, currentCode = ""): CurrencyFlagOption[] {
  const locale = appLanguageToRegionLocale(language);
  const normalizedCurrent = currentCode.trim().toUpperCase();
  const orderedCodes = Array.from(new Set([...COMMON_FLAG_CODES, ...supportedCountryCodes(), "EU"]));
  const codes = normalizedCurrent && !orderedCodes.includes(normalizedCurrent) ? [normalizedCurrent, ...orderedCodes] : orderedCodes;

  return codes.map((code) => {
    const label = displayName(code, locale);
    const englishLabel = displayName(code, "en");
    return {
      code,
      label,
      englishLabel,
      searchText: `${code} ${label} ${englishLabel}`.toLowerCase(),
      custom: code === normalizedCurrent && !orderedCodes.includes(normalizedCurrent)
    };
  });
}

function flagImageSrc(code: string) {
  const countryCode = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) return "";
  return `https://flagcdn.com/w80/${countryCode.toLowerCase()}.png`;
}

export function CurrencyFlag({
  className,
  code,
  label,
  small = false
}: {
  className?: string;
  code: unknown;
  label?: string;
  small?: boolean;
}) {
  const text = String(code ?? "").trim().toUpperCase();
  const src = flagImageSrc(text);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <span
      aria-label={label ?? text}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-md border border-border bg-muted text-lg",
        small && "size-6 rounded text-sm",
        className
      )}
      role="img"
      title={text || undefined}
    >
      {src && !failed ? (
        <Image
          alt={label ?? text}
          className="size-full rounded-[inherit] object-cover"
          height={small ? 24 : 36}
          loading="lazy"
          src={src}
          width={small ? 24 : 36}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-xs font-black text-muted-foreground">{text.slice(0, 3) || "-"}</span>
      )}
    </span>
  );
}
