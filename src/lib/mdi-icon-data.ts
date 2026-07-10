import type { IconifyIcon, IconifyJSON } from "@iconify/react/offline";

export type MdiIconMap = Readonly<Record<string, IconifyIcon>>;

interface IconifyAlias {
  hFlip?: boolean;
  parent: string;
  rotate?: number;
  vFlip?: boolean;
}

const MDI_ICON_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
let mdiCollectionPromise: Promise<IconifyJSON> | undefined;

function ownValue<T>(record: Readonly<Record<string, T>>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

export function mdiIconName(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized.startsWith("mdi:")) return null;
  const name = normalized.slice(4);
  return MDI_ICON_NAME.test(name) ? name : null;
}

export function getMdiIconData(value: unknown, icons: MdiIconMap) {
  const name = mdiIconName(value);
  return name ? ownValue(icons, name) ?? null : null;
}

function withCollectionDimensions(icon: IconifyIcon, collection: IconifyJSON): IconifyIcon {
  return {
    height: collection.height ?? collection.width ?? 16,
    width: collection.width ?? collection.height ?? 16,
    ...icon
  };
}

function applyAlias(icon: IconifyIcon, alias: IconifyAlias): IconifyIcon {
  const rotate = ((icon.rotate ?? 0) + (alias.rotate ?? 0)) % 4;
  return {
    ...icon,
    hFlip: Boolean(icon.hFlip) !== Boolean(alias.hFlip),
    rotate,
    vFlip: Boolean(icon.vFlip) !== Boolean(alias.vFlip)
  };
}

function iconFromCollection(collection: IconifyJSON, name: string, visited = new Set<string>()): IconifyIcon | null {
  if (visited.has(name)) return null;
  const icon = ownValue(collection.icons, name);
  if (icon) return withCollectionDimensions(icon, collection);

  const alias = collection.aliases ? ownValue(collection.aliases, name) as IconifyAlias | undefined : undefined;
  if (!alias) return null;
  visited.add(name);
  const parent = iconFromCollection(collection, alias.parent, visited);
  return parent ? applyAlias(parent, alias) : null;
}

function loadMdiCollection() {
  mdiCollectionPromise ??= import("@iconify-json/mdi/icons.json")
    .then((module) => module.default as IconifyJSON)
    .catch((error: unknown) => {
      mdiCollectionPromise = undefined;
      throw error;
    });
  return mdiCollectionPromise;
}

export async function loadMdiIconData(
  value: unknown,
  icons: MdiIconMap,
  loadCollection: () => Promise<IconifyJSON> = loadMdiCollection
) {
  const curated = getMdiIconData(value, icons);
  if (curated) return curated;

  const name = mdiIconName(value);
  if (!name) return null;

  try {
    return iconFromCollection(await loadCollection(), name);
  } catch {
    // A missing lazy chunk must degrade to the curated fallback without an unhandled rejection.
    return null;
  }
}
