"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Save } from "lucide-react";
import { BackButton } from "@/components/common/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  AGENT_URL,
  parseInterfaceValue,
  type AgentInfo,
  type Printer,
  type SearchPrinterResult,
} from "@/services/printer";
import type { Category } from "@/services/category";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";

const EMPTY_CATEGORIES: Category[] = [];

type ConnectType = "usb" | "tcp";

interface CheckboxOption {
  label: string;
  value: string;
}

function safeId(prefix: string, value: string) {
  return `${prefix}-${value.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function textValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function categoryLabel(category: Category, language: string) {
  const english = language.startsWith("en");
  const primary = english ? category.cate_name_eng : category.cate_name_la;
  const fallback = english ? category.cate_name_la : category.cate_name_eng;
  return primary || fallback || category.cate_name || category.cate_uuid;
}

function categoryUuids(printer: Printer | null) {
  if (!printer) return [];
  if (printer.cate_uuid_fk.length) return printer.cate_uuid_fk;
  return (
    printer.categories?.map((category) => category.cate_uuid).filter(Boolean) ??
    []
  );
}

function CheckboxOptionList({
  description,
  emptyLabel,
  legend,
  name,
  options,
  selected,
  onToggle,
}: {
  description: string;
  emptyLabel: string;
  legend: string;
  name: string;
  options: CheckboxOption[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
      <div>
        <FieldLegend className="mb-1 text-sm font-black">{legend}</FieldLegend>
        <FieldDescription>{description}</FieldDescription>
      </div>
      {options.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option) => {
            const id = safeId(name, option.value);
            return (
              <Field
                key={option.value}
                orientation="horizontal"
                className="rounded-md border border-border p-3"
              >
                <Checkbox
                  id={id}
                  checked={selected.includes(option.value)}
                  onChange={() => onToggle(option.value)}
                />
                <FieldLabel htmlFor={id}>{option.label}</FieldLabel>
              </Field>
            );
          })}
        </div>
      ) : (
        <FieldDescription>{emptyLabel}</FieldDescription>
      )}
    </FieldSet>
  );
}

export function PrinterFormPage() {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const printConfigUuid = searchParams.get("print_config_uuid") ?? "";
  const isEditing = Boolean(printConfigUuid);
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.show);
  const printers = usePrinterStore((state) => state.printers);
  const found = usePrinterStore((state) => state.found);
  const roles = usePrinterStore((state) => state.roles);
  const agent = usePrinterStore((state) => state.agent);
  const loading = usePrinterStore((state) => state.loading);
  const searching = usePrinterStore((state) => state.searching);
  const saving = usePrinterStore((state) => state.saving);
  const loadPrinters = usePrinterStore((state) => state.loadPrinters);
  const loadRoles = usePrinterStore((state) => state.loadRoles);
  const discoverPrinters = usePrinterStore((state) => state.discover);
  const checkAgent = usePrinterStore((state) => state.checkAgent);
  const savePrinter = usePrinterStore((state) => state.save);
  const categories = (useReferenceStore((state) => state.options.categories) ??
    EMPTY_CATEGORIES) as Category[];
  const loadCategories = useReferenceStore((state) => state.loadCategories);

  const language = i18n.language;
  const storeUuid = authStoreUuid(user);
  const editing = useMemo(
    () =>
      printers.find(
        (printer) => printer.print_config_uuid === printConfigUuid,
      ) ?? null,
    [printConfigUuid, printers],
  );
  const roleOptions = useMemo(
    () =>
      roles
        .map((role) => ({ label: role.role_name, value: role.role_code }))
        .filter((role) => role.value),
    [roles],
  );
  const categoryOptions = useMemo(
    () =>
      categories
        .map((category) => ({
          label: categoryLabel(category, language),
          value: category.cate_uuid,
        }))
        .filter((category) => category.value),
    [categories, language],
  );

  const [connectType, setConnectType] = useState<ConnectType>("tcp");
  const [displayName, setDisplayName] = useState("");
  const [interfaceValue, setInterfaceValue] = useState("");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("9100");
  const [paperWidth, setPaperWidth] = useState("80");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [agentUrl, setAgentUrl] = useState(AGENT_URL);
  const [agentId, setAgentId] = useState("");
  const [agentName, setAgentName] = useState("");
  const [deviceCode, setDeviceCode] = useState("");
  const [usbSearchComplete, setUsbSearchComplete] = useState(false);
  const [usbSearchError, setUsbSearchError] = useState("");
  const autoUsbSearchDone = useRef(false);

  const fillAgent = useCallback((nextAgent: AgentInfo) => {
    setAgentUrl(AGENT_URL);
    setAgentId(textValue(nextAgent.agent_id));
    setAgentName(textValue(nextAgent.agent_name));
    setDeviceCode(textValue(nextAgent.device_code));
  }, []);

  const loadFormData = useCallback(async () => {
    if (!user?.uuid) return;
    try {
      await Promise.all([
        loadPrinters({ login_uuid_fk: user.uuid }),
        loadRoles(language),
        storeUuid ? loadCategories(language, storeUuid) : Promise.resolve([]),
        checkAgent(),
      ]);
    } catch (error) {
      showToast({
        title: t("printer.loadFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    }
  }, [
    checkAgent,
    language,
    loadCategories,
    loadPrinters,
    loadRoles,
    showToast,
    storeUuid,
    t,
    user?.uuid,
  ]);

  useEffect(() => {
    void loadFormData();
  }, [loadFormData]);

  useEffect(() => {
    if (isEditing && !editing) return;

    const parsed = parseInterfaceValue(editing?.interface_value ?? "");
    const nextConnectType = editing
      ? editing.connect_type === "usb"
        ? "usb"
        : "tcp"
      : "tcp";
    setConnectType(nextConnectType);
    setDisplayName(editing?.printer_name ?? "");
    setInterfaceValue(
      nextConnectType === "usb" ? (editing?.interface_value ?? "") : "",
    );
    setIp(nextConnectType === "tcp" ? (parsed.ip ?? "") : "");
    setPort(String(nextConnectType === "tcp" ? (parsed.port ?? 9100) : 9100));
    setPaperWidth(String(editing?.paper_width_mm ?? 80));
    setSelectedRoles(editing?.role_codes ?? []);
    setSelectedCategories(categoryUuids(editing));
    setSelectedDevice("");
    setAgentUrl(textValue(editing?.agent_url) || AGENT_URL);
    setAgentId(editing?.agent_id ?? "");
    setAgentName(editing?.agent_name ?? "");
    setDeviceCode(editing?.device_code ?? "");
  }, [editing, isEditing]);

  useEffect(() => {
    if (!agent || isEditing) return;
    const nextAgentId = textValue(agent.agent_id);
    const nextAgentName = textValue(agent.agent_name);
    const nextDeviceCode = textValue(agent.device_code);
    setAgentUrl((value) => value || AGENT_URL);
    setAgentId((value) => value || nextAgentId);
    setAgentName((value) => value || nextAgentName);
    setDeviceCode((value) => value || nextDeviceCode);
  }, [agent, isEditing]);

  const hasAgentIdentity =
    Boolean(agentUrl.trim()) &&
    Boolean(agentId.trim()) &&
    Boolean(agentName.trim());
  const canSubmit =
    Boolean(displayName.trim()) &&
    selectedRoles.length > 0 &&
    (connectType === "usb"
      ? Boolean(interfaceValue.trim()) && hasAgentIdentity
      : Boolean(ip.trim()));

  const searchUsbDevices = useCallback(
    async (showSuccess = true) => {
      setUsbSearchError("");
      setUsbSearchComplete(false);
      try {
        const result = await discoverPrinters("usb");
        setUsbSearchComplete(true);
        if (showSuccess) {
          showToast({
            title: t("printer.printerSearchComplete"),
            description: t("printer.deviceCount", { count: result.length }),
            tone: "success",
          });
        }
      } catch (error) {
        showToast({
          title: t("printer.searchFailed"),
          description: error instanceof Error ? error.message : "",
          tone: "error",
        });
        setUsbSearchError(
          error instanceof Error ? error.message : t("printer.searchFailed"),
        );
        setUsbSearchComplete(true);
      }
    },
    [discoverPrinters, showToast, t],
  );

  useEffect(() => {
    if (connectType !== "usb") {
      autoUsbSearchDone.current = false;
      setUsbSearchComplete(false);
      setUsbSearchError("");
      return;
    }
    if (found.length) {
      setUsbSearchComplete(true);
      return;
    }
    if (autoUsbSearchDone.current || searching || saving) return;
    autoUsbSearchDone.current = true;
    void searchUsbDevices(false);
  }, [connectType, found.length, saving, searchUsbDevices, searching]);

  const usbSelectDescription = (() => {
    if (searching) return t("printer.searchingUsb");
    if (usbSearchError) return usbSearchError;
    if (found.length) return t("printer.deviceCount", { count: found.length });
    if (usbSearchComplete) return t("printer.noUsbPrinters");
    return t("printer.usbSearchPending");
  })();

  function selectDevice(interfaceValue: string) {
    const printer = found.find(
      (item) => item.interface_value === interfaceValue,
    );
    if (!printer) return;
    setSelectedDevice(interfaceValue);
    setConnectType("usb");
    setDisplayName(textValue(printer.name));
    setInterfaceValue(textValue(printer.interface_value));
    if (agent) fillAgent(agent);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.uuid || !canSubmit) return;

    try {
      await savePrinter({
        print_config_uuid: printConfigUuid,
        login_uuid_fk: user.uuid,
        display_name: displayName.trim(),
        connect_type: connectType,
        ip: ip.trim(),
        port: Number(port || 9100),
        interface_value: interfaceValue.trim(),
        paper_width_mm: Number(paperWidth || 80),
        role_codes: selectedRoles,
        cate_uuid_fk: selectedCategories,
        agent_url: agentUrl.trim() || AGENT_URL,
        agent_id: agentId.trim(),
        agent_name: agentName.trim(),
        device_code: deviceCode.trim() || agentId.trim(),
      });
      showToast({ title: t("printer.saved"), tone: "success" });
      router.push("/printer");
    } catch (error) {
      showToast({
        title: t("printer.saveFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <BackButton fallbackHref="/printer" label={t("printer.title")} />
      <Card>
        <CardHeader>
          <div>
            <CardTitle>
              {isEditing ? t("printer.edit") : t("printer.add")}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("printer.formHint")}
            </p>
          </div>
          {isEditing ? <Badge>{t("actions.edit")}</Badge> : null}
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <FieldSet className="gap-4 rounded-lg border border-border bg-card p-4">
              <div>
                <FieldLegend className="mb-1 text-sm font-black">
                  {t("printer.connection")}
                </FieldLegend>
                <FieldDescription>
                  {t("printer.connectionHint")}
                </FieldDescription>
              </div>

              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="printer-display-name">
                    {t("fields.displayName")}
                  </FieldLabel>
                  <Input
                    id="printer-display-name"
                    value={displayName}
                    disabled={saving}
                    required
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="printer-connect-type">
                    {t("fields.connectType")}
                  </FieldLabel>
                  <Select
                    value={connectType}
                    onValueChange={(value) =>
                      setConnectType(value as ConnectType)
                    }
                  >
                    <SelectTrigger id="printer-connect-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        <SelectItem value="usb">
                          {t("printer.usbPrinter")}
                        </SelectItem>
                        <SelectItem value="tcp">
                          {t("printer.tcpPrinter")}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                {connectType === "usb" ? (
                  <>
                    <Field>
                      <FieldLabel htmlFor="printer-usb-device">
                        {t("printer.selectedPrinter")}
                      </FieldLabel>
                      <Select
                        value={selectedDevice}
                        disabled={!found.length || searching || saving}
                        onValueChange={selectDevice}
                      >
                        <SelectTrigger
                          id="printer-usb-device"
                          className="w-full"
                        >
                          <SelectValue
                            placeholder={
                              searching
                                ? t("printer.searchingUsb")
                                : t("printer.selectUsbPrinter")
                            }
                          />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectGroup>
                            {found.map((printer: SearchPrinterResult) => (
                              <SelectItem
                                key={printer.interface_value}
                                value={printer.interface_value}
                              >
                                {printer.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        {usbSelectDescription}
                      </FieldDescription>
                    </Field>
                    {/* <Field>
                      <FieldLabel htmlFor="printer-interface-value">{t("fields.interfaceValue")}</FieldLabel>
                      <Input
                        id="printer-interface-value"
                        value={interfaceValue}
                        disabled={saving}
                        placeholder={t("printer.interfacePlaceholder")}
                        required
                        onChange={(event) => setInterfaceValue(event.target.value)}
                      />
                    </Field> */}
                  </>
                ) : (
                  <>
                    <Field>
                      <FieldLabel htmlFor="printer-ip">
                        {t("fields.ip")}
                      </FieldLabel>
                      <Input
                        id="printer-ip"
                        value={ip}
                        disabled={saving}
                        placeholder="192.168.100.75"
                        required
                        onChange={(event) => setIp(event.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="printer-port">
                        {t("fields.port")}
                      </FieldLabel>
                      <Input
                        id="printer-port"
                        value={port}
                        disabled={saving}
                        type="number"
                        required
                        onChange={(event) => setPort(event.target.value)}
                      />
                    </Field>
                  </>
                )}

                <Field>
                  <FieldLabel htmlFor="printer-paper-width">
                    {t("fields.paperWidth")}
                  </FieldLabel>
                  <Input
                    id="printer-paper-width"
                    value={paperWidth}
                    disabled={saving}
                    type="number"
                    required
                    onChange={(event) => setPaperWidth(event.target.value)}
                  />
                </Field>
              </FieldGroup>
            </FieldSet>

            <CheckboxOptionList
              legend={t("printer.roles")}
              description={t("printer.rolesHint")}
              emptyLabel={t("printer.noRoles")}
              name="printer-role"
              options={roleOptions}
              selected={selectedRoles}
              onToggle={(value) =>
                setSelectedRoles((current) => toggleValue(current, value))
              }
            />

            <CheckboxOptionList
              legend={t("printer.categories")}
              description={t("printer.categoriesHint")}
              emptyLabel={t("printer.noCategories")}
              name="printer-category"
              options={categoryOptions}
              selected={selectedCategories}
              onToggle={(value) =>
                setSelectedCategories((current) => toggleValue(current, value))
              }
            />

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => router.push("/printer")}
              >
                {t("actions.cancel")}
              </Button>
              <Button disabled={saving || loading || !canSubmit} type="submit">
                {saving ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                {saving ? t("common.processing") : t("actions.save")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
