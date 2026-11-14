import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Table2, UserRound } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatReportDateTime } from "@/features/report/shared/report-date-format";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EmployeeWorkItem, EmployeeWorkOrder } from "@/services/pos";
import { employeeWorkAdjustments, employeeWorkBillLabel, employeeWorkKitchenLabel, employeeWorkPaymentLabels, employeeWorkPrintLabel, employeeWorkQuantity } from "./employee-work-format";

function WorkStatus({ children, good = false, warning = false }: { children: ReactNode; good?: boolean; warning?: boolean }) {
  return <Badge variant="outline" className={cn("h-auto whitespace-normal py-1 text-xs", good && "border-success/20 bg-success/10 text-success-text", warning && "border-warning/20 bg-warning/10 text-warning-text")}>{children}</Badge>;
}

export function EmployeeWorkOrders({ orders }: { orders: EmployeeWorkOrder[] }) {
  const { t } = useTranslation();
  const l = (key: string) => t(`employeeWork.${key}`);
  const showAmount = (value: number | null) => value === null ? l("unknown") : money(value);
  return <Accordion type="multiple" className="overflow-hidden rounded-lg border border-border bg-card">
    {orders.map(order => <AccordionItem key={order.order_uuid} value={order.order_uuid}>
      <AccordionTrigger className="min-h-11 items-start px-3 py-3 text-left hover:no-underline sm:px-4">
        <span className="grid min-w-0 flex-1 gap-1.5">
          <span className="flex min-w-0 flex-wrap items-start justify-between gap-2"><span className="flex min-w-0 items-center gap-2 font-semibold"><Table2 className="size-4 shrink-0 text-primary-text" /><span className="break-words">{order.table_name || l("noTable")}{order.zone_name ? ` · ${order.zone_name}` : ""}</span></span><span className="shrink-0 font-semibold tabular-nums">{order.totals.source === "unknown" ? l("unknown") : showAmount(order.totals.grand_total)}</span></span>
          <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="break-all">{l("bill")}: {order.order_invoice || order.order_uuid}</span><span className="inline-flex items-center gap-1"><UserRound className="size-3.5" />{l("responsibleEmployee")}: {order.creator_name || l("unknownEmployee")}</span></span>
          <span className="flex flex-wrap gap-1.5"><WorkStatus>{l("checkBill")}: {l(employeeWorkBillLabel(order.bill_state))}</WorkStatus>{order.check_bill_requested ? <WorkStatus warning>{l("checkBillRequested")}</WorkStatus> : null}<WorkStatus good={["sent", "served"].includes(order.kitchen_status)} warning={["pending", "partial"].includes(order.kitchen_status)}>{l("kitchen")}: {l(employeeWorkKitchenLabel(order.kitchen_status))}</WorkStatus><WorkStatus good={order.payment_status === "paid"} warning={["unpaid", "partial", "credit_unpaid", "credit_partial"].includes(order.payment_status)}>{l("settlement")}: {employeeWorkPaymentLabels(order.payment_status).map(l).join(" · ")}</WorkStatus></span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="px-3 pb-4 sm:px-4">
        <div className="mb-3 grid gap-1 text-xs text-muted-foreground">{order.opened_at ? <p>{formatReportDateTime(order.opened_at)}</p> : null}{order.time_warning ? <p>{l(order.opened_at ? "estimatedOpening" : "unknownOpening")}</p> : null}{order.financial_warning ? <p role="status">{l("billNeedsReview")}</p> : null}</div>
        <div className="hidden rounded-md border border-border md:block"><Table><TableHeader><TableRow><TableHead>{l("item")}</TableHead><TableHead className="text-right">{l("unitPrice")}</TableHead><TableHead className="text-right">{l("quantity")}</TableHead><TableHead className="text-right">{l("lineTotal")}</TableHead><TableHead>{l("contributedBy")}</TableHead></TableRow></TableHeader><TableBody>{order.items.map(item => <TableRow key={item.order_it_uuid}><TableCell className="min-w-48 whitespace-normal align-top"><ItemDescription item={item} /></TableCell><TableCell className="whitespace-nowrap text-right align-top tabular-nums">{money(item.price)}</TableCell><TableCell className="text-right align-top tabular-nums">{employeeWorkQuantity(item.quantity)}</TableCell><TableCell className="whitespace-nowrap text-right align-top tabular-nums">{money(item.total)}</TableCell><TableCell className="max-w-48 whitespace-normal align-top">{item.created_by_name || l("unknownEmployee")}</TableCell></TableRow>)}</TableBody></Table></div>
        <ul className="grid gap-2 md:hidden">{order.items.map(item => <li key={item.order_it_uuid} className="grid gap-2 rounded-md border border-border bg-background p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><ItemDescription item={item} /></div><span className="shrink-0 text-sm font-semibold tabular-nums">{money(item.total)}</span></div><p className="text-xs tabular-nums">{l("quantity")}: {employeeWorkQuantity(item.quantity)} × {money(item.price)}</p><p className="break-words text-xs text-muted-foreground">{l("contributedBy")}: {item.created_by_name || l("unknownEmployee")}</p></li>)}</ul>
        <div className="mt-3 grid gap-1 border-t border-border pt-3 text-xs">
          <div className="flex flex-wrap justify-between gap-2 font-semibold"><span>{l("total")}</span><span className="tabular-nums">{showAmount(order.totals.grand_total)}</span></div>
          <div className="flex flex-wrap justify-between gap-2 text-muted-foreground"><span>{l("received")}: {showAmount(order.totals.received_total)}</span><span>{l("outstanding")}: {showAmount(order.totals.balance_amount)}</span>{order.totals.credit_balance !== 0 ? <span>{l("credit")}: {showAmount(order.totals.credit_balance)}</span> : null}</div>
          {employeeWorkAdjustments(order.totals).map(({ label, value }) => <div key={label} className="flex justify-between gap-2 text-muted-foreground"><span>{l(label)}</span><span className="tabular-nums">{money(value)}</span></div>)}
        </div>
      </AccordionContent>
    </AccordionItem>)}
  </Accordion>;
}

function ItemDescription({ item }: { item: EmployeeWorkItem }) {
  const { t } = useTranslation();
  const l = (key: string) => t(`employeeWork.${key}`);
  return <div className="grid gap-1"><p className={cn("break-words text-sm font-medium", item.status === 9 && "text-muted-foreground line-through")}>{item.product_name}{item.size_name ? ` · ${item.size_name}` : ""}</p>{item.is_set_component ? <p className="text-xs text-muted-foreground">{l("setComponent")}</p> : null}{item.toppings.length ? <p className="break-words text-xs text-muted-foreground">{item.toppings.map(topping => `${topping.topping_name} × ${employeeWorkQuantity(topping.quantity)}`).join(" · ")}</p> : null}{item.note ? <p className="break-words text-xs text-muted-foreground">{item.note}</p> : null}<p className="text-xs text-muted-foreground">{l(item.status === 9 ? "cancelledItem" : item.kitchen_sent ? "sent" : "pending")}{item.print_status !== "unknown" ? <> · {l("printStatus")}: <span className={cn(item.print_status === "failed" && "text-destructive")}>{l(employeeWorkPrintLabel(item.print_status))}</span></> : null}</p></div>;
}
