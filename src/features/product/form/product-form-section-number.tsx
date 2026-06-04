export function ProductFormSectionNumber({ value }: { value: string }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-muted text-sm font-black text-muted-foreground">
      {value}
    </span>
  );
}
