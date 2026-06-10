import { stripNumberFormat } from "@/lib/number-format";
import type { Currency } from "@/services/currency";
import type { Exchange, SaveExchangeInput } from "@/services/exchange";
import type { ApiEntity } from "@/services/shared/types";

export function exchangeValue(row: ApiEntity | null | undefined, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

export function exchangeId(row: Exchange | null | undefined) {
  return exchangeValue(row, "ex_uuid");
}

export function currencyId(row: Exchange | Currency | null | undefined) {
  return exchangeValue(row, "currency_uuid_fk", exchangeValue(row, "currency_uuid"));
}

export function currencyName(row: Exchange | null | undefined, currencyById: Map<string, Currency>) {
  const related = currencyById.get(currencyId(row));
  return exchangeValue(row, "currency_name", exchangeValue(related, "currency_name", "-"));
}

export function currencyIcon(row: Exchange | null | undefined, currencyById: Map<string, Currency>) {
  const related = currencyById.get(currencyId(row));
  return exchangeValue(row, "currency_icon", exchangeValue(related, "currency_icon", "-"));
}

export function currencyOptionLabel(currency: Currency) {
  const name = exchangeValue(currency, "currency_name", "-");
  const icon = exchangeValue(currency, "currency_icon");
  return icon ? `${name} (${icon})` : name;
}

export function exchangeRate(row: Exchange | null | undefined) {
  return exchangeValue(row, "ex_price", "-");
}

export function exchangeStatus(row: Exchange | null | undefined) {
  return exchangeValue(row, "ex_status", "1");
}

export function exchangeStatusLabel(status: string, activeLabel: string, inactiveLabel: string) {
  return Number(status || 1) === 1 ? activeLabel : inactiveLabel;
}

export type ExchangeMissingField = "store" | "currency" | "rate" | null;

export function missingExchangeField({
  currencyUuid,
  price,
  storeUuid
}: {
  currencyUuid: string;
  price: string;
  storeUuid: string;
}): ExchangeMissingField {
  if (!storeUuid.trim()) return "store";
  if (!currencyUuid.trim()) return "currency";
  if (!price.trim()) return "rate";
  return null;
}

export function buildExchangePayload({
  currencyUuid,
  editing,
  price,
  status,
  storeUuid
}: {
  currencyUuid: string;
  editing: Exchange | null;
  price: string;
  status: string;
  storeUuid: string;
}): SaveExchangeInput {
  const input: SaveExchangeInput = {
    store_uuid_fk: storeUuid,
    currency_uuid_fk: currencyUuid,
    ex_price: stripNumberFormat(price, { decimal: true }),
    ex_status: Number(status || 1)
  };
  const id = exchangeId(editing);
  if (id) input.ex_uuid = id;
  return input;
}
