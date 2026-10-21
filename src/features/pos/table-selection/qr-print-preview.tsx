import Image from "next/image";
import { QrCode } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface QrPrintPreviewProps {
  caption: string;
  imageUrl: string | null;
  loading: boolean;
  title: string;
}

export function QrPrintPreview({ caption, imageUrl, loading, title }: QrPrintPreviewProps) {
  return (
    <div className="flex justify-center rounded-xl border border-border bg-muted/40 p-4 sm:p-5">
      <Card className="w-full max-w-80 gap-5 rounded-xl border-2 border-dotted border-foreground/50 py-6 font-lao text-center shadow-none ring-0">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="break-words text-2xl font-bold leading-snug text-foreground">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center px-4 sm:px-6">
          <div className="w-52 max-w-full sm:w-56">
            {loading ? (
              <Skeleton className="aspect-square w-full rounded-lg" />
            ) : imageUrl ? (
              <Image src={imageUrl} alt={`${title} QR`} width={224} height={224} unoptimized className="aspect-square h-auto w-full object-contain" />
            ) : (
              <div className="grid aspect-square w-full place-items-center rounded-lg bg-muted text-muted-foreground">
                <QrCode className="size-10" aria-hidden="true" />
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="justify-center px-4 sm:px-6">
          <p className="text-sm font-medium leading-relaxed text-foreground">{caption}</p>
        </CardFooter>
      </Card>
    </div>
  );
}
