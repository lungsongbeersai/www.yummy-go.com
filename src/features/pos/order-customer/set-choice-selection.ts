import type { ProdDetail, ProdItem, ProdSetChoiceGroup } from "@/services/pos";
import { optionalNumber, optionalString } from "@/lib/values";
import { enabledProductDetails } from "./product-availability";

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

export function toggleSetChoiceUuid(selected: string[], uuid: string, limit: number): string[] {
  if (selected.includes(uuid)) {
    return selected.filter((value) => value !== uuid);
  }
  if (selected.length >= limit) return selected;
  return [...selected, uuid];
}

// ตอนยืนยันออเดอร์: รายการที่ไม่มีกลุ่มบังคับรวมเหมือนเดิม + รายการที่ลูกค้าเลือกจริงในแต่ละกลุ่ม
// (เลือกได้ไม่เกิน max_select แต่ไม่บังคับให้เลือกครบ) — การเลือกในแต่ละกลุ่มเป็นอิสระต่อกัน
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

  const seen = new Set<string>();
  const dedupedChosen = chosen.filter((detail) => {
    if (seen.has(detail.proDetailUuid)) return false;
    seen.add(detail.proDetailUuid);
    return true;
  });

  return [...ungrouped, ...dedupedChosen];
}
