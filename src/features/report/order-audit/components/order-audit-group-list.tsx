"use client";

import { History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OrderAuditGroup } from "../order-audit-grouping";
import { dominantAuditAction, groupEntityLabelsPreview } from "../order-audit-grouping";
import { auditDateTime } from "../order-audit-utils";
import { OrderAuditActionBadge } from "./order-audit-action-badge";

interface OrderAuditGroupListPanelProps {
  eventCount: number;
  groups: OrderAuditGroup[];
  language: string;
  loading: boolean;
  onPageChange: (page: number) => void;
  onSelect: (groupId: string) => void;
  page: number;
  rangeLabel: string;
  selectedGroupId: string;
  totalPages: number;
}

export function OrderAuditGroupListPanel({
  eventCount,
  groups,
  language,
  loading,
  onPageChange,
  onSelect,
  page,
  rangeLabel,
  selectedGroupId,
  totalPages,
}: OrderAuditGroupListPanelProps) {
  const { t } = useTranslation();

  return (
    <Card className="flex min-h-0 flex-col overflow-hidden rounded-none border-x-0 border-b-0 border-border bg-card py-0 shadow-none xl:min-h-0 xl:border-r">
      <CardHeader className="shrink-0 border-b border-border bg-card px-3 py-2.5">
        <div className="flex w-full min-w-0 items-center justify-between gap-3">
          <CardTitle className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
            <History className="size-4 shrink-0 text-primary" />
            <span className="truncate">{t("orderAudit.eventList")}</span>
          </CardTitle>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {t("orderAudit.eventCount", { count: eventCount })}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {loading && !groups.length ? null : groups.length ? (
          <>
            <div
              aria-busy={loading}
              className="flex min-h-0 flex-1 flex-col divide-y divide-border overflow-y-auto overscroll-contain"
            >
              {groups.map((group) => (
                <OrderAuditGroupListItem
                  key={group.id}
                  group={group}
                  language={language}
                  selected={group.id === selectedGroupId}
                  onSelect={() => onSelect(group.id)}
                />
              ))}
            </div>
            <div className="shrink-0 border-t border-border bg-muted/20 px-3 py-2.5 pb-[calc(0.625rem+var(--pos-system-bottom-safe-area,0px))] text-sm text-muted-foreground sm:px-4 sm:py-3">
              <AppPagination disabled={loading} page={page} rangeLabel={rangeLabel} totalPages={totalPages} onPageChange={onPageChange} />
            </div>
          </>
        ) : (
          <div className="flex min-h-80 items-center justify-center p-4">
            <EmptyState title={t("orderAudit.empty")} description={t("orderAudit.emptyDescription")} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OrderAuditGroupListItem({
  group,
  language,
  onSelect,
  selected,
}: {
  group: OrderAuditGroup;
  language: string;
  onSelect: () => void;
  selected: boolean;
}) {
  const { t } = useTranslation();
  const action = dominantAuditAction(group.actions);
  const entityPreview = groupEntityLabelsPreview(group, language);

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "relative h-auto w-full shrink-0 touch-manipulation flex-col items-stretch justify-start gap-1 overflow-hidden rounded-none px-3 py-2.5 text-left shadow-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
        "hover:bg-muted/60",
        selected && "bg-primary/10 hover:bg-primary/10",
      )}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {selected ? <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-primary" /> : null}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <OrderAuditActionBadge action={action} label={t(`orderAudit.actions.${action}`)} />
        <time dateTime={group.recordedAt} className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {auditDateTime(group.recordedAt, language)}
        </time>
      </div>

      <p className="min-w-0 truncate text-sm font-semibold leading-6 text-foreground">
        {group.relatedOrderUuid ? (
          <span className="text-muted-foreground">{group.relatedOrderInvoice || group.relatedOrderUuid} → </span>
        ) : null}
        {group.orderInvoice || group.orderUuid}
      </p>

      <p className="truncate text-xs leading-5 text-muted-foreground">
        {group.actorName || t(`orderAudit.actorTypes.${group.actorType}`)}
      </p>

      <p className="min-w-0 truncate text-xs leading-5 text-muted-foreground">
        {t("orderAudit.entitiesChanged", { count: group.entityCount })}
        {entityPreview ? ` · ${entityPreview}` : ""}
      </p>
    </Button>
  );
}
