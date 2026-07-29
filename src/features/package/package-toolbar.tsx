"use client";

import { ArrowUpDown, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

export type PackageStatusFilter = "all" | "1" | "2";

interface PackageToolbarProps {
  arranging: boolean;
  refreshing: boolean;
  status: PackageStatusFilter;
  onRefresh: () => void;
  onToggleArrange: () => void;
  onStatusChange: (value: PackageStatusFilter) => void;
}

export function PackageToolbar({
  arranging,
  refreshing,
  status,
  onRefresh,
  onToggleArrange,
  onStatusChange,
}: PackageToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
      <Select
        value={status}
        onValueChange={(value) => onStatusChange(value as PackageStatusFilter)}
      >
        <SelectTrigger
          aria-label={t("packageManagement.statusLabel")}
          className="h-11! w-full min-w-0 sm:h-8! sm:w-36"
          size="sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectGroup>
            <SelectItem value="all">{t("packageManagement.all")}</SelectItem>
            <SelectItem value="1">{t("packageManagement.active")}</SelectItem>
            <SelectItem value="2">{t("packageManagement.inactive")}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Button
        type="button"
        size="sm"
        variant={arranging ? "default" : "outline"}
        className="h-11 sm:h-8"
        aria-pressed={arranging}
        onClick={onToggleArrange}
      >
        <ArrowUpDown data-icon="inline-start" />
        {arranging
          ? t("packageManagement.arrangeDone")
          : t("packageManagement.arrange")}
      </Button>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="size-11 px-0 sm:size-auto sm:h-8 sm:px-3"
        aria-label={t("packageManagement.refresh")}
        disabled={refreshing}
        onClick={onRefresh}
      >
        {refreshing ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <RefreshCw data-icon="inline-start" />
        )}
        <span className="hidden lg:inline">{t("packageManagement.refresh")}</span>
      </Button>
    </div>
  );
}
