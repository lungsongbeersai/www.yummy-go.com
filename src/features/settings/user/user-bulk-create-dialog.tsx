"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, CircleDashed, UsersRound, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader
} from "@/features/settings/shared/settings-shell";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import type { Role } from "@/services/user";
import { useUserStore } from "@/stores/user-store";
import { parseBulkEmails, roleId, roleName } from "./user-utils";

type BulkRowStatus = "pending" | "running" | "success" | "error";

interface BulkRow {
  email: string;
  error?: string;
  status: BulkRowStatus;
}

// สถานะแถวรายอีเมวตอนสร้างจริง — ไอคอน/สีต่อสถานะให้เข้าชุดกับ product-import-dialog.tsx
function BulkRowStatusCell({ error, status }: { error?: string; status: BulkRowStatus }) {
  const { t } = useTranslation();

  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-success">
        <CheckCircle2 data-icon="inline-start" />
        {t("settings.userBulkRowSuccess")}
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
        <Spinner data-icon="inline-start" />
        {t("common.processing")}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive" title={error}>
        <XCircle className="shrink-0" data-icon="inline-start" />
        <span className="truncate">{error}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <CircleDashed data-icon="inline-start" />
      {t("settings.userBulkRowPending")}
    </span>
  );
}

export function UserBulkCreateDialog({
  branchUuid,
  loggedRoleId,
  onCreated,
  onOpenChange,
  open,
  roleOptions
}: {
  branchUuid: string;
  loggedRoleId: number;
  onCreated: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  roleOptions: Role[];
}) {
  const { t } = useTranslation();
  const saveUserRow = useUserStore((state) => state.save);
  const [emailsText, setEmailsText] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState(() => String(loggedRoleId || ""));
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [running, setRunning] = useState(false);
  const [formError, setFormError] = useState("");

  // ล้างฟอร์มทุกครั้งที่ dialog ปิด — เปิดใหม่ครั้งถัดไปจึงเริ่มว่างเสมอ
  useResetOnDeps([open], () => {
    if (open) return;
    setEmailsText("");
    setPassword("");
    setSelectedRoleId(String(loggedRoleId || ""));
    setRows([]);
    setRunning(false);
    setFormError("");
  });

  const parsed = useMemo(() => parseBulkEmails(emailsText), [emailsText]);
  const hasStarted = rows.length > 0;
  const successCount = rows.filter((row) => row.status === "success").length;
  const errorCount = rows.filter((row) => row.status === "error").length;
  const pendingCount = rows.length - successCount - errorCount;
  const progressValue = rows.length ? Math.round(((successCount + errorCount) / rows.length) * 100) : 0;
  const stoppedRow = rows.find((row) => row.status === "error");

  function validate(): string | null {
    if (!parsed.valid.length && !parsed.invalidLines.length) return t("settings.userBulkEmailsRequired");
    if (parsed.invalidLines.length) {
      return t("settings.userBulkInvalidEmails", { emails: parsed.invalidLines.join(", ") });
    }
    if (parsed.duplicates.length) {
      return t("settings.userBulkDuplicateEmails", { emails: parsed.duplicates.join(", ") });
    }
    if (!password.trim()) return t("settings.passwordRequired");
    if (!selectedRoleId) return t("settings.createRoleFirst");
    return null;
  }

  async function handleSubmit() {
    const message = validate();
    if (message) {
      setFormError(message);
      return;
    }
    setFormError("");

    const emails = parsed.valid;
    setRows(emails.map((email) => ({ email, status: "pending" as const })));
    setRunning(true);

    let createdAny = false;
    for (let index = 0; index < emails.length; index += 1) {
      setRows((prev) => prev.map((row, i) => (i === index ? { ...row, status: "running" } : row)));
      try {
        await saveUserRow({
          branch_uuid_fk: branchUuid,
          login_active: 1,
          login_email: emails[index],
          login_password: password.trim(),
          roles_id_fk: Number(selectedRoleId)
        });
        createdAny = true;
        setRows((prev) => prev.map((row, i) => (i === index ? { ...row, status: "success" } : row)));
      } catch (error) {
        setRows((prev) =>
          prev.map((row, i) =>
            i === index
              ? { ...row, error: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"), status: "error" }
              : row
          )
        );
        setRunning(false);
        if (createdAny) onCreated();
        return;
      }
    }

    setRunning(false);
    onCreated();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (running) return;
        onOpenChange(next);
      }}
    >
      <SettingsDialogContent className="sm:max-w-xl">
        <SettingsDialogForm
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <SettingsDialogHeader>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-primary">
                <UsersRound />
              </span>
              <div className="min-w-0">
                <DialogTitle>{t("settings.userBulkDialogTitle")}</DialogTitle>
                <DialogDescription>{t("settings.userBulkDialogDescription")}</DialogDescription>
              </div>
            </div>
          </SettingsDialogHeader>
          <SettingsDialogBody>
            {hasStarted ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="justify-center" variant="outline">
                    {t("settings.userBulkTotalCount", { count: rows.length })}
                  </Badge>
                  <Badge className="justify-center border-success/30 bg-success/10 text-success">
                    {t("settings.userBulkSuccessCount", { count: successCount })}
                  </Badge>
                  {errorCount ? (
                    <Badge className="justify-center border-destructive/30 bg-destructive/10 text-destructive">
                      {t("settings.userBulkFailedCount", { count: errorCount })}
                    </Badge>
                  ) : null}
                  {pendingCount ? (
                    <Badge className="justify-center">{t("settings.userBulkPendingCount", { count: pendingCount })}</Badge>
                  ) : null}
                </div>

                <Progress value={progressValue} />

                {stoppedRow ? (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertTitle>
                      {t("settings.userBulkStoppedTitle", { success: successCount, total: rows.length })}
                    </AlertTitle>
                    <AlertDescription>
                      {stoppedRow.email}: {stoppedRow.error}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="max-h-72 overflow-auto rounded-md border border-border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>{t("fields.login_email")}</TableHead>
                        <TableHead className="w-44">{t("settings.userBulkProgressTitle")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row, index) => (
                        <TableRow key={row.email}>
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          <TableCell className="max-w-[14rem] truncate font-medium">{row.email}</TableCell>
                          <TableCell className="max-w-[12rem]">
                            <BulkRowStatusCell error={row.error} status={row.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <FieldGroup className="gap-4">
                <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
                  <Field>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <FieldLabel htmlFor="bulk_emails">{t("settings.userBulkEmailsLabel")}</FieldLabel>
                      {parsed.valid.length ? (
                        <Badge className="border-success/30 bg-success/10 text-success">
                          {t("settings.userBulkEmailsHint", { count: parsed.valid.length })}
                        </Badge>
                      ) : null}
                    </div>
                    <Textarea
                      className="min-h-40 font-mono text-sm"
                      disabled={running}
                      id="bulk_emails"
                      placeholder={t("settings.userBulkEmailsPlaceholder")}
                      value={emailsText}
                      onChange={(event) => setEmailsText(event.target.value)}
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="bulk_password">{t("fields.login_password")}</FieldLabel>
                      <Input
                        autoComplete="new-password"
                        disabled={running}
                        id="bulk_password"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                      <FieldDescription>{t("settings.userBulkPasswordHint")}</FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="bulk_role">{t("fields.roles_id_fk")}</FieldLabel>
                      <Select disabled={running} value={selectedRoleId} onValueChange={setSelectedRoleId}>
                        <SelectTrigger id="bulk_role" className="w-full">
                          <SelectValue placeholder={t("settings.selectRole")} />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectGroup>
                            {roleOptions.map((role) => {
                              const id = roleId(role);
                              if (!id) return null;
                              return (
                                <SelectItem key={id} value={id}>
                                  {roleName(role)}
                                </SelectItem>
                              );
                            })}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  {formError ? (
                    <Alert variant="destructive">
                      <AlertCircle />
                      <AlertDescription>{formError}</AlertDescription>
                    </Alert>
                  ) : null}
                </FieldSet>
              </FieldGroup>
            )}
          </SettingsDialogBody>
          <SettingsDialogFooter>
            {hasStarted ? (
              <Button disabled={running} type="button" onClick={() => onOpenChange(false)}>
                {t("actions.close")}
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t("actions.cancel")}
                </Button>
                <Button disabled={!emailsText.trim() || !password.trim() || !selectedRoleId} type="submit">
                  <UsersRound data-icon="inline-start" />
                  {t("settings.userBulkSubmit")}
                </Button>
              </>
            )}
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}
