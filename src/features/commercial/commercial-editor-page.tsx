"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CommercialAccessGate, CommercialLoading } from "@/features/commercial/commercial-access";
import { CommercialDocumentEditor } from "@/features/commercial/commercial-document-editor";
import { CommercialDocumentOutput } from "@/features/commercial/commercial-document-output";
import { CommercialRevisions } from "@/features/commercial/commercial-revisions";
import { commercialDocumentType, commercialHistoryHref, commercialRequestedScopeMatches } from "@/features/commercial/commercial-routes";
import { useCommercialRouteScope } from "@/features/commercial/use-commercial-route-scope";
import { useCommercialRouteSession } from "@/features/commercial/use-commercial-route-session";
import { useCommercialLabels } from "@/features/commercial/commercial.locale";
import { internalRoute } from "@/lib/routes";
import { useCommercialStore } from "@/stores/commercial-store";

export function CommercialEditorPage() {
  return <Suspense fallback={<CommercialLoading />}><CommercialAccessGate><CommercialEditorWorkspace /></CommercialAccessGate></Suspense>;
}

function CommercialEditorWorkspace() {
  const l = useCommercialLabels();
  const router = useRouter();
  const params = useSearchParams();
  const pathParams = useParams();
  const documentUuid = typeof pathParams.documentUuid === "string" ? pathParams.documentUuid : "";
  const requestedStore = params.get("store_uuid") || undefined;
  const requestedBranch = params.get("branch_uuid") || undefined;
  const ready = useCommercialRouteScope(requestedStore, requestedBranch);
  useCommercialRouteSession(JSON.stringify(["editor", documentUuid, documentUuid ? null : params.get("type"), requestedStore, requestedBranch]));
  const { storeUuid, branchUuid, optionsError, error, loading, editingDocument, editorGeneration, selectedDocument, revisionDocumentUuid, loadCatalog, beginEdit, closeDocument, initialize } = useCommercialStore();
  const [preparedEdit, setPreparedEdit] = useState("");
  const [leaving, setLeaving] = useState(false);
  const requestKey = JSON.stringify([documentUuid, storeUuid, branchUuid]);
  const scopeMatches = commercialRequestedScopeMatches({ storeUuid: requestedStore, branchUuid: requestedBranch }, { storeUuid, branchUuid });
  const type = documentUuid && editingDocument?.document_uuid === documentUuid ? editingDocument.document_type : commercialDocumentType(params.get("type"));
  const tab = type === "receipt" ? "receipts" : "quotations";
  const backHref = commercialHistoryHref({ storeUuid, branchUuid }, tab);

  useEffect(() => {
    if (!ready || !scopeMatches || !branchUuid || optionsError) return;
    let active = true;
    const catalog = useCommercialStore.getState();
    if (!catalog.catalogReady && !catalog.catalogLoading) void loadCatalog().catch(() => {});
    if (documentUuid) void beginEdit(documentUuid).then(() => { if (active) setPreparedEdit(requestKey); }).catch(() => { if (active) setPreparedEdit(requestKey); });
    return () => { active = false; };
  }, [ready, scopeMatches, branchUuid, optionsError, documentUuid, requestKey, loadCatalog, beginEdit]);

  if (!ready || leaving) return <CommercialLoading />;
  if (optionsError || !branchUuid || !scopeMatches) return <div className="grid gap-4 p-4 font-lao"><Alert variant="destructive"><AlertTitle>{l("error")}</AlertTitle><AlertDescription>{optionsError || l("routeScopeUnavailable")}</AlertDescription></Alert><Button asChild variant="outline" className="min-h-11 w-fit"><Link href={internalRoute(backHref)}>{l("backToDocuments")}</Link></Button>{optionsError ? <Button className="min-h-11 w-fit" onClick={() => { void initialize({ storeUuid: requestedStore, branchUuid: requestedBranch }).catch(() => {}); }}>{l("retry")}</Button> : null}</div>;
  if (documentUuid && preparedEdit !== requestKey) return <CommercialLoading />;
  if (documentUuid && editingDocument?.document_uuid !== documentUuid) return <div className="grid gap-4 p-4 font-lao">{loading ? <CommercialLoading /> : <><Alert variant="destructive"><AlertDescription>{error || l("documentUnavailable")}</AlertDescription></Alert><Button variant="outline" className="min-h-11 w-fit" onClick={() => { void beginEdit(documentUuid).catch(() => {}); }}>{l("retry")}</Button></>}<Button asChild variant="outline" className="min-h-11 w-fit"><Link href={internalRoute(backHref)}>{l("backToDocuments")}</Link></Button></div>;
  return <>
    <CommercialDocumentEditor key={documentUuid ? `${documentUuid}:${editorGeneration}` : `${type}:${branchUuid}`} branchUuid={branchUuid} documentType={type} existing={documentUuid ? editingDocument ?? undefined : undefined} backHref={backHref} onSaved={(document) => { setLeaving(true); router.replace(internalRoute(commercialHistoryHref({ storeUuid, branchUuid }, document.document_type === "receipt" ? "receipts" : "quotations", document.document_uuid))); }} />
    {selectedDocument ? <CommercialDocumentOutput document={selectedDocument} onClose={closeDocument} /> : null}
    {revisionDocumentUuid ? <CommercialRevisions /> : null}
  </>;
}
