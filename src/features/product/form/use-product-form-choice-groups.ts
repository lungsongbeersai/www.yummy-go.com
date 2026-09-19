"use client";

import { useState } from "react";
import type { ChoiceGroupRow } from "./product-form-types";
import { emptyChoiceGroup } from "./product-form-utils";

export function useProductFormChoiceGroups() {
  const [choiceGroups, setChoiceGroups] = useState<ChoiceGroupRow[]>([]);

  function addChoiceGroup() {
    setChoiceGroups((current) => [...current, emptyChoiceGroup()]);
  }

  function updateChoiceGroup(id: string, patch: Partial<ChoiceGroupRow>) {
    setChoiceGroups((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  // เอาแถวรายละเอียดที่อยู่กลุ่มนี้ออกจากกลุ่ม (กลับเป็น "ไม่มีกลุ่ม") ก่อนลบกลุ่มทิ้ง
  // ไม่งั้นแถวเหล่านั้นจะค้างอ้างอิง client_ref ที่ไม่มีอยู่จริงแล้ว
  function removeChoiceGroup(
    id: string,
    onRemoved: (clientRef: string) => void,
  ) {
    setChoiceGroups((current) => {
      const target = current.find((row) => row.id === id);
      if (target) onRemoved(target.client_ref);
      return current.filter((row) => row.id !== id);
    });
  }

  return {
    choiceGroups,
    setChoiceGroups,
    addChoiceGroup,
    updateChoiceGroup,
    removeChoiceGroup,
  };
}
