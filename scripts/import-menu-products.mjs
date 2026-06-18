#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import xlsx from "xlsx";

const XLSX = xlsx.default ?? xlsx;

export const DEFAULT_EXCEL_PATH = "outputs/menu-units/ລາຍການອາຫານ 2026 - with units.xlsx";
export const DEFAULT_BRANCH_UUID = "16bd0ecd-248a-47c8-b8e3-c424f1a9bba1";
export const DEFAULT_SIZE_UUID = "5a9949a3-0f6b-4eea-a86a-1fd2b99352c3";
export const DEFAULT_OUTPUT_DIR = "outputs/menu-import";
export const SKIPPED_CATEGORY = "ປະເພດລາບ+ກ້ອຍ";

export const UNIT_UUID_BY_NAME = {
  "ແກ້ວ": "dffe1d42-b2ac-4ecf-9833-e2c636021f0b",
  "ກະປ໋ອງ": "d2e5e42c-be2e-4a8d-bff2-ec3bc2f761b0",
  "ໂຕ": "865d8634-a3db-477d-bf7b-792d7da58cec",
  "ຫໍ່": "43ef8bf8-89b9-4bb1-91ec-65deb19d6ae9",
  "ຕິບ": "dfa9aa00-8bcf-44a6-bb9a-5250f126bf88",
  "ຈານ": "f57ee5bd-d0ca-42aa-8b0d-f314cef2a1c4",
  "ຖ້ວຍ": "e8364b57-e301-408b-b266-79784d3f1eee",
  "ຊຸດ": "afb52093-c04e-46aa-b097-1cca3ab8b36b",
  "ຕຸກ": "dffe1d42-b2ac-4ecf-9833-e2c636021f0b"
};

export const CATEGORY_UUID_BY_HEADER = {
  "ປະເພດແຈ່ວ+ຊຸບຜັກ": "ece16e42-25be-4b72-9534-23ce8bdf0d36",
  "ປະເພດເຂົ້າ+ອາຫານຈານດ່ຽວ": "35010a0a-2067-4ee2-a0a0-1a7ef67258be",
  "ປະເພດຕຳ ແລະ ຍຳ": "b8dd26d7-7994-4c83-a21c-80b6f5537048",
  "ປະເພດຈືນ + ປີ້ງ": "06b7a4a1-9e6e-492a-825c-b15aed8edf79",
  "ປະເພດ ເອາະ+ ແກງ": "87da02c0-a292-4f3b-9e9c-1b859ae27dc2",
  "ປະເພດລາບ+ກ້ອຍ": "00000000-0000-4000-8000-000000000001",
  "ປະເພດຂົ້ວ+ຜັດ": "39d1f496-1de4-4a53-afb1-f0c349b764fe",
  "ປະເພດໝົກ": "60e7cf19-2d9c-4bc1-949c-04c1e3a8ad7c",
  "ປະເພດອາຫານຕາມລະດູການ": "8366ab74-e905-4bb0-97de-4e3e3ba7d1f8",
  "ປະເພດເຄື່ອງດື່ມ": "199b1116-4665-44b2-9ba3-485cbdb46394"
};

const REQUIRED_COLUMNS = ["ລ/ດ", "ລາຄາ", "Unit", "English"];
const CATEGORY_ENGLISH_NAMES = [
  "Lao Dips & Vegetable Soup",
  "Rice & One-Dish Meals",
  "Papaya Salads & Spicy Salads",
  "Fried & Grilled Dishes",
  "Lao Stews & Soups",
  "Larb & Koi",
  "Fried & Stir-Fried Dishes",
  "Steamed Dishes",
  "Seasonal Dishes",
  "Beverages"
];
const UNIT_ENGLISH_NAMES = ["Glass", "Can", "Whole", "Pack", "Basket", "Plate", "Bowl", "Set", "Bottle"];

function defaultReferences() {
  return {
    branchUuid: DEFAULT_BRANCH_UUID,
    sizeUuid: DEFAULT_SIZE_UUID,
    categoryUuidByHeader: CATEGORY_UUID_BY_HEADER,
    unitUuidByName: UNIT_UUID_BY_NAME,
    createdReferences: []
  };
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeNameKey(value) {
  return normalizeText(value).toLocaleLowerCase("lo");
}

function numberValue(value) {
  if (typeof value === "number") return value;
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseArgs(argv) {
  const options = {
    dryRun: true,
    excelPath: DEFAULT_EXCEL_PATH,
    outputDir: DEFAULT_OUTPUT_DIR
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--execute") options.dryRun = false;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--excel") options.excelPath = argv[++index] ?? options.excelPath;
    else if (arg === "--output-dir") options.outputDir = argv[++index] ?? options.outputDir;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/import-menu-products.mjs [--dry-run]",
    "  YUMMY_GO_TOKEN=... node scripts/import-menu-products.mjs --execute",
    "",
    "Options:",
    "  --excel <path>       Excel file to import",
    "  --output-dir <path>  Report output directory",
    "  --execute            POST products to the API",
    "  --dry-run            Parse and report only (default)"
  ].join("\n");
}

async function readDotEnv(cwd) {
  try {
    const text = await fs.readFile(path.join(cwd, ".env"), "utf8");
    return Object.fromEntries(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const at = line.indexOf("=");
          return [line.slice(0, at), line.slice(at + 1).replace(/^["']|["']$/g, "")];
        })
    );
  } catch {
    return {};
  }
}

function readRows(excelPath) {
  const workbook = XLSX.readFile(excelPath);
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("Workbook has no sheets.");

  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    header: 1,
    blankrows: false,
    defval: null
  });
}

function findHeaderRow(rows) {
  return rows.findIndex((row) => REQUIRED_COLUMNS.every((column) => row.some((cell) => normalizeText(cell) === column)));
}

function makeProduct(row, rowNumber, categoryHeader, nextCode, references = defaultReferences()) {
  const nameLa = normalizeText(row[1]);
  const price = numberValue(row[2]);
  const unitName = normalizeText(row[3]);
  const nameEng = normalizeText(row[4]) || nameLa;
  const cateUuid = references.categoryUuidByHeader[categoryHeader];
  const unitUuid = references.unitUuidByName[unitName];

  return {
    rowNumber,
    categoryHeader,
    unitName,
    payload: {
      branch_uuid_fk: references.branchUuid,
      cate_uuid_fk: cateUuid,
      unite_uuid_fk: unitUuid,
      prod_code: nextCode,
      prod_name_la: nameLa,
      prod_name_eng: nameEng,
      prod_order_point: 10,
      prod_notification: 2,
      status_sort_fk: 1,
      prod_set_price: 0,
      prod_status_imge: 2,
      prod_image: "#d7b8f3",
      prod_topping_status: 1,
      toppings: [],
      details: [
        {
          size_uuid_fk: references.sizeUuid,
          pro_detail_bprice: price,
          pro_detail_sprice: price,
          pro_detail_qty_stock: 100,
          pro_detail_stock: 1,
          pro_detail_enabled: 1
        }
      ]
    }
  };
}

export function nextProductCode(usedCodes, startAt = 1) {
  let number = startAt;
  let code = "";
  do {
    code = `PRD-${String(number).padStart(3, "0")}`;
    number += 1;
  } while (usedCodes.has(code));
  usedCodes.add(code);
  return code;
}

export function parseMenuRows(rows, existingProducts = [], references = defaultReferences()) {
  const headerIndex = findHeaderRow(rows);
  if (headerIndex < 0) throw new Error(`Cannot find required columns: ${REQUIRED_COLUMNS.join(", ")}`);

  const usedCodes = new Set(existingProducts.map((row) => normalizeText(row.prod_code)).filter(Boolean));
  const existingNames = new Set(
    existingProducts
      .flatMap((row) => [row.prod_name_la, row.prod_name, row.prod_name_eng])
      .map(normalizeNameKey)
      .filter(Boolean)
  );
  const importable = [];
  const skipped = [];
  let currentCategory = normalizeText(rows[headerIndex][1]);

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const rowNumber = index + 1;
    const no = row[0];
    const name = normalizeText(row[1]);
    const price = numberValue(row[2]);
    const unitName = normalizeText(row[3]);

    if (!name) continue;
    if ((no === null || no === undefined || no === "") && !price) {
      currentCategory = name;
      continue;
    }
    if (!price) {
      skipped.push({ rowNumber, name, categoryHeader: currentCategory, reason: "missing_price" });
      continue;
    }
    if (!references.categoryUuidByHeader[currentCategory]) {
      skipped.push({ rowNumber, name, categoryHeader: currentCategory, reason: "unknown_category" });
      continue;
    }
    if (!references.unitUuidByName[unitName]) {
      skipped.push({ rowNumber, name, categoryHeader: currentCategory, unitName, reason: "unknown_unit" });
      continue;
    }
    if (existingNames.has(normalizeNameKey(name))) {
      skipped.push({ rowNumber, name, categoryHeader: currentCategory, reason: "duplicate_name" });
      continue;
    }

    importable.push(makeProduct(row, rowNumber, currentCategory, nextProductCode(usedCodes), references));
  }

  return { importable, skipped };
}

export function serializePayload(payload) {
  return {
    ...payload,
    details: JSON.stringify(payload.details),
    toppings: JSON.stringify(payload.toppings)
  };
}

function toFormData(payload) {
  const data = new FormData();
  const serialized = serializePayload(payload);
  for (const [key, value] of Object.entries(serialized)) {
    if (value === undefined || value === null) continue;
    data.append(key, String(value));
  }
  return data;
}

async function apiJson(baseUrl, token, url, init = {}) {
  const response = await fetch(`${baseUrl}${url}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "x-access-token": token,
      ...(init.headers ?? {})
    }
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok || (json.status && json.status !== "success")) {
    throw new Error(json.message ?? `Request failed: ${response.status}`);
  }
  return json;
}

function decodeTokenPayload(token) {
  const payload = token?.split(".")[1];
  if (!payload) throw new Error("YUMMY_GO_TOKEN is not a valid JWT.");
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
}

function textMatches(row, values) {
  const keys = ["cate_name", "cate_name_la", "cate_name_eng", "unite_name", "unite_name_la", "unite_name_eng"];
  const expected = values.map(normalizeNameKey).filter(Boolean);
  return keys.some((key) => expected.includes(normalizeNameKey(row?.[key])));
}

async function postJson(baseUrl, token, url, data) {
  return apiJson(baseUrl, token, url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
}

async function fetchReferenceList(baseUrl, token, endpoint, storeUuid) {
  const query = new URLSearchParams({
    store_uuid_fk: storeUuid,
    search: "",
    page: "1",
    limit: "All",
    lang: "la",
    orderBy: "1"
  });
  const result = await apiJson(baseUrl, token, `${endpoint}?${query.toString()}`);
  return Array.isArray(result.data) ? result.data : [];
}

function groupUuid(groups, kind) {
  const wanted = kind === "Drink" ? ["drink", "bever"] : ["food"];
  const group = groups.find((row) =>
    wanted.some((value) => normalizeNameKey(row.group_name_eng).includes(value))
  );
  if (!group?.group_uuid) throw new Error(`Cannot find ${kind} group for this store.`);
  return group.group_uuid;
}

async function ensureCategories(baseUrl, token, storeUuid, groups) {
  const categoryHeaders = Object.keys(CATEGORY_UUID_BY_HEADER);
  const categoryUuidByHeader = {};
  const createdReferences = [];
  let categories = await fetchReferenceList(baseUrl, token, "/api/v1/category/fetch_limit", storeUuid);

  for (const [index, header] of categoryHeaders.entries()) {
    const eng = CATEGORY_ENGLISH_NAMES[index] ?? header;
    const kind = eng === "Beverages" ? "Drink" : "Food";
    let category = categories.find((row) => textMatches(row, [header, eng]));

    if (!category) {
      const result = await postJson(baseUrl, token, "/api/v1/category/create", {
        store_uuid_fk: storeUuid,
        group_uuid_fk: groupUuid(groups, kind),
        cate_name_la: header,
        cate_name_eng: eng,
        cate_icon: "mdi:silverware"
      });
      category = result.data ?? result;
      categories = [...categories, category];
      createdReferences.push({ type: "category", name: header, uuid: category.cate_uuid });
      console.log(`created category ${header}`);
    }

    categoryUuidByHeader[header] = category.cate_uuid;
  }

  return { categoryUuidByHeader, createdReferences };
}

async function ensureUnits(baseUrl, token, storeUuid) {
  const unitNames = Object.keys(UNIT_UUID_BY_NAME);
  const unitUuidByName = {};
  const createdReferences = [];
  let units = await fetchReferenceList(baseUrl, token, "/api/v1/unite/fetch_limit", storeUuid);

  for (const [index, lao] of unitNames.entries()) {
    const eng = UNIT_ENGLISH_NAMES[index] ?? lao;
    let unit = units.find((row) => textMatches(row, [lao, eng]));

    if (!unit) {
      const result = await postJson(baseUrl, token, "/api/v1/unite/create", {
        store_uuid_fk: storeUuid,
        unite_uuid: "",
        unite_name_la: lao,
        unite_name_eng: eng
      });
      unit = result.data ?? result;
      units = [...units, unit];
      createdReferences.push({ type: "unit", name: lao, uuid: unit.unite_uuid });
      console.log(`created unit ${lao}`);
    }

    unitUuidByName[lao] = unit.unite_uuid;
  }

  return { unitUuidByName, createdReferences };
}

async function resolveReferences(baseUrl, token) {
  const payload = decodeTokenPayload(token);
  const branchUuid = normalizeText(payload.branch_uuid);
  const storeUuid = normalizeText(payload.store_uuid_fk);
  if (!branchUuid || !storeUuid) throw new Error("Token is missing branch_uuid or store_uuid_fk.");

  const groups = await fetchReferenceList(baseUrl, token, "/api/v1/groups/fetch_limit", storeUuid);
  const categories = await ensureCategories(baseUrl, token, storeUuid, groups);
  const units = await ensureUnits(baseUrl, token, storeUuid);
  const sizes = await postJson(baseUrl, token, "/api/v1/status/fetch_size", {
    store_uuid_fk: storeUuid,
    status_sort_fk: 1,
    lang: "la"
  });
  const sizeUuid = sizes.data?.[0]?.size_uuid;
  if (!sizeUuid) throw new Error("No size option found for status_sort_fk=1.");

  return {
    branchUuid,
    storeUuid,
    sizeUuid,
    categoryUuidByHeader: categories.categoryUuidByHeader,
    unitUuidByName: units.unitUuidByName,
    createdReferences: [...categories.createdReferences, ...units.createdReferences]
  };
}

async function fetchExistingProducts(baseUrl, token, branchUuid) {
  const query = new URLSearchParams({
    branch_uuid_fk: branchUuid,
    search: "",
    page: "1",
    limit: "All",
    lang: "la"
  });
  const result = await apiJson(baseUrl, token, `/api/v1/product/fetch_limit?${query.toString()}`);
  return Array.isArray(result.data) ? result.data : [];
}

async function createProduct(baseUrl, token, item) {
  const result = await apiJson(baseUrl, token, "/api/v1/product/create", {
    method: "POST",
    body: toFormData(item.payload)
  });
  return result.data ?? result;
}

function samplePayloads(items) {
  const first = items.slice(0, 3);
  const drinks = items.filter((item) => item.categoryHeader === "ປະເພດເຄື່ອງດື່ມ").slice(0, 3);
  return [...first, ...drinks].map((item) => ({
    rowNumber: item.rowNumber,
    categoryHeader: item.categoryHeader,
    payload: serializePayload(item.payload)
  }));
}

function summary(importable, skipped, results = []) {
  return {
    importable: importable.length,
    skipped: skipped.length,
    success: results.filter((row) => row.status === "success").length,
    failed: results.filter((row) => row.status === "failed").length,
    skippedByReason: skipped.reduce((counts, row) => {
      counts[row.reason] = (counts[row.reason] ?? 0) + 1;
      return counts;
    }, {})
  };
}

async function writeReport(outputDir, mode, report) {
  await fs.mkdir(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(outputDir, `menu-products-${mode}-${timestamp}.json`);
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return outputPath;
}

export async function runImport(options) {
  const cwd = process.cwd();
  const envFile = await readDotEnv(cwd);
  const baseUrl = (process.env.YUMMY_GO_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || envFile.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const token = process.env.YUMMY_GO_TOKEN;
  const excelPath = path.resolve(cwd, options.excelPath);
  const rows = readRows(excelPath);
  const references = options.dryRun ? defaultReferences() : await resolveReferences(baseUrl, token);
  const existingProducts = options.dryRun ? [] : await fetchExistingProducts(baseUrl, token, references.branchUuid);
  const { importable, skipped } = parseMenuRows(rows, existingProducts, references);
  const results = [];

  if (!options.dryRun) {
    for (const item of importable) {
      try {
        const response = await createProduct(baseUrl, token, item);
        results.push({
          rowNumber: item.rowNumber,
          prod_code: item.payload.prod_code,
          prod_name_la: item.payload.prod_name_la,
          status: "success",
          response
        });
        console.log(`created ${item.payload.prod_code} ${item.payload.prod_name_la}`);
      } catch (error) {
        results.push({
          rowNumber: item.rowNumber,
          prod_code: item.payload.prod_code,
          prod_name_la: item.payload.prod_name_la,
          status: "failed",
          error: error instanceof Error ? error.message : String(error)
        });
        console.error(`failed ${item.payload.prod_code} ${item.payload.prod_name_la}`);
      }
    }
  }

  const report = {
    mode: options.dryRun ? "dry-run" : "execute",
    excelPath,
    branch_uuid_fk: references.branchUuid,
    store_uuid_fk: references.storeUuid,
    size_uuid_fk: references.sizeUuid,
    createdReferences: references.createdReferences,
    summary: summary(importable, skipped, results),
    samples: samplePayloads(importable),
    skipped,
    results
  };
  const reportPath = await writeReport(path.resolve(cwd, options.outputDir), report.mode, report);
  return { report, reportPath };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!options.dryRun) {
    if (!process.env.YUMMY_GO_TOKEN) throw new Error("YUMMY_GO_TOKEN is required for --execute.");
    const envFile = await readDotEnv(process.cwd());
    if (!process.env.YUMMY_GO_BASE_URL && !process.env.NEXT_PUBLIC_BASE_URL && !envFile.NEXT_PUBLIC_BASE_URL) {
      throw new Error("NEXT_PUBLIC_BASE_URL or YUMMY_GO_BASE_URL is required for --execute.");
    }
  }

  const { report, reportPath } = await runImport(options);
  console.log(JSON.stringify({ summary: report.summary, reportPath }, null, 2));
  if (options.dryRun) {
    console.log("Dry run only. Add --execute and set YUMMY_GO_TOKEN to create products.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(fileURLToPath(import.meta.url)).href && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
