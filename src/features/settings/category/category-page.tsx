"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CategoryIcon, CategoryIconPicker } from "@/features/settings/category/category-icon-picker";
import {
  buildCategoryPayload,
  categoryId,
  categoryName,
  categoryValue,
  groupLabel,
  missingCategoryField,
  rowStoreUuid,
  type GroupOption
} from "@/features/settings/category/category-utils";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader,
  SettingsMobileCard,
  SettingsMobileList,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsModuleShell,
  SettingsPaginationFooter,
  SettingsRowActions,
  SettingsTableScroll,
  SettingsToolbar
} from "@/features/settings/shared/settings-shell";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import type { Category, FetchCategoriesParams } from "@/services/category";
import type { PageLimit, SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useCategoryStore } from "@/stores/category-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT: PageLimit = DEFAULT_PAGE_LIMIT;

function CategoryCodeBadge({ iconValue }: { iconValue: string }) {
  return (
    <Badge className="max-w-full border-primary/20 bg-primary/10 text-primary" translate="no">
      {iconValue || "-"}
    </Badge>
  );
}

function CategoryIdentity({ row }: { row: Category }) {
  const id = categoryId(row);
  const iconValue = categoryValue(row, "cate_icon");

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <CategoryIcon value={iconValue} />
      </span>
      <div className="min-w-0">
        <p className="truncate font-black">{categoryName(row)}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {categoryValue(row, "cate_name_la", "-")} / {categoryValue(row, "cate_name_eng", "-")}
        </p>
        {id ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground" translate="no">
            {id}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function CategorySettingsPage() {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const storeUuid = authStoreUuid(user);
  const showToast = useToastStore((state) => state.show);
  const storeRows = useCategoryStore((state) => state.rows);
  const total = useCategoryStore((state) => state.total);
  const storeTotalPages = useCategoryStore((state) => state.totalPages);
  const search = useCategoryStore((state) => state.search);
  const hasLoaded = useCategoryStore((state) => state.hasLoaded);
  const loading = useCategoryStore((state) => state.loading);
  const refreshing = useCategoryStore((state) => state.refreshing);
  const saving = useCategoryStore((state) => state.saving);
  const setSearch = useCategoryStore((state) => state.setSearch);
  const loadRows = useCategoryStore((state) => state.load);
  const saveRow = useCategoryStore((state) => state.save);
  const removeRow = useCategoryStore((state) => state.remove);
  const loadGroupOptions = useReferenceStore((state) => state.loadGroups);
  const sortCategoryRows = useReferenceStore((state) => state.sortCategoryRows);
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [limit, setLimit] = useState<PageLimit>(DEFAULT_LIMIT);
  const [orderBy, setOrderBy] = useState<SortOrder>("1");
  const [editing, setEditing] = useState<Category | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());
  const [displayRows, setDisplayRows] = useState<Category[]>([]);
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([]);

  const title = t("settings.modules.category.title");
  const description = t("settings.modules.category.description");
  const requestParams = useMemo<FetchCategoriesParams>(
    () => ({ search, page, limit, orderBy, lang: language, store_uuid_fk: storeUuid }),
    [language, limit, orderBy, page, search, storeUuid]
  );
  const orderedRows = displayRows.length === storeRows.length ? displayRows : storeRows;
  const pageSize = limit === "All" ? orderedRows.length || Number(DEFAULT_LIMIT) : Number(limit ?? DEFAULT_LIMIT);
  const totalPages = limit === "All" ? 1 : Math.max(1, Number(storeTotalPages || Math.ceil(total / pageSize) || 1));
  const allRowsLoaded = limit === "All" || totalPages === 1;
  const rows = allRowsLoaded ? orderedRows : storeRows;
  const groupOptionsStoreUuid = storeUuid || rowStoreUuid(storeRows);
  const dragEnabled = allRowsLoaded && rows.length > 1;
  const pageStart = rows.length ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = rows.length ? pageStart + rows.length - 1 : 0;
  const fullLoading = loading && !hasLoaded;
  const backgroundLoading = refreshing || (loading && hasLoaded);
  const pagingBusy = loading || refreshing;
  const canGoBack = page > 1 && !pagingBusy;
  const canGoNext = page < totalPages && !pagingBusy;
  const ids = useMemo(() => rows.map(categoryId).filter(Boolean), [rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selectedRows.has(id));
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function load() {
    try {
      await loadRows(requestParams, { background: hasLoaded });
    } catch (error) {
      showToast({
        title: t("settings.loadFailed", { title }),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  useEffect(() => {
    setDisplayRows(storeRows);
  }, [storeRows]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, page, limit, orderBy, storeUuid]);

  useEffect(() => {
    if (!groupOptionsStoreUuid) {
      setGroupOptions([]);
      return;
    }

    let active = true;
    loadGroupOptions(language, groupOptionsStoreUuid)
      .then((groups) => {
        if (!active) return;
        setGroupOptions(
          groups
            .map((group) => ({ label: groupLabel(group), value: categoryValue(group, "group_uuid") }))
            .filter((option) => option.value)
        );
      })
      .catch((error) => {
        showToast({
          title: t("settings.loadFailed", { title: t("settings.modules.group.title") }),
          description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
          tone: "error"
        });
      });

    return () => {
      active = false;
    };
  }, [groupOptionsStoreUuid, language, loadGroupOptions, showToast, t]);

  useEffect(() => {
    setSelectedRows((current) => {
      if (!current.size) return current;
      const allowed = new Set(ids);
      let changed = false;
      const next = new Set<string>();
      current.forEach((id) => {
        if (allowed.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : current;
    });
  }, [ids]);

  function applyFilters() {
    if (page === 1) void load();
    else setPage(1);
  }

  function toggleSelected(id: string, checked: boolean) {
    if (!id) return;
    setSelectedRows((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedRows(checked ? new Set(ids) : new Set());
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: Category) {
    setEditing(row);
    setDialogOpen(true);
  }

  function missingFieldDescription(field: ReturnType<typeof missingCategoryField>) {
    if (field === "store") return t("settings.storeRequired");
    if (field === "group") return t("settings.categoryGroupRequired");
    if (field === "name") return t("settings.categoryNameRequired");
    if (field === "icon") return t("settings.categoryIconRequired");
    return t("toasts.pleaseTryAgain");
  }

  async function save(formData: FormData) {
    const groupUuid = String(formData.get("group_uuid_fk") ?? "").trim();
    const nameLa = String(formData.get("cate_name_la") ?? "").trim();
    const nameEng = String(formData.get("cate_name_eng") ?? "").trim();
    const icon = String(formData.get("cate_icon") ?? "").trim();
    const missing = missingCategoryField({ storeUuid, groupUuid, nameLa, icon });

    if (missing) {
      showToast({ title: t("settings.saveFailed"), description: missingFieldDescription(missing), tone: "error" });
      return;
    }

    try {
      await saveRow(buildCategoryPayload({ editing, storeUuid, groupUuid, nameLa, nameEng, icon }));
      showToast({ title: t("settings.saved"), tone: "success" });
      setDialogOpen(false);
      setEditing(null);
      await loadRows(requestParams, { background: true });
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function remove(row: Category) {
    const id = categoryId(row);
    if (!id) return;

    try {
      await removeRow(id);
      showToast({ title: t("settings.deleted"), tone: "success" });
      setDeleteTarget(null);
      setSelectedRows((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      await loadRows(requestParams, { background: true });
    } catch (error) {
      showToast({
        title: t("settings.deleteFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function persistOrder(nextRows: Category[]) {
    const previousRows = rows;
    const sortStoreUuid = storeUuid || rowStoreUuid(nextRows);
    if (!sortStoreUuid) {
      showToast({
        title: t("category.sortFailed"),
        description: t("settings.storeRequired"),
        tone: "error"
      });
      return;
    }

    setDisplayRows(nextRows);
    try {
      await sortCategoryRows({
        store_uuid_fk: sortStoreUuid,
        items: nextRows
          .map((row, index) => ({ cate_uuid: categoryId(row), cate_sort: index + 1 }))
          .filter((item) => item.cate_uuid)
      });
      showToast({ title: t("category.sorted"), tone: "success" });
      await loadRows(requestParams, { background: true });
    } catch (error) {
      setDisplayRows(previousRows);
      showToast({
        title: t("category.sortFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!dragEnabled) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex((row) => categoryId(row) === String(active.id));
    const newIndex = rows.findIndex((row) => categoryId(row) === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    void persistOrder(arrayMove(rows, oldIndex, newIndex));
  }

  const tableBody = (
    <TableBody>
      {rows.map((row, index) => {
        const id = categoryId(row);
        const selected = selectedRows.has(id);
        const iconValue = categoryValue(row, "cate_icon");
        const name = categoryName(row);
        const cells = (
          <>
            <TableCell className="w-10 px-2">
              <Checkbox aria-label={t("common.selectRow", { name })} checked={selected} onChange={(event) => toggleSelected(id, event.target.checked)} />
            </TableCell>
            <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black tabular-nums text-muted-foreground">{pageStart + index}</TableCell>
            <TableCell className="max-w-[30rem]">
              <CategoryIdentity row={row} />
            </TableCell>
            <TableCell className="max-w-[18rem] text-muted-foreground">
              <span className="block truncate">{groupLabel(row)}</span>
            </TableCell>
            <TableCell className="max-w-[14rem]">
              <CategoryCodeBadge iconValue={iconValue} />
            </TableCell>
            <TableCell className="text-right">
              <SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />
            </TableCell>
          </>
        );

        if (!dragEnabled) {
          return (
            <TableRow key={id || index} className="h-14" data-state={selected ? "selected" : undefined}>
              {cells}
            </TableRow>
          );
        }

        return (
          <SortableCategoryRow key={id || index} id={id} selected={selected}>
            {cells}
          </SortableCategoryRow>
        );
      })}
    </TableBody>
  );

  const tableElement = (
    <Table className="min-w-[980px]">
      <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
        <TableRow>
          {dragEnabled ? <TableHead className="w-10 px-2" aria-hidden /> : null}
          <TableHead className="w-10 px-2">
            <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
          </TableHead>
          <TableHead className="w-px whitespace-nowrap px-2 text-center">{t("fields.no")}</TableHead>
          <TableHead>{t("nav.category")}</TableHead>
          <TableHead>{t("nav.food_group")}</TableHead>
          <TableHead>{t("fields.icon")}</TableHead>
          <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      {dragEnabled ? (
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {tableBody}
        </SortableContext>
      ) : (
        tableBody
      )}
    </Table>
  );

  const table = rows.length ? (
    <SettingsTableScroll>
      {dragEnabled ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
          {tableElement}
        </DndContext>
      ) : (
        tableElement
      )}
    </SettingsTableScroll>
  ) : null;

  const mobileList = rows.length ? (
    <SettingsMobileList>
      {rows.map((row, index) => {
        const id = categoryId(row);
        const name = categoryName(row);
        const selected = selectedRows.has(id);
        const iconValue = categoryValue(row, "cate_icon");
        return (
          <SettingsMobileCard
            key={id || index}
            actions={<SettingsRowActions row={row} onEdit={openEdit} onDelete={setDeleteTarget} />}
            badges={<Badge className="shrink-0 tabular-nums">{pageStart + index}</Badge>}
            checked={selected}
            leading={
              <span className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
                <CategoryIcon value={iconValue} />
              </span>
            }
            selectLabel={t("common.selectRow", { name })}
            selected={selected}
            subtitle={
              id ? (
                <span className="block truncate" translate="no">
                  {id}
                </span>
              ) : undefined
            }
            title={name}
            onCheckedChange={(checked) => toggleSelected(id, checked)}
          >
            <SettingsMobileMetaGrid>
              <SettingsMobileMeta label={t("fields.nameLa")} value={categoryValue(row, "cate_name_la", "-")} />
              <SettingsMobileMeta label={t("fields.nameEn")} value={categoryValue(row, "cate_name_eng", "-")} />
              <SettingsMobileMeta label={t("nav.food_group")} value={groupLabel(row)} />
              <SettingsMobileMeta label={t("fields.icon")} value={<CategoryCodeBadge iconValue={iconValue} />} />
            </SettingsMobileMetaGrid>
          </SettingsMobileCard>
        );
      })}
    </SettingsMobileList>
  ) : null;

  const toolbar = (
    <SettingsToolbar
      state={{
        search,
        limit,
        orderBy,
        limitOptions: PAGE_LIMIT_OPTIONS,
        orderOptions: [
          { label: t("common.asc"), value: "1" },
          { label: t("common.desc"), value: "-1" }
        ],
        selectedCount: selectedRows.size,
        onApply: applyFilters,
        onLimit: (nextLimit) => {
          setLimit(nextLimit);
          setPage(1);
        },
        onOrder: (nextOrder) => {
          setOrderBy(nextOrder);
          setPage(1);
        },
        onSearch: setSearch
      }}
    />
  );

  const listSurface = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-card/95 px-3 py-2.5 backdrop-blur sm:px-4 lg:px-5">
        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-black">{t("settings.categoryList")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("common.showingRange", { start: pageStart, end: pageEnd, total })} - {t("common.page", { current: page, total: totalPages })}
            </p>
          </div>
          <div className="min-w-0 xl:max-w-[48rem]">{toolbar}</div>
        </div>
        {backgroundLoading ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner aria-hidden />
            {t("settings.refreshingCategoryList")}
          </div>
        ) : null}
      </div>
      {rows.length ? (
        <>
          <div className="hidden min-h-0 flex-1 md:flex">{table}</div>
          <div className="min-h-0 flex-1 overflow-y-auto md:hidden">{mobileList}</div>
        </>
      ) : (
        <div className="flex min-h-72 flex-1 items-center justify-center p-4">
          <Empty className="max-w-md border border-dashed bg-muted/20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CategoryIcon value="" />
              </EmptyMedia>
              <EmptyTitle>{t("settings.noRecords", { title: title.toLowerCase() })}</EmptyTitle>
              <EmptyDescription>{t("empty.adjustSearch")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}
    </div>
  );

  return (
    <>
      <SettingsModuleShell
        addLabel={`${t("actions.add")} ${t("nav.category")}`}
        cardTitle={t("settings.categoryList")}
        description={description}
        emptyDescription={t("empty.adjustSearch")}
        emptyTitle={t("settings.noRecords", { title: title.toLowerCase() })}
        footer={
          rows.length ? (
            <SettingsPaginationFooter
              canGoBack={canGoBack}
              canGoNext={canGoNext}
              page={page}
              pageEnd={pageEnd}
              pageStart={pageStart}
              total={total}
              totalPages={totalPages}
              onBack={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
            />
          ) : undefined
        }
        hideCardHeader
        loading={fullLoading}
        loadingLabel={t("settings.loading", { title })}
        table={listSurface}
        title={title}
        onAdd={openCreate}
      />
      <CategoryFormDialog
        editing={editing}
        groupOptions={groupOptions}
        open={dialogOpen}
        saving={saving}
        title={title}
        onOpenChange={(nextOpen) => {
          if (saving) return;
          setDialogOpen(nextOpen);
          if (!nextOpen) setEditing(null);
        }}
        onSubmit={save}
      />
      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        confirmPending={saving}
        description={t("settings.deleteConfirm")}
        open={Boolean(deleteTarget)}
        title={t("actions.delete")}
        onConfirm={() => {
          if (deleteTarget) void remove(deleteTarget);
        }}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteTarget(null);
        }}
      />
    </>
  );
}

function SortableCategoryRow({ children, id, selected }: { children: ReactNode; id: string; selected: boolean }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    position: "relative" as const
  };
  return (
    <TableRow ref={setNodeRef} style={style} data-state={selected ? "selected" : undefined} className={cn("h-14", isDragging && "shadow-md")}>
      <TableCell className="w-10 px-2">
        <Button aria-label={t("common.reorder")} size="iconSm" type="button" variant="ghost" {...attributes} {...listeners}>
          <GripVertical aria-hidden />
        </Button>
      </TableCell>
      {children}
    </TableRow>
  );
}

function CategoryFormDialog({
  editing,
  groupOptions,
  onOpenChange,
  onSubmit,
  open,
  saving,
  title
}: {
  editing: Category | null;
  groupOptions: GroupOption[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  open: boolean;
  saving: boolean;
  title: string;
}) {
  const { t } = useTranslation();
  const [groupUuid, setGroupUuid] = useState("");
  const [nameLa, setNameLa] = useState("");
  const [nameEng, setNameEng] = useState("");
  const formKey = categoryId(editing) || "new-category";
  const canSubmit = Boolean(groupUuid && nameLa.trim()) && !saving;

  useEffect(() => {
    setGroupUuid(categoryValue(editing, "group_uuid_fk"));
    setNameLa(categoryValue(editing, "cate_name_la", categoryValue(editing, "cate_name")));
    setNameEng(categoryValue(editing, "cate_name_eng"));
  }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent className="sm:max-w-5xl">
        <SettingsDialogForm key={formKey} action={onSubmit}>
          <SettingsDialogHeader>
            <DialogTitle>{editing ? t("settings.editRecord") : t("settings.newRecord")}: {title}</DialogTitle>
            <DialogDescription>{t("settings.categoryFormHint")}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            <FieldGroup>
              <input name="cate_uuid" type="hidden" value={categoryId(editing)} />
              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{t("settings.categoryDetails")}</FieldLegend>
                  <FieldDescription>{t("settings.categoryDetailsHint")}</FieldDescription>
                </Field>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="cate_name_la">{t("fields.nameLa")}</FieldLabel>
                    <Input
                      id="cate_name_la"
                      name="cate_name_la"
                      autoComplete="off"
                      disabled={saving}
                      required
                      value={nameLa}
                      onChange={(event) => setNameLa(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="cate_name_eng">{t("fields.nameEn")}</FieldLabel>
                    <Input
                      id="cate_name_eng"
                      name="cate_name_eng"
                      autoComplete="off"
                      disabled={saving}
                      value={nameEng}
                      onChange={(event) => setNameEng(event.target.value)}
                    />
                  </Field>
                </FieldGroup>
              </FieldSet>

              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{t("settings.categoryGroupSection")}</FieldLegend>
                  <FieldDescription>
                    {groupOptions.length ? t("settings.categoryGroupHint") : t("settings.categoryGroupRequired")}
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="group_uuid_fk">{t("nav.food_group")}</FieldLabel>
                  <input name="group_uuid_fk" type="hidden" value={groupUuid} />
                  <Select disabled={saving || !groupOptions.length} required value={groupUuid} onValueChange={setGroupUuid}>
                    <SelectTrigger id="group_uuid_fk" className="w-full">
                      <SelectValue placeholder={t("settings.selectGroup")} />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        {groupOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldSet>

              <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                <Field>
                  <FieldLegend>{t("settings.categoryIconSection")}</FieldLegend>
                  <FieldDescription>{t("settings.categoryIconHint")}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="cate_icon">{t("fields.icon")}</FieldLabel>
                  <CategoryIconPicker id="cate_icon" name="cate_icon" defaultValue={categoryValue(editing, "cate_icon")} disabled={saving} />
                </Field>
              </FieldSet>
            </FieldGroup>
          </SettingsDialogBody>
          <SettingsDialogFooter>
            <Button disabled={saving} type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("actions.cancel")}
            </Button>
            <Button disabled={!canSubmit} type="submit">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? t("common.processing") : t("actions.save")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}
