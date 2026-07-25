"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import {
  branchOptionFromRow,
  selectedBranchLabel,
} from "./report-branch-options";

interface BranchFilters {
  branchUuid: string;
}

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
  const selectedBranchUuid = useBranchStore(
    (state) => state.selectedBranchUuid,
  );

  const storeUuid = authStoreUuid(user);
  const userBranchUuid = user?.branch_uuid ?? "";
  const canSelectBranch = Number(user?.status ?? 0) === 1;

  const branchOptions = useMemo(() => {
    const storeBranches =
      branchStoreUuid === storeUuid ? branches : [];

    const options = storeBranches
      .map((branch) => branchOptionFromRow(branch, language))
      .filter(
        (option): option is NonNullable<typeof option> =>
          Boolean(option),
      );

    if (
      userBranchUuid &&
      !options.some((option) => option.value === userBranchUuid)
    ) {
      options.unshift({
        value: userBranchUuid,
        label: user?.branch_name || userBranchUuid,
      });
    }

    if (canSelectBranch) {
      return options;
    }

    const lockedOptions = options.filter(
      (option) => option.value === userBranchUuid,
    );

    if (lockedOptions.length || !userBranchUuid) {
      return lockedOptions;
    }

    return [
      {
        value: userBranchUuid,
        label: user?.branch_name || userBranchUuid,
      },
    ];
  }, [
    branches,
    branchStoreUuid,
    canSelectBranch,
    language,
    storeUuid,
    user?.branch_name,
    userBranchUuid,
  ]);

  const branchOptionValues = useMemo(
    () => new Set(branchOptions.map((option) => option.value)),
    [branchOptions],
  );

  const branchStoreSelectedUuid =
    branchStoreUuid === storeUuid ? selectedBranchUuid : "";

  const defaultBranchUuid = useMemo(() => {
    if (!canSelectBranch) {
      return userBranchUuid;
    }

    const hasBranchOptions = branchOptionValues.size > 0;

    if (
      branchStoreSelectedUuid &&
      (
        !hasBranchOptions ||
        branchOptionValues.has(branchStoreSelectedUuid)
      )
    ) {
      return branchStoreSelectedUuid;
    }

    if (
      userBranchUuid &&
      (
        !hasBranchOptions ||
        branchOptionValues.has(userBranchUuid)
      )
    ) {
      return userBranchUuid;
    }

    return branchOptions[0]?.value ?? userBranchUuid;
  }, [
    branchOptionValues,
    branchOptions,
    branchStoreSelectedUuid,
    canSelectBranch,
    userBranchUuid,
  ]);

  const normalizeBranchFilters = useMemo(() => {
    function normalize<F extends BranchFilters>(filters: F): F;
    function normalize(filters: null): null;
    function normalize(filters: undefined): undefined;
    function normalize<F extends BranchFilters>(
      filters: F | null | undefined,
    ): F | null | undefined;
    function normalize<F extends BranchFilters>(
      filters: F | null | undefined,
    ): F | null | undefined {
      // บาง workflow อาจยังไม่มี filters ระหว่าง initial render
      if (!filters || !defaultBranchUuid) {
        return filters;
      }

      if (!canSelectBranch) {
        if (filters.branchUuid === defaultBranchUuid) {
          return filters;
        }

        return {
          ...filters,
          branchUuid: defaultBranchUuid,
        };
      }

      const hasBranchOptions = branchOptionValues.size > 0;
      const hasValidBranch =
        Boolean(filters.branchUuid) &&
        (
          !hasBranchOptions ||
          branchOptionValues.has(filters.branchUuid)
        );

      // คืน reference เดิมเมื่อข้อมูลถูกต้อง เพื่อไม่ให้ reset state ซ้ำ
      if (hasValidBranch) {
        return filters;
      }

      return {
        ...filters,
        branchUuid: defaultBranchUuid,
      };
    }

    return normalize;
  }, [
    branchOptionValues,
    canSelectBranch,
    defaultBranchUuid,
  ]);

  // ใช้ primitive key แทน branchOptions object เพื่อไม่ให้เกิด reset ทุก render
  const branchNormalizationKey = useMemo(
    () =>
      JSON.stringify([
        canSelectBranch,
        defaultBranchUuid,
        ...branchOptions.map((option) => option.value),
      ]),
    [
      branchOptions,
      canSelectBranch,
      defaultBranchUuid,
    ],
  );

  useEffect(() => {
    if (!storeUuid) {
      return;
    }

    void loadBranches(storeUuid, userBranchUuid).catch(
      () => undefined,
    );
  }, [
    loadBranches,
    storeUuid,
    userBranchUuid,
  ]);

  const branchLabelFor = useCallback(
    (branchUuid: string) =>
      selectedBranchLabel(
        branchOptions,
        branchUuid,
        user?.branch_name || branchUuid || "-",
      ),
    [
      branchOptions,
      user?.branch_name,
    ],
  );

  return {
    branchError,
    branchLabelFor,
    branchLoading,
    branchNormalizationKey,
    branchOptions,
    canSelectBranch,
    defaultBranchUuid,
    normalizeBranchFilters,
    storeUuid,
    userBranchUuid,
  };
}