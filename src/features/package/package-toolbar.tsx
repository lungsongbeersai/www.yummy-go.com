"use client";

import { PackagePlus, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SearchInput } from "@/components/common/search-input";
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
  canAddPackage: boolean;
  refreshing: boolean;
  search: string;
  status: PackageStatusFilter;
  onAddPackage?: () => void;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: PackageStatusFilter) => void;
}

export function PackageToolbar({
  canAddPackage,
  refreshing,
  search,
  status,
  onAddPackage,
  onRefresh,
  onSearchChange,
  onStatusChange,
}: PackageToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:items-center sm:justify-end">
      <SearchInput
        ariaLabel={t("packageManagement.searchPlaceholder")}
        className="col-span-2 h-11 min-w-0 sm:col-span-1 sm:h-8 sm:w-56 lg:w-72"
        placeholder={t("packageManagement.searchPlaceholder")}
        value={search}
        onChange={onSearchChange}
      />

      <Select
        value={status}
        onValueChange={(value) =>
          onStatusChange(value as PackageStatusFilter)
        }
      >
        <SelectTrigger
          aria-label={t("packageManagement.statusLabel")}
          className="h-11 w-full min-w-0 sm:h-8 sm:w-36"
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

      <Button
        type="button"
        size="sm"
        className="col-span-2 h-11 sm:col-span-1 sm:h-8"
        disabled={!canAddPackage || !onAddPackage}
        onClick={onAddPackage}
      >
        <PackagePlus data-icon="inline-start" />
        {t("packageManagement.addPackage")}
      </Button>
    </div>
  );
}
