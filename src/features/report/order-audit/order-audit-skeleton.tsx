import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_ROWS = 6;
const SKELETON_COLUMNS = 6;

export function OrderAuditSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card" aria-hidden="true">
      <div className="flex items-center gap-4 border-b p-3">
        {Array.from({ length: SKELETON_COLUMNS }, (_, index) => (
          <Skeleton key={index} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 border-b p-3 last:border-b-0">
          {Array.from({ length: SKELETON_COLUMNS }, (_, columnIndex) => (
            <Skeleton key={columnIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
