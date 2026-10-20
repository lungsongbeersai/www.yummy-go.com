import { optionalString } from "@/lib/values";
import type { CartItem, CartSetChildOption, CartTaste } from "@/services/pos";

export function setChildOptionNames(
  options: readonly CartSetChildOption[] | undefined,
  language = "la",
): string[] {
  const english = language.toLowerCase().startsWith("en");
  return (options ?? []).flatMap((option) => {
    const laoName = optionalString(
      option.group_name_la,
      option.child_option_name_la,
    );
    const englishName = optionalString(
      option.group_name_eng,
      option.child_option_name_eng,
    );
    const name = english ? englishName ?? laoName : laoName ?? englishName;
    return name ? [name] : [];
  });
}

export function cartTasteName(taste: CartTaste, language = "la") {
  return language.toLowerCase().startsWith("en")
    ? optionalString(taste.taste_name_eng, taste.taste_name, taste.taste_name_la)
    : optionalString(taste.taste_name, taste.taste_name_la, taste.taste_name_eng);
}

export function cartSelectionNames(
  selection: {
    set_child_options?: readonly CartSetChildOption[];
    tastes?: readonly CartTaste[];
  },
  language = "la",
): string[] {
  const names: string[] = [];
  const tastes = selection.tastes ?? [];
  const matchedTasteIndexes = new Set<number>();

  for (const option of selection.set_child_options ?? []) {
    names.push(...setChildOptionNames([option], language));
    const selectedTasteUuids = new Set(option.taste_uuid_fks ?? []);
    tastes.forEach((taste, index) => {
      const uuid = optionalString(taste.taste_uuid_fk, taste.taste_uuid);
      if (!uuid || !selectedTasteUuids.has(uuid)) return;
      const name = cartTasteName(taste, language);
      if (name) names.push(name);
      // The same sauce can belong to several chosen children. Mark it only to
      // suppress the flattened tail, while still rendering it for each owner.
      matchedTasteIndexes.add(index);
    });
  }

  tastes.forEach((taste, index) => {
    if (matchedTasteIndexes.has(index)) return;
    const name = cartTasteName(taste, language);
    if (name) names.push(name);
  });
  return names;
}

function tasteKey(taste: CartTaste) {
  return optionalString(taste.taste_uuid_fk, taste.taste_uuid)
    ?? cartTasteName(taste);
}

export function unscopedCartTastes(item: CartItem): CartTaste[] {
  const scopedTasteKeys = new Set(
    (item.toppings ?? []).flatMap((topping) =>
      (topping.tastes ?? []).flatMap((taste) => {
        const key = tasteKey(taste);
        return key ? [key] : [];
      }),
    ),
  );
  // Older cart responses flatten SET sauces onto the parent. Prefer their owning
  // component when the backend also supplies that scope, without losing legacy rows.
  return (item.tastes ?? []).filter((taste) => {
    const key = tasteKey(taste);
    return !key || !scopedTasteKeys.has(key);
  });
}

function childOptionKey(option: CartSetChildOption) {
  return optionalString(
    option.set_detail_option_group_uuid_fk,
    option.set_child_option_uuid_fk,
  ) ?? setChildOptionNames([option])[0];
}

export function cartItemSelectionNames(item: CartItem, language = "la") {
  const scopedOptionKeys = new Set(
    (item.toppings ?? []).flatMap((topping) =>
      (topping.set_child_options ?? []).flatMap((option) => {
        const key = childOptionKey(option);
        return key ? [key] : [];
      }),
    ),
  );
  return cartSelectionNames({
    set_child_options: (item.set_child_options ?? []).filter((option) => {
      const key = childOptionKey(option);
      return !key || !scopedOptionKeys.has(key);
    }),
    tastes: unscopedCartTastes(item),
  }, language);
}
