"use client";

import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from "@/components/ui/item";
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

// แผงรายการเหตุการณ์ (ซ้าย) — หัวแผง / รายการที่สกรอลได้ / แบ่งหน้า
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
    <section className="flex min-h-0 flex-1 flex-col xl:border-r">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b p-3">
        <h3 className="font-medium">{t("orderAudit.eventList")}</h3>
        <Badge variant="secondary">{t("orderAudit.eventCount", { count: eventCount })}</Badge>
      </div>

      {loading && !groups.length ? null : groups.length ? (
        <>
          <div aria-busy={loading} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            <ItemGroup className="gap-1">
              {groups.map((group) => (
                <OrderAuditGroupListItem
                  key={group.id}
                  group={group}
                  language={language}
                  selected={group.id === selectedGroupId}
                  onSelect={() => onSelect(group.id)}
                />
              ))}
            </ItemGroup>
          </div>
          <div className="shrink-0 border-t p-3 pb-[calc(0.75rem+var(--pos-system-bottom-safe-area,0px))]">
            <AppPagination disabled={loading} page={page} rangeLabel={rangeLabel} totalPages={totalPages} onPageChange={onPageChange} />
          </div>
        </>
      ) : (
        <div className="p-3">
          <EmptyState title={t("orderAudit.empty")} description={t("orderAudit.emptyDescription")} />
        </div>
      )}
    </section>
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
    <Item
      asChild
      size="sm"
      // รายการที่เลือกอยู่ใช้พื้นสีธีมจาง — Item ปกติไม่มีสถานะ "เลือกอยู่" ให้
      className={cn("cursor-pointer text-left hover:bg-muted", selected && "bg-primary/10 hover:bg-primary/10")}
    >
      <button type="button" aria-pressed={selected} onClick={onSelect}>
        <ItemHeader>
          <OrderAuditActionBadge action={action} label={t(`orderAudit.actions.${action}`)} />
          <time dateTime={group.recordedAt} className="tabular-nums text-muted-foreground">
            {auditDateTime(group.recordedAt)}
          </time>
        </ItemHeader>
        <ItemContent>
          <ItemTitle>
            {group.relatedOrderUuid ? (
              <span className="text-muted-foreground">{group.relatedOrderInvoice || group.relatedOrderUuid} →</span>
            ) : null}
            {group.orderInvoice || group.orderUuid}
          </ItemTitle>
          <ItemDescription>
            {group.actorName || t(`orderAudit.actorTypes.${group.actorType}`)} ·{" "}
            {t("orderAudit.entitiesChanged", { count: group.entityCount })}
            {entityPreview ? ` · ${entityPreview}` : ""}
          </ItemDescription>
        </ItemContent>
      </button>
    </Item>
  );
}
