"use client";

import { Menu, Pencil, Trash2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Pieces shared by every settings page: the form dialog frame, the empty-list block and the row
// action menu. The page frame itself (header, toolbar, table/cards, pagination) lives in
// settings-list-page-layout.tsx, and the header card alone in settings-page-header.tsx.

export interface SettingsRowAction<T> {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  onSelect: (row: T) => void;
}

export function SettingsDialogContent({ className, ...props }: ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      className={cn(
        "max-h-[calc(100dvh-1rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] w-[calc(100vw-1rem)] overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] sm:max-w-xl",
        className
      )}
      {...props}
    />
  );
}

export function SettingsDialogForm({ className, ...props }: ComponentProps<"form">) {
  return <form className={cn("flex max-h-[calc(100dvh-1rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] min-h-0 flex-col sm:max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))]", className)} {...props} />;
}

export function SettingsDialogHeader({ className, ...props }: ComponentProps<typeof DialogHeader>) {
  return <DialogHeader className={cn("shrink-0 border-b border-border px-4 py-4 pr-12 text-left sm:px-6", className)} {...props} />;
}

export function SettingsDialogBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6", className)} {...props} />;
}

export function SettingsDialogFooter({ className, ...props }: ComponentProps<typeof DialogFooter>) {
  return (
    <DialogFooter
      className={cn("shrink-0 border-t border-border px-4 py-3 sm:px-6 [&>button]:w-full sm:[&>button]:w-auto", className)}
      {...props}
    />
  );
}


// บล็อก "ไม่มีข้อมูล" มาตรฐานของหน้ารายการ settings — เดิมถูกก๊อปซ้ำ 9 หน้า
export function SettingsEmptyRecords({
  description,
  icon,
  title,
  titleText
}: {
  description?: string;
  icon: ReactNode;
  title?: string;
  titleText?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-72 flex-1 items-center justify-center p-4">
      <Empty className="max-w-md border border-dashed bg-muted/20">
        <EmptyHeader>
          <EmptyMedia variant="icon">{icon}</EmptyMedia>
          <EmptyTitle>{titleText ?? t("settings.noRecords", { title })}</EmptyTitle>
          <EmptyDescription>{description ?? t("empty.adjustSearch")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}

export function SettingsRowActions<T>({
  actions,
  deleteDisabled,
  editDisabled,
  onDelete,
  onEdit,
  row
}: {
  actions?: SettingsRowAction<T>[];
  deleteDisabled?: boolean;
  editDisabled?: boolean;
  onDelete?: (row: T) => void;
  onEdit?: (row: T) => void;
  row: T;
}) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={t("common.actions")} size="icon-sm" type="button" variant="ghost">
          <Menu />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          {onEdit ? (
            <DropdownMenuItem disabled={editDisabled} onSelect={() => onEdit(row)}>
              <Pencil />
              {t("actions.edit")}
            </DropdownMenuItem>
          ) : null}
          {actions?.map((action) => (
            <DropdownMenuItem
              key={action.label}
              disabled={action.disabled}
              variant={action.destructive ? "destructive" : "default"}
              onSelect={() => action.onSelect(row)}
            >
              {action.icon}
              {action.label}
            </DropdownMenuItem>
          ))}
          {onDelete ? (
            <DropdownMenuItem disabled={deleteDisabled} variant="destructive" onSelect={() => onDelete(row)}>
              <Trash2 />
              {t("actions.delete")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
