"use client";

import { useMemo, useRef, useState, type ClipboardEvent } from "react";
import { AlertCircle, CheckCircle2, CircleDashed, Plus, Trash2, UsersRound, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader
} from "@/features/settings/shared/settings-shell";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import type { Role, User } from "@/services/user";
import type { Zone } from "@/services/zone";
import { useUserStore } from "@/stores/user-store";
import {
  type BulkCredentialInput,
  type BulkCredentialField,
  buildBulkUserInput,
  parseBulkCredentialPaste,
  roleId,
  roleName,
  userValue,
  validateBulkCredentials,
  zoneName
} from "./user-utils";

type BulkRowStatus = "pending" | "running" | "success" | "error";

interface BulkRow {
  email: string;
  error?: string;
  status: BulkRowStatus;
}

interface CredentialDraft extends BulkCredentialInput {
  id: number;
}

const INITIAL_CREDENTIAL_ROWS: CredentialDraft[] = [{ email: "", id: 1, password: "" }];

// Show the result of each independent account save.
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

export function UserBulkDialog({
  branchUuid,
  editingUsers,
  loggedRoleId,
  onCreated,
  onOpenChange,
  open,
  roleOptions,
  zoneOptions
}: {
  branchUuid: string;
  editingUsers: User[] | null;
  loggedRoleId: number;
  onCreated: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  roleOptions: Role[];
  zoneOptions: Zone[];
}) {
  const { t } = useTranslation();
  const saveUserRow = useUserStore((state) => state.save);
  const isEditing = editingUsers !== null;
  const submitting = useRef(false);
  const [credentialRows, setCredentialRows] = useState<CredentialDraft[]>(INITIAL_CREDENTIAL_ROWS);
  const [selectedRoleId, setSelectedRoleId] = useState(() => String(loggedRoleId || ""));
  const [selectedZoneUuids, setSelectedZoneUuids] = useState<string[]>([]);
  const [keepZones, setKeepZones] = useState(isEditing);
  const [active, setActive] = useState(isEditing ? "keep" : "1");
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [running, setRunning] = useState(false);
  const [formError, setFormError] = useState("");

  useResetOnDeps([open, editingUsers], () => {
    setCredentialRows(editingUsers?.map((user, index) => ({
      id: index + 1, loginUuid: user.login_uuid, email: userValue(user, "login_email"), password: ""
    })) ?? INITIAL_CREDENTIAL_ROWS);
    setSelectedRoleId(isEditing ? "keep" : String(loggedRoleId || ""));
    setSelectedZoneUuids([]);
    setKeepZones(isEditing);
    setActive(isEditing ? "keep" : "1");
    setRows([]);
    setRunning(false);
    setFormError("");
  });

  const validation = useMemo(() => validateBulkCredentials(credentialRows), [credentialRows]);
  const hasCredentialInput = credentialRows.some((row) => row.email.trim() || row.password.trim());
  const hasStarted = rows.length > 0;
  const successCount = rows.filter((row) => row.status === "success").length;
  const errorCount = rows.filter((row) => row.status === "error").length;
  const pendingCount = rows.length - successCount - errorCount;
  const progressValue = rows.length ? Math.round(((successCount + errorCount) / rows.length) * 100) : 0;
  const failedRow = rows.find((row) => row.status === "error");

  function validate(): string | null {
    if (!hasCredentialInput) return t("settings.userBulkEmailsRequired");
    if (validation.incompleteRows.length) {
      return t("settings.userBulkIncompleteRows", { rows: validation.incompleteRows.join(", ") });
    }
    if (validation.invalidEmails.length) {
      return t("settings.userBulkInvalidEmails", { emails: validation.invalidEmails.join(", ") });
    }
    if (validation.invalidPasswordRows.length) {
      return t("settings.userBulkInvalidPasswordRows", { rows: validation.invalidPasswordRows.join(", ") });
    }
    if (validation.duplicateEmails.length) {
      return t("settings.userBulkDuplicateEmails", { emails: validation.duplicateEmails.join(", ") });
    }
    if (!validation.valid.length) return t("settings.userBulkEmailsRequired");
    if (!selectedRoleId) return t("settings.createRoleFirst");
    return null;
  }

  function addCredentialRow() {
    setCredentialRows((current) => [
      ...current,
      {
        email: "",
        id: Math.max(0, ...current.map((row) => row.id)) + 1,
        password: ""
      }
    ]);
  }

  function updateCredentialRow(id: number, field: "email" | "password", value: string) {
    setCredentialRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  }

  function pasteCredentialRows(
    event: ClipboardEvent<HTMLInputElement>,
    startIndex: number,
    targetField: BulkCredentialField
  ) {
    const pastedRows = parseBulkCredentialPaste(event.clipboardData.getData("text/plain"), targetField);
    if (!pastedRows.length) return;
    event.preventDefault();

    const availableRows = Math.max(0, credentialRows.length - startIndex);
    const rowsToApply = isEditing ? pastedRows.slice(0, availableRows) : pastedRows;
    if (isEditing && pastedRows.length > availableRows) {
      setFormError(t("settings.userBulkPasteLimit", { pasted: pastedRows.length, available: availableRows }));
    } else {
      setFormError("");
    }

    setCredentialRows((current) => {
      const next = current.map((row) => ({ ...row }));
      let nextId = Math.max(0, ...next.map((row) => row.id)) + 1;
      while (next.length < startIndex + rowsToApply.length) {
        next.push({ email: "", id: nextId, password: "" });
        nextId += 1;
      }
      rowsToApply.forEach((pastedRow, offset) => {
        next[startIndex + offset] = { ...next[startIndex + offset], ...pastedRow };
      });
      return next;
    });
  }

  function removeCredentialRow(id: number) {
    setCredentialRows((current) =>
      current.length === 1 ? INITIAL_CREDENTIAL_ROWS : current.filter((row) => row.id !== id)
    );
  }

  async function handleSubmit() {
    if (submitting.current || hasStarted) return;
    const message = validate();
    if (message) {
      setFormError(message);
      return;
    }
    setFormError("");
    submitting.current = true;

    const credentials = validation.valid;
    setRows(credentials.map(({ email }) => ({ email, status: "pending" as const })));
    setRunning(true);

    const results = await Promise.all(
      credentials.map(async (credential, index) => {
        setRows((prev) => prev.map((row, i) => (i === index ? { ...row, status: "running" } : row)));
        try {
          await saveUserRow(buildBulkUserInput(credential, {
            branchUuid, role: selectedRoleId, active,
            zones: keepZones ? null : selectedZoneUuids
          }));
          setRows((prev) => prev.map((row, i) => (i === index ? { ...row, status: "success" } : row)));
          return true;
        } catch (error) {
          setRows((prev) =>
            prev.map((row, i) =>
              i === index
                ? { ...row, error: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"), status: "error" }
                : row
            )
          );
          return false;
        }
      })
    );

    setRunning(false);
    submitting.current = false;
    if (results.some(Boolean)) onCreated();
    if (results.every(Boolean)) onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (running) return;
        onOpenChange(next);
      }}
    >
      <SettingsDialogContent className="sm:max-w-6xl" showCloseButton={!running}>
        <SettingsDialogForm
          noValidate
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
                <DialogTitle>{t(isEditing ? "settings.userBulkEditTitle" : "settings.userBulkDialogTitle")}</DialogTitle>
                <DialogDescription>{t(isEditing ? "settings.userBulkEditDescription" : "settings.userBulkDialogDescription")}</DialogDescription>
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

                {failedRow ? (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertTitle>
                      {t("settings.userBulkStoppedTitle", { success: successCount, total: rows.length })}
                    </AlertTitle>
                    <AlertDescription>
                      {failedRow.email}: {failedRow.error}
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
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="bulk_role">{t("fields.roles_id_fk")}</FieldLabel>
                      <Select disabled={running} value={selectedRoleId} onValueChange={setSelectedRoleId}>
                        <SelectTrigger id="bulk_role" className="w-full">
                          <SelectValue placeholder={t("settings.selectRole")} />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectGroup>
                            {isEditing ? <SelectItem value="keep">{t("settings.userBulkKeepRole")}</SelectItem> : null}
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
                    <Field>
                      <FieldLabel id="bulk_zone_label">{t("nav.zone")}</FieldLabel>
                      {isEditing ? (
                        <label className="flex min-h-10 items-center gap-3 text-sm">
                          <Checkbox checked={keepZones} onCheckedChange={(checked) => setKeepZones(checked === true)} />
                          {t("settings.userBulkKeepZones")}
                        </label>
                      ) : null}
                      <div
                        aria-labelledby="bulk_zone_label"
                        className="flex max-h-44 flex-col gap-1 overflow-y-auto rounded-md border border-input bg-background p-2"
                        role="group"
                      >
                        <label className="flex min-h-9 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60">
                          <Checkbox
                            checked={selectedZoneUuids.length === 0}
                            disabled={running || keepZones}
                            onCheckedChange={() => setSelectedZoneUuids([])}
                          />
                          <span className="text-sm font-medium">{t("settings.allZones")}</span>
                        </label>
                        {zoneOptions.map((zone) => (
                          <label
                            key={zone.zone_uuid}
                            className="flex min-h-9 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60"
                          >
                            <Checkbox
                              checked={selectedZoneUuids.includes(zone.zone_uuid)}
                              disabled={running || keepZones}
                              onCheckedChange={(checked) =>
                                setSelectedZoneUuids((current) =>
                                  checked === true
                                    ? [...new Set([...current, zone.zone_uuid])]
                                    : current.filter((zoneUuid) => zoneUuid !== zone.zone_uuid)
                                )
                              }
                            />
                            <span className="text-sm">{zoneName(zone)}</span>
                          </label>
                        ))}
                      </div>
                      <FieldDescription>{t("settings.userZoneHint")}</FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel>{t("fields.login_active")}</FieldLabel>
                      <div className="flex flex-wrap gap-2" role="group" aria-label={t("fields.login_active")}>
                        {isEditing ? (
                          <Button type="button" variant={active === "keep" ? "secondary" : "outline"} aria-pressed={active === "keep"} onClick={() => setActive("keep")}>
                            {t("settings.userBulkKeepActive")}
                          </Button>
                        ) : null}
                        <Button type="button" variant={active === "1" ? "default" : "outline"} aria-pressed={active === "1"} onClick={() => setActive("1")}>
                          {t("settings.userEnable")}
                        </Button>
                        <Button type="button" variant={active === "2" ? "secondary" : "outline"} aria-pressed={active === "2"} onClick={() => setActive("2")}>
                          {t("settings.userDisable")}
                        </Button>
                      </div>
                    </Field>
                  </div>

                  <Field>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <FieldLabel>{t("settings.userBulkEmailsLabel")}</FieldLabel>
                      {validation.valid.length ? (
                        <Badge className="border-success/30 bg-success/10 text-success">
                          {t("settings.userBulkEmailsHint", { count: validation.valid.length })}
                        </Badge>
                      ) : null}
                    </div>
                    <FieldDescription>{t("settings.userBulkExcelPasteHint")}</FieldDescription>
                    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-2">
                      {credentialRows.map((row, index) => (
                        <div
                          key={row.id}
                          className="grid grid-cols-1 gap-2 rounded-md border border-border bg-card p-2 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem] sm:items-center"
                        >
                          <span className="text-center text-sm font-black text-muted-foreground">{index + 1}</span>
                          <Input
                            aria-label={`${t("fields.login_email")} ${index + 1}`}
                            autoComplete="email"
                            disabled={running}
                            id={`bulk_email_${row.id}`}
                            placeholder="name@gmail.com"
                            spellCheck={false}
                            translate="no"
                            type="email"
                            value={row.email}
                            onChange={(event) => updateCredentialRow(row.id, "email", event.target.value)}
                            onPaste={(event) => pasteCredentialRows(event, index, "email")}
                          />
                          <Input
                            aria-label={`${t("fields.login_password")} ${index + 1}`}
                            autoComplete="new-password"
                            disabled={running}
                            placeholder={t(isEditing ? "settings.userBulkKeepPassword" : "fields.login_password")}
                            type="password"
                            value={row.password}
                            onChange={(event) => updateCredentialRow(row.id, "password", event.target.value)}
                            onPaste={(event) => pasteCredentialRows(event, index, "password")}
                          />
                          <Button
                            aria-label={t("settings.userBulkRemoveRow", { row: index + 1 })}
                            disabled={running || credentialRows.length === 1}
                            size="icon"
                            type="button"
                            variant="ghost"
                            onClick={() => removeCredentialRow(row.id)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ))}
                      {!isEditing ? <Button disabled={running} type="button" variant="outline" onClick={addCredentialRow}>
                        <Plus data-icon="inline-start" />
                        {t("settings.userBulkAddRow")}
                      </Button> : null}
                    </div>
                  </Field>
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
              <>
                {errorCount ? <Button disabled={running} type="button" variant="outline" onClick={() => {
                  const failed = new Set(rows.filter((row) => row.status === "error").map((row) => row.email));
                  setCredentialRows((current) => current.filter((row) => failed.has(row.email.trim())));
                  setRows([]);
                }}>
                  {t("settings.userBulkRetryFailed")}
                </Button> : null}
                <Button disabled={running} type="button" onClick={() => onOpenChange(false)}>
                  {t("actions.close")}
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t("actions.cancel")}
                </Button>
                <Button disabled={!hasCredentialInput || !selectedRoleId} type="submit">
                  <UsersRound data-icon="inline-start" />
                  {t(isEditing ? "actions.save" : "settings.userBulkSubmit")}
                </Button>
              </>
            )}
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}
