"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TableListRow } from "@/services/table";
import type { Zone } from "@/services/zone";
import { useReferenceStore } from "@/stores/reference-store";
import { useTableStore } from "@/stores/table-store";
import {
  buildReportLocationOptions,
  type ReportLocationOptions,
} from "./report-location";

const EMPTY_OPTIONS: ReportLocationOptions = {
  tableOptions: [],
  zoneOptions: [],
};

interface LocationSourceState {
  requestKey: string;
  tableRows: TableListRow[];
  zones: Zone[];
}

const EMPTY_SOURCE_STATE: LocationSourceState = {
  requestKey: "",
  tableRows: [],
  zones: [],
};

export function useReportLocationOptions(
  branchUuid: string,
  selectedZoneUuid: string,
  language: string,
) {
  const { t } = useTranslation();
  const loadZones = useReferenceStore((state) => state.loadZones);
  const loadTables = useTableStore((state) => state.load);
  const [source, setSource] = useState<LocationSourceState>(EMPTY_SOURCE_STATE);
  const requestKey = `${branchUuid}:${language}`;

  useEffect(() => {
    let active = true;

    if (!branchUuid) {
      return () => {
        active = false;
      };
    }

    void Promise.all([
      loadZones(language, branchUuid),
      loadTables({
        branch_uuid_fk: branchUuid,
        lang: language,
        limit: "All",
        orderBy: "ASC",
        page: 1,
      }),
    ])
      .then(([nextZones, nextTableRows]) => {
        if (!active) return;
        setSource({
          requestKey,
          tableRows: nextTableRows,
          zones: nextZones,
        });
      })
      .catch(() => {
        if (!active) return;
        setSource({ requestKey, tableRows: [], zones: [] });
      });

    return () => {
      active = false;
    };
  }, [branchUuid, language, loadTables, loadZones, requestKey]);

  const currentSource = source.requestKey === requestKey ? source : EMPTY_SOURCE_STATE;
  const loading = Boolean(branchUuid) && source.requestKey !== requestKey;

  const options = useMemo(
    () =>
      branchUuid
        ? buildReportLocationOptions({
            allTablesLabel: t("report.filters.allTables"),
            allZonesLabel: t("report.filters.allZones"),
            language,
            rows: currentSource.tableRows,
            selectedZoneUuid,
            zones: currentSource.zones,
          })
        : EMPTY_OPTIONS,
    [branchUuid, currentSource, language, selectedZoneUuid, t],
  );

  return { ...options, loading };
}
