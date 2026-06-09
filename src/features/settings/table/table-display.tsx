"use client";

import { Table2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { Table as DiningTable } from "@/services/table";
import { tableName } from "./table-utils";

export function TableStatusBadge({ status }: { status: number }) {
  const { t } = useTranslation();
  if (!status) return <span className="text-muted-foreground">-</span>;
  return <Badge>{status === 2 ? t("common.busy") : t("common.free")}</Badge>;
}

export function TableChargeBadge({
  active,
  label
}: {
  active: boolean;
  label: string;
}) {
  return (
    <Badge className={active ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"}>
      {label}
    </Badge>
  );
}

export function TableIcon() {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
      <Table2 aria-hidden />
    </span>
  );
}

export function TableIdentity({
  row,
  zoneName
}: {
  row: DiningTable;
  zoneName: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <TableIcon />
      <div className="min-w-0">
        <p className="truncate font-black">{tableName(row)}</p>
        <p className="truncate text-xs text-muted-foreground">{zoneName}</p>
      </div>
    </div>
  );
}
