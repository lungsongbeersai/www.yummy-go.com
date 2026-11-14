"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { menuGrantsPath } from "@/components/layout/shell-menu-helpers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommercialCatalog } from "@/features/commercial/commercial-catalog";
import { CommercialDocumentEditor } from "@/features/commercial/commercial-document-editor";
import { CommercialDocumentOutput } from "@/features/commercial/commercial-document-output";
import { CommercialHistory } from "@/features/commercial/commercial-history";
import { useCommercialLabels } from "@/features/commercial/commercial.locale";
import { useSidebarPermissionAccess } from "@/hooks/use-sidebar-permission-access";
import { canViewBranchSettings } from "@/lib/permissions";
import type { CommercialDocumentType } from "@/services/commercial";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useCommercialStore } from "@/stores/commercial-store";
import { usePermissionsSidebarStore } from "@/stores/permissions-sidebar-store";

export function CommercialPage() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const l = useCommercialLabels();
  const { i18n } = useTranslation();
  const { keyMatches, loading: permissionLoading, menuItems } = useSidebarPermissionAccess();
  const permissionError = usePermissionsSidebarStore((state) => state.error);
  const loadPermission = usePermissionsSidebarStore((state) => state.load);
  if (!canViewBranchSettings(user?.status)) return <Alert className="m-4 font-lao" variant="destructive"><AlertDescription>{l("noPermission")}</AlertDescription></Alert>;
  if (permissionLoading) return <div className="grid gap-4 p-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-48 w-full" /></div>;
  if (keyMatches && permissionError) return <Alert className="m-4 font-lao" variant="destructive"><AlertTitle>{l("error")}</AlertTitle><AlertDescription><p>{permissionError}</p><Button variant="outline" className="min-h-11" onClick={() => { if (user) void loadPermission(authStoreUuid(user), user.status, i18n.language); }}>{l("retry")}</Button></AlertDescription></Alert>;
  if (!keyMatches || !menuGrantsPath(menuItems, "/commercial")) return <Alert className="m-4 font-lao" variant="destructive"><AlertDescription>{l("noPermission")}</AlertDescription></Alert>;
  return <CommercialWorkspace key={`${token}:${user?.uuid}:${user?.status}:${authStoreUuid(user)}:${user?.branch_uuid}`} />;
}

function CommercialWorkspace() {
  const l = useCommercialLabels();
  const { stores, branches, storeUuid, branchUuid, canSelectStore, optionsLoading, optionsError, error, loading, selectedDocument, initialize, selectStore, selectBranch, loadCatalog, loadDocuments, closeDocument, clearError, reset } = useCommercialStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    void initialize({ storeUuid: params.get("store_uuid") || undefined, branchUuid: params.get("branch_uuid") || undefined }).catch(() => {});
    return reset;
  }, [initialize, reset]);

  useEffect(() => {
    if (!branchUuid) return;
    const requests = [loadDocuments()];
    const catalog = useCommercialStore.getState();
    if (!catalog.catalogReady && !catalog.catalogLoading) requests.push(loadCatalog());
    void Promise.allSettled(requests);
  }, [branchUuid, loadCatalog, loadDocuments]);

  const initialLoading = optionsLoading || (!stores.length && !optionsError);

  return <div className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto bg-background font-lao">
    <header className="grid shrink-0 gap-4 border-b bg-card p-4 sm:p-5"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><FileText className="size-5" /></span><div className="min-w-0"><h1 className="font-heading text-lg font-semibold sm:text-xl">{l("title")}</h1><p className="mt-1 text-xs text-muted-foreground sm:text-sm">{l("subtitle")}</p></div></div><div className="grid grid-cols-1 gap-3 sm:max-w-2xl sm:grid-cols-2">{canSelectStore ? <Field><FieldLabel htmlFor="commercial-store">{l("documentStore")}</FieldLabel><Select value={storeUuid} disabled={optionsLoading} onValueChange={(value) => { void selectStore(value).catch(() => {}); }}><SelectTrigger id="commercial-store" className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent>{stores.map((store) => <SelectItem key={store.store_uuid} value={store.store_uuid} className="min-h-11">{store.store_name_la || store.store_name_eng || store.store_uuid}</SelectItem>)}</SelectContent></Select></Field> : null}<Field><FieldLabel htmlFor="commercial-branch">{l("documentBranch")}</FieldLabel><Select value={branchUuid} disabled={optionsLoading || !branches.length} onValueChange={selectBranch}><SelectTrigger id="commercial-branch" className="h-11 w-full"><SelectValue placeholder={l("selectBranch")} /></SelectTrigger><SelectContent>{branches.map((row) => <SelectItem key={row.branch_uuid} value={row.branch_uuid} className="min-h-11">{row.branch_name || row.branch_name_la || row.branch_name_eng || row.branch_uuid}</SelectItem>)}</SelectContent></Select></Field></div><p className="text-xs text-muted-foreground">{l("documentScopeHint")}</p></header>
    <div className="grid min-w-0 gap-4 p-3 pb-24 sm:p-5 sm:pb-24">
      {optionsError ? <Alert variant="destructive"><AlertTitle>{l("error")}</AlertTitle><AlertDescription><p>{optionsError}</p><Button variant="outline" className="min-h-11" onClick={() => { void initialize({ storeUuid, branchUuid }).catch(() => {}); }}>{l("retry")}</Button></AlertDescription></Alert> : null}
      {error ? <Alert variant="destructive"><AlertTitle>{l("error")}</AlertTitle><AlertDescription><p>{error}</p><Button variant="outline" onClick={clearError}>{l("close")}</Button></AlertDescription></Alert> : null}
      {initialLoading ? <div className="grid gap-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-48 w-full" /></div> : branchUuid ? <CommercialBranchWorkspace key={branchUuid} branchUuid={branchUuid} /> : !optionsError ? <Empty className="min-h-64 border"><EmptyHeader><EmptyTitle>{l("noBranches")}</EmptyTitle></EmptyHeader></Empty> : null}
    </div>
    {loading ? <div role="status" aria-label={l("viewDocument")} className="fixed right-4 bottom-24 z-40 rounded-md border bg-card p-3 shadow-lg"><Skeleton className="h-6 w-32" /></div> : null}
    {selectedDocument ? <CommercialDocumentOutput document={selectedDocument} onClose={closeDocument} /> : null}
  </div>;
}

interface CommercialBranchWorkspaceProps { branchUuid: string }

function CommercialBranchWorkspace({ branchUuid }: CommercialBranchWorkspaceProps) {
  const l = useCommercialLabels();
  const clearError = useCommercialStore((state) => state.clearError);
  const [editor, setEditor] = useState<CommercialDocumentType | null>(null);
  function create(type: CommercialDocumentType) { clearError(); setEditor(type); }
  return <><Tabs defaultValue="catalog" className="min-w-0 gap-5"><TabsList className="grid min-h-12 w-full grid-cols-3 sm:w-fit"><TabsTrigger className="min-h-11 px-2 sm:px-4" value="catalog">{l("catalog")}</TabsTrigger><TabsTrigger className="min-h-11 px-2 sm:px-4" value="quotations">{l("quotations")}</TabsTrigger><TabsTrigger className="min-h-11 px-2 sm:px-4" value="receipts">{l("receipts")}</TabsTrigger></TabsList><TabsContent value="catalog"><CommercialCatalog branchUuid={branchUuid} /></TabsContent><TabsContent value="quotations"><CommercialHistory documentType="quotation" onCreate={() => create("quotation")} /></TabsContent><TabsContent value="receipts"><CommercialHistory documentType="receipt" onCreate={() => create("receipt")} /></TabsContent></Tabs>{editor ? <CommercialDocumentEditor branchUuid={branchUuid} documentType={editor} onClose={() => setEditor(null)} /> : null}</>;
}
