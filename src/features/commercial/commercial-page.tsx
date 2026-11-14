"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { CommercialAccessGate, CommercialLoading } from "@/features/commercial/commercial-access";
import { CommercialCatalog } from "@/features/commercial/commercial-catalog";
import { CommercialDocumentOutput } from "@/features/commercial/commercial-document-output";
import { CommercialHistory } from "@/features/commercial/commercial-history";
import { CommercialRevisions } from "@/features/commercial/commercial-revisions";
import { CommercialWorkflowTabs } from "@/features/commercial/commercial-workflow-tabs";
import { commercialHistoryHref, commercialRequestedScopeMatches, commercialTab } from "@/features/commercial/commercial-routes";
import { CommercialScopeFields } from "@/features/commercial/commercial-scope-fields";
import { useCommercialRouteScope } from "@/features/commercial/use-commercial-route-scope";
import { useCommercialRouteSession } from "@/features/commercial/use-commercial-route-session";
import { useCommercialLabels } from "@/features/commercial/commercial.locale";
import { internalRoute } from "@/lib/routes";
import { useCommercialStore } from "@/stores/commercial-store";

export function CommercialPage() {
  return <Suspense fallback={<CommercialLoading />}><CommercialAccessGate><CommercialWorkspace /></CommercialAccessGate></Suspense>;
}

function CommercialWorkspace() {
  const l = useCommercialLabels();
  const router = useRouter();
  const params = useSearchParams();
  const requestedStore = params.get("store_uuid") || undefined;
  const requestedBranch = params.get("branch_uuid") || undefined;
  const requestedDocument = params.get("document_uuid") || undefined;
  const tab = commercialTab(params.get("tab"));
  const ready = useCommercialRouteScope(requestedStore, requestedBranch);
  useCommercialRouteSession(JSON.stringify(["history", requestedStore, requestedBranch, tab, requestedDocument]));
  const { stores, storeUuid, branchUuid, optionsLoading, optionsError, error, loading, selectedDocument, revisionDocumentUuid, initialize, loadCatalog, loadDocuments, openDocument, closeDocument, clearError } = useCommercialStore();
  const canonicalScope = requestedStore === storeUuid && requestedBranch === branchUuid;

  useEffect(() => {
    if (!ready || optionsLoading || !branchUuid || canonicalScope) return;
    const matches = commercialRequestedScopeMatches({ storeUuid: requestedStore, branchUuid: requestedBranch }, { storeUuid, branchUuid });
    router.replace(internalRoute(commercialHistoryHref({ storeUuid, branchUuid }, tab, matches ? requestedDocument : undefined)), { scroll: false });
  }, [ready, optionsLoading, branchUuid, storeUuid, canonicalScope, requestedStore, requestedBranch, requestedDocument, tab, router]);

  useEffect(() => {
    if (!ready || !branchUuid) return;
    const requests = [loadDocuments()];
    const catalog = useCommercialStore.getState();
    if (!catalog.catalogReady && !catalog.catalogLoading) requests.push(loadCatalog());
    void Promise.allSettled(requests);
  }, [ready, branchUuid, loadCatalog, loadDocuments]);

  useEffect(() => {
    if (ready && canonicalScope && branchUuid && requestedDocument) void openDocument(requestedDocument).catch(() => {});
  }, [ready, canonicalScope, branchUuid, requestedDocument, openDocument]);

  const initialLoading = !ready || optionsLoading || (!stores.length && !optionsError);
  return <div className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto bg-background font-lao">
    <header className="grid shrink-0 gap-3 border-b border-border bg-card px-4 py-4 sm:px-5">
      <div className="min-w-0"><h1 className="font-heading text-lg font-semibold">{l("title")}</h1><p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{l("documentScopeHint")}</p></div>
      <CommercialScopeFields />
    </header>
    <div className="grid min-w-0 gap-4 p-3 pb-24 sm:px-5 sm:py-4 sm:pb-24">
      {optionsError ? <Alert variant="destructive"><AlertTitle>{l("error")}</AlertTitle><AlertDescription><p>{optionsError}</p><Button variant="outline" className="min-h-11" onClick={() => { void initialize({ storeUuid, branchUuid }).catch(() => {}); }}>{l("retry")}</Button></AlertDescription></Alert> : null}
      {error ? <Alert variant="destructive"><AlertTitle>{l("error")}</AlertTitle><AlertDescription><p>{error}</p><Button variant="outline" className="min-h-11" onClick={clearError}>{l("close")}</Button></AlertDescription></Alert> : null}
      {initialLoading ? <CommercialLoading /> : branchUuid ? <Tabs value={tab} onValueChange={(value) => router.replace(internalRoute(commercialHistoryHref({ storeUuid, branchUuid }, commercialTab(value))), { scroll: false })} className="min-w-0 gap-4"><CommercialWorkflowTabs value={tab} /><TabsContent value="catalog"><CommercialCatalog key={branchUuid} branchUuid={branchUuid} /></TabsContent><TabsContent value="quotations"><CommercialHistory documentType="quotation" /></TabsContent><TabsContent value="receipts"><CommercialHistory documentType="receipt" /></TabsContent></Tabs> : !optionsError ? <Empty className="min-h-64 border"><EmptyHeader><EmptyTitle>{l("noBranches")}</EmptyTitle></EmptyHeader></Empty> : null}
    </div>
    {loading ? <div role="status" aria-label={l("viewDocument")} className="fixed right-4 bottom-24 z-40 rounded-md border bg-card p-3 shadow-lg">{l("viewDocument")}</div> : null}
    {selectedDocument ? <CommercialDocumentOutput key={`${selectedDocument.document_uuid}:${selectedDocument.version}`} document={selectedDocument} onClose={() => { closeDocument(); router.replace(internalRoute(commercialHistoryHref({ storeUuid, branchUuid }, tab)), { scroll: false }); }} /> : null}
    {revisionDocumentUuid ? <CommercialRevisions /> : null}
  </div>;
}
