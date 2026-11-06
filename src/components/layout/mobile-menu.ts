import type { MenuItem } from "@/config/menu";

// Permission filtering has already happened. Only remove an unnecessary mobile
// group level; keep its identity and presentation for stable labels and keys.
export function mobileMenuItem(item: MenuItem): MenuItem {
  if (item.disabled || item.is_header || !item.children?.length) return item;
  if (item.children.some((child) => child.children?.length)) return item;

  const usableChildren = item.children.filter(
    (child) => !child.disabled && !child.is_header && Boolean(child.path),
  );
  if (usableChildren.length !== 1) return item;

  return { ...item, path: usableChildren[0].path, children: undefined };
}
