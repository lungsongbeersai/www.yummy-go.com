import { Check, ChefHat, Clock3, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MySalesKitchenStatus, MySalesPaymentStatus } from "@/services/pos";

export function MySalesKitchenBadge({ status }: { status: MySalesKitchenStatus }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={cn("h-auto min-h-6 whitespace-normal py-1 text-xs", status === "sent" ? "border-success/20 bg-success/10 text-success-text" : status === "cancelled" ? "text-muted-foreground" : "border-warning/20 bg-warning/10 text-warning-text")}>
      {status === "cancelled" ? <X /> : status === "sent" ? <ChefHat /> : <Clock3 />}
      {t(`mySales.kitchen.${status}`)}
    </Badge>
  );
}

export function MySalesPaymentBadge({ status }: { status: MySalesPaymentStatus }) {
  const { t } = useTranslation();
  return (
    <Badge variant={status === "cancelled" ? "destructive" : "outline"} className={cn("h-auto min-h-6 whitespace-normal py-1 text-xs", status === "paid" && "border-success/20 bg-success/10 text-success-text", status === "unpaid" && "border-pending/20 bg-pending/10 text-warning-text")}>
      {status === "cancelled" ? <X /> : status === "paid" ? <Check /> : <Clock3 />}
      {t(`mySales.payment.${status}`)}
    </Badge>
  );
}
