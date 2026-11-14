"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageIcon, Plus, Printer, RefreshCw, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CommercialCatalogOutput } from "@/features/commercial/commercial-document-output";
import { formatCommercialMoney, PLC_EXAMPLES, PLC_ISSUER } from "@/features/commercial/commercial-domain";
import { CommercialItemEditor, type CommercialItemSeed } from "@/features/commercial/commercial-item-editor";
import { useCommercialLabels } from "@/features/commercial/commercial.locale";
import type { CatalogItem } from "@/services/commercial";
import { useCommercialStore } from "@/stores/commercial-store";

interface CommercialCatalogProps { branchUuid: string; branchName: string }

export function CommercialCatalog({ branchUuid, branchName }: CommercialCatalogProps) {
  const l = useCommercialLabels();
  const catalog = useCommercialStore((state) => state.catalog);
  const loading = useCommercialStore((state) => state.catalogLoading);
  const error = useCommercialStore((state) => state.catalogError);
  const saving = useCommercialStore((state) => state.saving);
  const load = useCommercialStore((state) => state.loadCatalog);
  const clearError = useCommercialStore((state) => state.clearError);
  const [search, setSearch] = useState("");
  const [showImages, setShowImages] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editor, setEditor] = useState<{ item?: CatalogItem; seed?: CommercialItemSeed } | null>(null);
  const [output, setOutput] = useState(false);
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const rows = catalog.filter((item) => (includeInactive || item.active) && `${item.name} ${item.description}`.toLocaleLowerCase().includes(normalizedSearch));

  function edit(item?: CatalogItem, seed?: CommercialItemSeed) { clearError(); setEditor({ item, seed }); }

  return (
    <section className="grid min-w-0 gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 sm:max-w-sm sm:flex-1"><Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" /><Input className="h-11 pl-9" aria-label={l("search")} placeholder={l("search")} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" onClick={() => { void load().catch(() => {}); }} disabled={loading || saving}><RefreshCw />{l("refresh")}</Button><Button variant="outline" className="min-h-11" disabled={!rows.length || loading || Boolean(error)} onClick={() => setOutput(true)}><Printer />{l("catalogOutput")}</Button><Button className="min-h-11" onClick={() => edit()} disabled={saving}><Plus />{l("addItem")}</Button></div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-3"><Switch checked={showImages} onCheckedChange={setShowImages} /><span>{l("showImages")}</span></label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3"><Switch checked={includeInactive} onCheckedChange={setIncludeInactive} /><span>{l("showInactive")}</span></label>
        <Select value="" onValueChange={(value) => { const sample = PLC_EXAMPLES[Number(value)]; if (sample) edit(undefined, sample); }} disabled={saving}>
          <SelectTrigger className="h-11 max-w-full"><SelectValue placeholder={l("sample")} /></SelectTrigger><SelectContent>{PLC_EXAMPLES.map((sample, index) => <SelectItem key={sample.name} value={String(index)} className="min-h-11"><span className="max-w-72 truncate">{sample.name}</span></SelectItem>)}</SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{l("sampleHint")}</p>
      </div>
      {error ? <Alert variant="destructive"><AlertDescription>{error}<Button variant="outline" onClick={() => { void load().catch(() => {}); }} disabled={loading}>{l("retry")}</Button></AlertDescription></Alert> : null}
      {loading ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-44 w-full rounded-lg" />)}</div> : rows.length ? (
        <div className="grid min-w-0 gap-4">
          <div className="hidden min-w-0 overflow-hidden rounded-lg border md:block"><Table><TableHeader><TableRow>{showImages ? <TableHead>{l("photo")}</TableHead> : null}<TableHead>{l("name")}</TableHead><TableHead>{l("unit")}</TableHead><TableHead className="text-right">{l("price")}</TableHead><TableHead>{l("active")}</TableHead><TableHead><span className="sr-only">{l("edit")}</span></TableHead></TableRow></TableHeader><TableBody>{rows.map((item) => <TableRow key={item.item_uuid}>{showImages ? <TableCell>{item.image_visible ? <div className="grid size-14 place-items-center overflow-hidden rounded-md border bg-muted">{item.image_url ? <Image src={item.image_url} alt={item.name} width={56} height={56} unoptimized className="size-full object-contain" /> : <ImageIcon className="size-5 text-muted-foreground" />}</div> : null}</TableCell> : null}<TableCell className="max-w-sm whitespace-normal"><p className="break-words font-medium">{item.name}</p><p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{item.description}</p></TableCell><TableCell>{item.unit}</TableCell><TableCell className="text-right font-semibold tabular-nums">{formatCommercialMoney(item.unit_price)}</TableCell><TableCell><Badge variant={item.active ? "default" : "secondary"}>{l(item.active ? "active" : "inactive")}</Badge></TableCell><TableCell><Button variant="outline" className="min-h-11" onClick={() => edit(item)} disabled={saving}>{l("edit")}</Button></TableCell></TableRow>)}</TableBody></Table></div>
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 md:hidden">
          {rows.map((item) => <Card key={item.item_uuid}><CardContent className="flex min-w-0 gap-4">
            {showImages && item.image_visible ? <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">{item.image_url ? <Image src={item.image_url} alt={item.name} width={80} height={80} unoptimized className="size-full object-contain" /> : <ImageIcon className="size-6 text-muted-foreground" aria-hidden="true" />}</div> : null}
            <div className="flex min-w-0 flex-1 flex-col gap-2"><div className="flex flex-wrap items-start gap-2"><h2 className="min-w-0 flex-1 break-words font-semibold">{item.name}</h2>{!item.active ? <Badge variant="secondary">{l("inactive")}</Badge> : null}</div><p className="line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{item.description}</p><p className="text-base font-semibold tabular-nums">{formatCommercialMoney(item.unit_price)} <span className="text-xs font-normal text-muted-foreground">{l("lak")}{item.unit ? ` / ${item.unit}` : ""}</span></p><Button variant="outline" className="mt-auto min-h-11 self-start" onClick={() => edit(item)} disabled={saving}>{l("edit")}</Button></div>
          </CardContent></Card>)}
          </div>
        </div>
      ) : !error ? <Empty className="min-h-64 border"><EmptyHeader><EmptyMedia variant="icon"><ImageIcon /></EmptyMedia><EmptyTitle>{l(catalog.length ? "noResults" : "emptyCatalog")}</EmptyTitle><EmptyDescription>{l("emptyCatalogHint")}</EmptyDescription></EmptyHeader><Button className="min-h-11" onClick={() => edit()}><Plus />{l("addItem")}</Button></Empty> : null}
      {editor ? <CommercialItemEditor branchUuid={branchUuid} item={editor.item} seed={editor.seed} onClose={() => setEditor(null)} /> : null}
      {output ? <CommercialCatalogOutput items={rows} showImages={showImages} branchName={branchName} issuer={PLC_ISSUER} onClose={() => setOutput(false)} /> : null}
    </section>
  );
}
