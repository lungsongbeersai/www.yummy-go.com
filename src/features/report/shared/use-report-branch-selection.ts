"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import {
  branchOptionFromRow,
  selectedBranchLabel,
} from "./report-branch-options";

// การเลือกสาขาของทุกหน้ารายงาน: โหลดรายชื่อสาขาของร้าน, จำกัดสิทธิ์ผู้ใช้ที่
// ล็อกสาขา (status !== 1), และ normalize ค่า branchUuid ใน filters ให้ถูกต้องเสมอ
// เดิมบล็อกนี้ถูกก๊อปวางไว้ในทุก use-*-report-workflow (~90 บรรทัด/ไฟล์)
export function useReportBranchSelection() {
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);
  const branches = useBranchStore((state) => state.branches);
  const branchError = useBranchStore((state) => state.error);
  const branchLoading = useBranchStore((state) => state.loading);
  const branchStoreUuid = useBranchStore((state) => state.storeUuid);
  const loadBranches = useBranchStore((state) => state.loadBranches);
  const selectedBranchUuid = useBranchStore((state) => state.selectedBranchUuid);

  const storeUuid = authStoreUuid(user);
  const userBranchUuid = user?.branch_uuid ?? "";
  const canSelectBranch = Number(user?.status ?? 0) === 1;

  const branchOptions = useMemo(() => {
    const storeBranches = branchStoreUuid === storeUuid ? branches : [];
    const options = storeBranches
      .map((branch) => branchOptionFromRow(branch, language))
      .filter((option): option is NonNullable<typeof option> => Boolean(option));

    if (userBranchUuid && !options.some((option) => option.value === userBranchUuid)) {
      options.unshift({ value: userBranchUuid, label: user?.branch_name || userBranchUuid });
    }

    if (canSelectBranch) return options;

    const lockedOptions = options.filter((option) => option.value === userBranchUuid);
    return lockedOptions.length || !userBranchUuid
      ? lockedOptions
      : [{ value: userBranchUuid, label: user?.branch_name || userBranchUuid }];
  }, [branches, branchStoreUuid, canSelectBranch, language, storeUuid, user?.branch_name, userBranchUuid]);

  const branchOptionValues = useMemo(() => new Set(branchOptions.map((option) => option.value)), [branchOptions]);
  const branchStoreSelectedUuid = branchStoreUuid === storeUuid ? selectedBranchUuid : "";

  const defaultBranchUuid = useMemo(() => {
    if (!canSelectBranch) return userBranchUuid;
    if (branchStoreSelectedUuid && (!branchOptionValues.size || branchOptionValues.has(branchStoreSelectedUuid))) {
      return branchStoreSelectedUuid;
    }
    if (userBranchUuid && (!branchOptionValues.size || branchOptionValues.has(userBranchUuid))) return userBranchUuid;
    return branchOptions[0]?.value ?? userBranchUuid;
  }, [branchOptionValues, branchOptions, branchStoreSelectedUuid, canSelectBranch, userBranchUuid]);

  const normalizeBranchFilters = useCallback(
    <F extends { branchUuid: string }>(filters: F): F => {
      if (!defaultBranchUuid) return filters;

      if (!canSelectBranch) {
        return filters.branchUuid === defaultBranchUuid ? filters : { ...filters, branchUuid: defaultBranchUuid };
      }

      if (filters.branchUuid && (!branchOptionValues.size || branchOptionValues.has(filters.branchUuid))) return filters;
      return { ...filters, branchUuid: defaultBranchUuid };
    },
    [branchOptionValues, canSelectBranch, defaultBranchUuid]
  );

  useEffect(() => {
    if (!storeUuid) return;
    void loadBranches(storeUuid, userBranchUuid).catch(() => undefined);
  }, [loadBranches, storeUuid, userBranchUuid]);

  const branchLabelFor = useCallback(
    (branchUuid: string) =>
      selectedBranchLabel(branchOptions, branchUuid, user?.branch_name || branchUuid || "-"),
    [branchOptions, user?.branch_name]
  );

  return {
    branchError,
    branchLabelFor,
    branchLoading,
    branchOptions,
    canSelectBranch,
    defaultBranchUuid,
    normalizeBranchFilters,
    storeUuid,
    userBranchUuid,
  };
}
