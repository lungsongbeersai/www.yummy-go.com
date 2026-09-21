import type { ProdDetail, ProdItem, ProdSetChoiceGroup } from "@/services/pos";
import { optionalNumber, optionalString } from "@/lib/values";
import { enabledProductDetails } from "./product-availability";
import { isTasteAvailable, tasteUuid } from "./taste-selection";

export function setChoiceGroups(product?: ProdItem | null): ProdSetChoiceGroup[] {
  const groups = product?.setChoiceGroups ?? [];
  return [...groups].sort(
    (left, right) => (optionalNumber(left.groupSort) ?? 0) - (optionalNumber(right.groupSort) ?? 0),
  );
}

export function setChoiceGroupUuid(group: ProdSetChoiceGroup) {
  return optionalString(group.setChoiceGroupUuid) ?? "";
}

export function setChoiceGroupMaxSelect(group: ProdSetChoiceGroup) {
  const value = optionalNumber(group.maxSelect);
  return value && value > 0 ? value : 1;
}

export function setChoiceGroupDisplayName(group: ProdSetChoiceGroup) {
  return optionalString(group.groupName, group.groupNameLa, group.groupNameEng) ?? "";
}

export interface GroupedSetDetails {
  ungrouped: ProdDetail[];
  groups: Array<{ group: ProdSetChoiceGroup; members: ProdDetail[] }>;
}

export type OrderedSetDetailSection =
  | { kind: "fixed"; details: ProdDetail[] }
  | { kind: "group"; group: ProdSetChoiceGroup; members: ProdDetail[] };

// แถวที่ไม่มีกลุ่ม (หรือกลุ่มที่อ้างถึงหายไปแล้ว) ยังคงบังคับรวมเหมือนเดิมเป๊ะ — เฉพาะ
// แถวที่อยู่ในกลุ่มจริงเท่านั้นที่กลายเป็นตัวเลือกให้กด
//
// แถวหนึ่งเป็นสมาชิกได้หลายกลุ่มพร้อมกัน จึงอาจไปโผล่ใน members ของมากกว่าหนึ่งกลุ่ม —
// ตอน resolve เป็นออเดอร์จริงต้อง dedupe เพราะแถวเดียวกันสร้าง order item ได้แค่ 1 ชิ้น
// ไม่ว่าจะถูกเลือกผ่านกลุ่มไหน (ดู resolveSetOrderDetails)
export function groupedSetDetails(product?: ProdItem | null): GroupedSetDetails {
  const details = enabledProductDetails(product);
  const groups = setChoiceGroups(product);
  const knownGroupUuids = new Set(groups.map(setChoiceGroupUuid));

  const ungrouped: ProdDetail[] = [];
  const membersByGroupUuid = new Map<string, ProdDetail[]>();

  for (const detail of details) {
    const groupUuids = (detail.setChoiceGroupUuidFks ?? [])
      .map((value) => optionalString(value))
      .filter((value): value is string => !!value && knownGroupUuids.has(value));

    if (!groupUuids.length) {
      ungrouped.push(detail);
      continue;
    }

    for (const groupUuid of groupUuids) {
      const members = membersByGroupUuid.get(groupUuid) ?? [];
      members.push(detail);
      membersByGroupUuid.set(groupUuid, members);
    }
  }

  return {
    ungrouped,
    groups: groups
      .filter((group) => (membersByGroupUuid.get(setChoiceGroupUuid(group))?.length ?? 0) > 0)
      .map((group) => ({
        group,
        members: membersByGroupUuid.get(setChoiceGroupUuid(group)) ?? [],
      })),
  };
}

// Keep the SET modal aligned with the exact row order saved in Product. Choice groups are
// inserted where their first member occurs; consecutive mandatory rows share one section.
export function orderedSetDetailSections(
  product?: ProdItem | null,
): OrderedSetDetailSection[] {
  const details = enabledProductDetails(product);
  const { ungrouped, groups } = groupedSetDetails(product);
  const ungroupedUuids = new Set(ungrouped.map((detail) => detail.proDetailUuid));
  const groupsByMemberUuid = new Map<
    string,
    Array<{ group: ProdSetChoiceGroup; members: ProdDetail[] }>
  >();

  for (const entry of groups) {
    for (const member of entry.members) {
      const memberGroups = groupsByMemberUuid.get(member.proDetailUuid) ?? [];
      memberGroups.push(entry);
      groupsByMemberUuid.set(member.proDetailUuid, memberGroups);
    }
  }

  const sections: OrderedSetDetailSection[] = [];
  const addedGroupUuids = new Set<string>();

  for (const detail of details) {
    if (ungroupedUuids.has(detail.proDetailUuid)) {
      const previousSection = sections.at(-1);
      if (previousSection?.kind === "fixed") {
        previousSection.details.push(detail);
      } else {
        sections.push({ kind: "fixed", details: [detail] });
      }
      continue;
    }

    for (const entry of groupsByMemberUuid.get(detail.proDetailUuid) ?? []) {
      const groupUuid = setChoiceGroupUuid(entry.group);
      if (addedGroupUuids.has(groupUuid)) continue;
      addedGroupUuids.add(groupUuid);
      sections.push({ kind: "group", ...entry });
    }
  }

  return sections;
}

export function toggleSetChoiceUuid(selected: string[], uuid: string, limit: number): string[] {
  if (selected.includes(uuid)) {
    return selected.filter((value) => value !== uuid);
  }
  if (selected.length >= limit) return selected;
  return [...selected, uuid];
}

export function setChildOptionSelectionLimit(detail: ProdDetail) {
  const optionCount = detail.setOptionGroups?.length ?? 0;
  if (!optionCount) return 0;
  const configuredLimit = optionalNumber(detail.setChildOptionMaxSelect) ?? 0;
  return configuredLimit > 0
    ? Math.min(configuredLimit, optionCount)
    : optionCount;
}

export function toggleSetChildOptionGroupUuid(
  selected: string[],
  uuid: string,
  limit: number,
): string[] {
  return toggleSetChoiceUuid(selected, uuid, limit);
}

function hasExactSelection(
  selectedUuids: string[],
  allowedUuids: string[],
  requiredCount: number,
) {
  const selected = new Set(selectedUuids);
  const allowed = new Set(allowedUuids);
  return selected.size === selectedUuids.length &&
    selected.size === requiredCount &&
    [...selected].every((uuid) => allowed.has(uuid));
}

export function areSetSelectionsComplete({
  product,
  selectedSetChildOptionGroupUuids,
  selectedSetChoiceTasteUuids,
  selectedSetChoiceUuids,
}: {
  product: ProdItem | null | undefined;
  selectedSetChildOptionGroupUuids: Record<string, string[]>;
  selectedSetChoiceTasteUuids: Record<string, string[]>;
  selectedSetChoiceUuids: Record<string, string[]>;
}) {
  if (!product) return true;
  const { groups } = groupedSetDetails(product);

  for (const { group, members } of groups) {
    const groupUuid = setChoiceGroupUuid(group);
    if (!hasExactSelection(
      selectedSetChoiceUuids[groupUuid] ?? [],
      members.map((detail) => detail.proDetailUuid),
      setChoiceGroupMaxSelect(group),
    )) return false;
  }

  const selectedDetails = resolveSetOrderDetails(product, selectedSetChoiceUuids);
  for (const detail of selectedDetails) {
    const optionGroups = detail.setOptionGroups ?? [];
    if (optionGroups.length) {
      const selectedGroupUuids = selectedSetChildOptionGroupUuids[detail.proDetailUuid] ?? [];
      if (!hasExactSelection(
        selectedGroupUuids,
        optionGroups.map((group) => group.setDetailOptionGroupUuid),
        setChildOptionSelectionLimit(detail),
      )) return false;

      const selectedGroups = new Set(selectedGroupUuids);
      for (const group of optionGroups) {
        if (!selectedGroups.has(group.setDetailOptionGroupUuid)) continue;
        const selectionKey = `${detail.proDetailUuid}:${group.setDetailOptionGroupUuid}`;
        const allowedTasteUuids = (group.tastes ?? [])
          .filter(isTasteAvailable)
          .map(tasteUuid);
        const requiredTasteCount = optionalNumber(group.maxSelect) ?? 0;
        if (!hasExactSelection(
          selectedSetChoiceTasteUuids[selectionKey] ?? [],
          allowedTasteUuids,
          requiredTasteCount,
        )) return false;
      }
      continue;
    }

    const legacyTasteLimit = optionalNumber(detail.setTasteMaxSelect) ?? 0;
    if (legacyTasteLimit <= 0) continue;
    const legacyKey = `${detail.proDetailUuid}:legacy:${detail.proDetailUuid}`;
    const selectedTasteUuids = selectedSetChoiceTasteUuids[legacyKey]
      ?? selectedSetChoiceTasteUuids[detail.proDetailUuid]
      ?? [];
    const allowedTasteUuids = (detail.setTastes ?? [])
      .filter(isTasteAvailable)
      .map(tasteUuid);
    if (!hasExactSelection(
      selectedTasteUuids,
      allowedTasteUuids,
      legacyTasteLimit,
    )) return false;
  }

  return true;
}

// ตอนยืนยันออเดอร์: รายการที่ไม่มีกลุ่มบังคับรวมเหมือนเดิม + รายการที่ลูกค้าเลือกจริงในแต่ละกลุ่ม
// การเลือกในแต่ละกลุ่มเป็นอิสระต่อกัน และจุดตรวจ areSetSelectionsComplete จะบังคับให้ครบ max_select
// (แถวเดียวกันอาจถูกเลือกจากกลุ่มหนึ่งแต่ไม่ถูกเลือกจากอีกกลุ่ม) แต่ผลลัพธ์สุดท้ายต้อง
// dedupe ด้วย proDetailUuid เพราะแถวเดียวกันสร้าง order item ซ้ำสองชิ้นไม่ได้
export function resolveSetOrderDetails(
  product: ProdItem | null | undefined,
  selectedSetChoiceUuids: Record<string, string[]>,
): ProdDetail[] {
  const { ungrouped, groups } = groupedSetDetails(product);
  const chosen = groups.flatMap(({ group, members }) => {
    const selected = new Set(selectedSetChoiceUuids[setChoiceGroupUuid(group)] ?? []);
    return members.filter((detail) => selected.has(detail.proDetailUuid));
  });

  const includedUuids = new Set([
    ...ungrouped.map((detail) => detail.proDetailUuid),
    ...chosen.map((detail) => detail.proDetailUuid),
  ]);

  return enabledProductDetails(product).filter((detail) =>
    includedUuids.has(detail.proDetailUuid)
  );
}

// ส่งกลุ่มที่ผู้ใช้เลือกแถวนี้ผ่านไปกับ create_order ด้วย เพื่อให้ backend ตรวจได้ว่า
// รายการนั้นเป็นสมาชิกของกลุ่มจริงและแต่ละกลุ่มไม่เกิน max_select หลังจากแถวที่อยู่หลายกลุ่ม
// ถูก dedupe เหลือ order item เดียวแล้ว
export function selectedSetChoiceGroupUuidsForDetail(
  product: ProdItem | null | undefined,
  selectedSetChoiceUuids: Record<string, string[]>,
  detailUuid: string,
): string[] {
  return groupedSetDetails(product).groups.flatMap(({ group, members }) => {
    const groupUuid = setChoiceGroupUuid(group);
    const belongsToGroup = members.some((detail) => detail.proDetailUuid === detailUuid);
    const selectedInGroup = (selectedSetChoiceUuids[groupUuid] ?? []).includes(detailUuid);
    return belongsToGroup && selectedInGroup ? [groupUuid] : [];
  });
}
