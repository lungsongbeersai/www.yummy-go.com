"use client";

import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { CommercialDocumentOutput } from "@/features/commercial/commercial-document-output";
import { formatCommercialMoney } from "@/features/commercial/commercial-domain";
import { useCommercialLabels } from "@/features/commercial/commercial.locale";
import { useCommercialStore } from "@/stores/commercial-store";

export function CommercialRevisions() {
  const [opener] = useState(() => typeof window !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const l = useCommercialLabels();
  const { revisionDocumentUuid, revisions, revisionsLoading, revisionsError, openRevisions, closeRevisions, revisionSnapshot: snapshot, revisionSnapshotLoading, openRevision, closeRevision } = useCommercialStore();
  if (!revisionDocumentUuid) return null;
  return <><Dialog open onOpenChange={(open) => { if (!open) closeRevisions(); }}><DialogContent className="flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col overflow-hidden font-lao sm:max-w-2xl" onCloseAutoFocus={(event) => { event.preventDefault(); if (opener?.isConnected && opener.getClientRects().length) opener.focus({ preventScroll: true }); }}><DialogHeader className="shrink-0"><DialogTitle>{l("revisionHistory")}</DialogTitle><DialogDescription>{l("revisionHistoryHint")}</DialogDescription></DialogHeader>
    <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain">
    {revisionsError ? <Alert variant="destructive"><AlertDescription>{revisionsError}<Button variant="outline" className="min-h-11" disabled={revisionsLoading} onClick={() => { void openRevisions(revisionDocumentUuid).catch(() => {}); }}>{l("retry")}</Button></AlertDescription></Alert> : null}
    {revisionsLoading ? <div className="grid gap-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-24" />)}</div> : revisions.length ? <div className="grid gap-3">{[...revisions].sort((left, right) => right.version - left.version).map((revision) => <Card key={revision.version}><CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-semibold">{revision.snapshot.number} · {l("version")} {revision.version}</p><p className="break-words text-xs text-muted-foreground">{new Date(revision.changed_at).toLocaleString()}</p><p className="font-semibold tabular-nums">{formatCommercialMoney(revision.snapshot.total)} {l("lak")}</p></div><Button variant="outline" className="min-h-11" disabled={revisionSnapshotLoading} onClick={() => { void openRevision(revision.version).catch(() => {}); }}>{l("viewRevision")}</Button></CardContent></Card>)}</div> : !revisionsError ? <Empty className="min-h-40 border"><EmptyHeader><EmptyTitle>{l("noRevisions")}</EmptyTitle></EmptyHeader></Empty> : null}
    </div>
  </DialogContent></Dialog>{snapshot ? <CommercialDocumentOutput document={snapshot} readOnly onClose={closeRevision} /> : null}</>;
}
