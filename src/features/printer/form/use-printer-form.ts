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
import {
  AGENT_URL,
  BROWSER_PRINTER_AGENT_URL,
  isBrowserPrinterAgentId,
  tcpInterfaceValue,
} from "@/config/printer-agent";
import type {
  AgentInfo,
  DefaultCategoryCategoryDetail,
  DefaultCategoryZoneDetail,
  PrinterKitchenCutMode,
  PrinterMappingType,
  PrinterSharingMode,
} from "@/services/printer";
import type { Category } from "@/services/category";
import type { Zone } from "@/services/zone";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import {
  assignedPrinterNamesByValue,
  cashDrawerEnabledOf,
  categoryLabel,
  initialPrinterFormValues,
  kitchenCutModeOf,
  mappingTypeOf,
  printerFormValues,
  textValue,
  zoneLabel,
  type ConnectType,
} from "./printer-form-utils";

const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_ZONES: Zone[] = [];

export function usePrinterForm() {
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
  const loadPrintersForLocalAgent = usePrinterStore(
    (state) => state.loadPrintersForLocalAgent,
  );
  const loadRoles = usePrinterStore((state) => state.loadRoles);
  const discoverPrinters = usePrinterStore((state) => state.discover);
  const savePrinter = usePrinterStore((state) => state.save);
  const resolveDeviceIdentity = usePrinterStore(
    (state) => state.resolveDeviceIdentity,
  );
  const getDefaultCategoryByRole = usePrinterStore(
    (state) => state.getDefaultCategoryByRole,
  );
  const categories = (useReferenceStore((state) => state.options.categories) ??
    EMPTY_CATEGORIES) as Category[];
  const loadCategories = useReferenceStore((state) => state.loadCategories);
  const zones = (useReferenceStore((state) => state.options.zones) ??
    EMPTY_ZONES) as Zone[];
  const loadZones = useReferenceStore((state) => state.loadZones);

  const language = i18n.language;
  const storeUuid = authStoreUuid(user);
  const branchUuid = user?.branch_uuid;
  const editing = useMemo(
    () =>
      printers.find(
        (printer) => printer.print_config_uuid === printConfigUuid,
      ) ?? null,
    [printConfigUuid, printers],
  );
  const roleAssignments = useMemo(
    () =>
      assignedPrinterNamesByValue(
        printers,
        printConfigUuid,
        (printer) => printer.role_codes,
      ),
    [printers, printConfigUuid],
  );
  // cate_uuid_fk มีความหมายทั้งสอง mapping_type แล้ว (ZONE บังคับเลือกหมวดหมู่คู่กับโซนด้วย)
  // จึงอ่านได้ตรงๆ ไม่ต้องกรองตาม mapping_type อีกต่อไป
  const categoryAssignments = useMemo(
    () =>
      assignedPrinterNamesByValue(
        printers,
        printConfigUuid,
        (printer) => printer.cate_uuid_fk,
      ),
    [printers, printConfigUuid],
  );
  const zoneAssignments = useMemo(
    () =>
      assignedPrinterNamesByValue(
        printers,
        printConfigUuid,
        (printer) => (mappingTypeOf(printer) === "ZONE" ? (printer.zone_uuid_fk ?? []) : []),
      ),
    [printers, printConfigUuid],
  );
  const roleOptions = useMemo(
    () =>
      roles
        .map((role) => ({
          label: role.role_name,
          value: role.role_code,
          assignedTo: roleAssignments.get(role.role_code) ?? [],
        }))
        .filter((role) => role.value),
    [roleAssignments, roles],
  );
  const categoryOptions = useMemo(
    () =>
      categories
        .map((category) => ({
          label: categoryLabel(category, language),
          value: category.cate_uuid,
          assignedTo: categoryAssignments.get(category.cate_uuid) ?? [],
        }))
        .filter((category) => category.value),
    [categories, categoryAssignments, language],
  );
  const zoneOptions = useMemo(
    () =>
      zones
        .map((zone) => ({
          label: zoneLabel(zone, language),
          value: zone.zone_uuid,
          assignedTo: zoneAssignments.get(zone.zone_uuid) ?? [],
        }))
        .filter((zone) => zone.value),
    [zones, zoneAssignments, language],
  );

  // seed จาก store ที่อาจมีข้อมูลค้างอยู่แล้วตั้งแต่ render แรก (เข้าจากหน้า list)
  // แทนที่ effect เดิมซึ่ง setState หลัง mount — ผลลัพธ์เท่ากันแต่ไม่มี cascading render
  const [initialForm] = useState(() =>
    initialPrinterFormValues(editing, agent, isEditing),
  );
  const [connectType, setConnectType] = useState<ConnectType>(
    initialForm.connectType,
  );
  const [displayName, setDisplayName] = useState(initialForm.displayName);
  const [interfaceValue, setInterfaceValue] = useState(
    initialForm.interfaceValue,
  );
  const [ip, setIp] = useState(initialForm.ip);
  const [port, setPort] = useState(initialForm.port);
  const [paperWidth, setPaperWidth] = useState(initialForm.paperWidth);
  const [kitchenCutMode, setKitchenCutMode] = useState<PrinterKitchenCutMode>(
    initialForm.kitchenCutMode,
  );
  const [cashDrawerEnabled, setCashDrawerEnabled] = useState(
    initialForm.cashDrawerEnabled,
  );
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    initialForm.selectedRoles,
  );
  const [mappingType, setMappingType] = useState<PrinterMappingType>(
    initialForm.mappingType,
  );
  const [sharingMode, setSharingMode] = useState<PrinterSharingMode>(
    initialForm.sharingMode,
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialForm.selectedCategories,
  );
  const [selectedZones, setSelectedZones] = useState<string[]>(
    initialForm.selectedZones,
  );
  const [selectedDevice, setSelectedDevice] = useState(
    initialForm.selectedDevice,
  );
  const [agentUrl, setAgentUrl] = useState(initialForm.agentUrl);
  const [agentId, setAgentId] = useState(initialForm.agentId);
  const [agentName, setAgentName] = useState(initialForm.agentName);
  const [deviceCode, setDeviceCode] = useState(initialForm.deviceCode);
  // ผลค้นหา USB ที่ค้างอยู่ใน store ถือว่าค้นหาเสร็จแล้ว (เดิมเป็น effect ที่ทำงานตอน mount)
  const [usbSearchComplete, setUsbSearchComplete] = useState(
    () => initialForm.connectType === "usb" && found.length > 0,
  );
  const [usbSearchError, setUsbSearchError] = useState("");
  const autoUsbSearchDone = useRef(false);

  const fillAgent = useCallback((nextAgent: AgentInfo, nextAgentUrl = AGENT_URL) => {
    setAgentUrl(
      isBrowserPrinterAgentId(nextAgent.agent_id)
        ? BROWSER_PRINTER_AGENT_URL
        : nextAgentUrl,
    );
    setAgentId(textValue(nextAgent.agent_id));
    setAgentName(textValue(nextAgent.agent_name));
    setDeviceCode(textValue(nextAgent.device_code));
  }, []);

  // ดึง uuid ออกมาเป็นตัวแปรก่อน เพราะถ้าอ้าง user?.uuid ภายใน callback
  // React Compiler จะ infer dependency เป็น object `user` ทั้งก้อน ไม่ตรงกับ dependency array
  const userUuid = user?.uuid;

  const loadFormData = useCallback(async () => {
    if (!userUuid) return;
    try {
      await Promise.all([
        loadPrintersForLocalAgent({ login_uuid_fk: userUuid, lang: language }),
        loadRoles(language),
        storeUuid ? loadCategories(language, storeUuid) : Promise.resolve([]),
        loadZones(language, branchUuid),
      ]);
    } catch (error) {
      showToast({
        title: t("printer.loadFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    }
  }, [
    branchUuid,
    language,
    loadCategories,
    loadPrintersForLocalAgent,
    loadRoles,
    loadZones,
    showToast,
    storeUuid,
    t,
    userUuid,
  ]);

  useEffect(() => {
    void loadFormData();
  }, [loadFormData]);

  // เติมฟอร์มใหม่เมื่อเรคคอร์ดที่แก้ไขเปลี่ยน (เช่น รายการเครื่องพิมพ์เพิ่งโหลดเสร็จ)
  // ทำระหว่าง render เพื่อไม่ให้ผู้ใช้เห็นค่าเก่าแวบหนึ่งก่อน effect จะทำงาน
  // (กรณี mount ถูกครอบคลุมโดย initialForm ด้านบนแล้ว)
  useResetOnDeps([editing, isEditing], () => {
    if (isEditing && !editing) return;

    const values = printerFormValues(editing);
    setConnectType(values.connectType);
    setDisplayName(values.displayName);
    setInterfaceValue(values.interfaceValue);
    setIp(values.ip);
    setPort(values.port);
    setPaperWidth(values.paperWidth);
    setKitchenCutMode(kitchenCutModeOf(editing));
    setCashDrawerEnabled(cashDrawerEnabledOf(editing));
    setSelectedRoles(values.selectedRoles);
    setMappingType(values.mappingType);
    setSharingMode(values.sharingMode);
    setSelectedCategories(values.selectedCategories);
    setSelectedZones(values.selectedZones);
    setSelectedDevice(values.selectedDevice);
    setAgentUrl(values.agentUrl);
    setAgentId(values.agentId);
    setAgentName(values.agentName);
    setDeviceCode(values.deviceCode);
  });

  // agent จาก store มาแบบ async — เติมเฉพาะช่องที่ยังว่าง ไม่ทับค่าจากเรคคอร์ดหรือที่ผู้ใช้เลือกไว้
  // ต้องอยู่หลัง reset ของ editing เสมอ เพราะ functional updater ต้องเห็นค่าที่ reset เพิ่งตั้ง
  useResetOnDeps([agent, isEditing], () => {
    if (!agent || isEditing) return;
    const nextAgentId = textValue(agent.agent_id);
    const nextAgentName = textValue(agent.agent_name);
    const nextDeviceCode = textValue(agent.device_code);
    setAgentUrl((value) => value || AGENT_URL);
    setAgentId((value) => value || nextAgentId);
    setAgentName((value) => value || nextAgentName);
    setDeviceCode((value) => value || nextDeviceCode);
  });

  // แนะนำโซน/หมวดหมู่เริ่มต้นตาม role ที่เลือก (backend ส่ง is_default มาให้) — เฉพาะตอนเพิ่ม
  // เครื่องพิมพ์ใหม่เท่านั้น (แก้ไขเครื่องเดิมใช้ค่าที่บันทึกไว้แล้วเสมอ) และเติมเฉพาะช่องที่ผู้ใช้
  // ยังไม่เลือกอะไรเลย ไม่ทับค่าที่ผู้ใช้ติ๊กเองไปแล้ว — ผิดพลาดแบบเงียบได้ เพราะเป็นแค่ suggestion เสริม
  useEffect(() => {
    if (isEditing || !userUuid || !selectedRoles.length) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await getDefaultCategoryByRole({
          login_uuid_fk: userUuid,
          role_codes: selectedRoles,
          mapping_type: mappingType,
          lang: language,
        });
        if (cancelled) return;
        const groups = response.data?.groups ?? [];
        const zoneGroup = groups.find((group) => group.mapping_type === "ZONE");
        const categoryGroup = groups.find(
          (group) => group.mapping_type === "CATEGORY",
        );
        if (zoneGroup) {
          setSelectedZones((current) =>
            current.length
              ? current
              : zoneGroup.details
                  .filter(
                    (detail): detail is DefaultCategoryZoneDetail =>
                      "zone_uuid" in detail && detail.is_default,
                  )
                  .map((detail) => detail.zone_uuid),
          );
        }
        if (categoryGroup) {
          setSelectedCategories((current) =>
            current.length
              ? current
              : categoryGroup.details
                  .filter(
                    (detail): detail is DefaultCategoryCategoryDetail =>
                      "cate_uuid" in detail && detail.is_default,
                  )
                  .map((detail) => detail.cate_uuid),
          );
        }
      } catch {
        // เงียบ — เป็นแค่ suggestion เสริม ไม่คุ้มที่จะโชว์ error รบกวนผู้ใช้
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    getDefaultCategoryByRole,
    isEditing,
    language,
    mappingType,
    selectedRoles,
    userUuid,
  ]);

  const hasAgentIdentity =
    Boolean(agentUrl.trim()) &&
    Boolean(agentId.trim()) &&
    Boolean(agentName.trim()) &&
    Boolean(deviceCode.trim());
  // เก็บเหตุผลที่ยังกดบันทึกไม่ได้ไว้เป็นรายการ แทนที่จะรู้แค่ boolean เดียว — ผู้ใช้ที่เลื่อนหน้าจอ
  // มาเจอปุ่ม Save ที่ถูก disable โดยไม่เห็น badge สีแดงด้านบนแล้ว จะได้รู้ว่าขาดอะไรบ้างจริงๆ
  const missingFields: string[] = [];
  if (!displayName.trim()) missingFields.push(t("printer.validationDisplayName"));
  if (selectedRoles.length === 0) missingFields.push(t("printer.validationRoles"));
  if (selectedCategories.length === 0) missingFields.push(t("printer.validationCategories"));
  // backend บังคับ: ZONE ต้องเลือกทั้งโซนและหมวดหมู่คู่กัน
  if (mappingType === "ZONE" && selectedZones.length === 0) missingFields.push(t("printer.validationZones"));
  if (connectType === "usb") {
    if (!interfaceValue.trim() || !hasAgentIdentity) missingFields.push(t("printer.validationUsbDevice"));
  } else if (!ip.trim()) {
    missingFields.push(t("printer.validationIp"));
  }
  const canSubmit = missingFields.length === 0;
  const validationMessage = missingFields.length
    ? t("printer.validationSummary", { fields: missingFields.join(", ") })
    : "";

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

  // ส่วน sync: สถานะข้อความใต้ dropdown ขึ้นกับโหมดเชื่อมต่อและผลค้นหาเท่านั้น
  useResetOnDeps([connectType, found.length], () => {
    if (connectType !== "usb") {
      setUsbSearchComplete(false);
      setUsbSearchError("");
      return;
    }
    if (found.length) setUsbSearchComplete(true);
  });

  // ส่วน async: ยิงค้นหา USB อัตโนมัติครั้งเดียวต่อการเข้าโหมด usb
  // (เก็บ ref ไว้ใน effect เท่านั้น จะได้ไม่เขียน ref ระหว่าง render)
  useEffect(() => {
    if (connectType !== "usb") {
      autoUsbSearchDone.current = false;
      return;
    }
    if (found.length) return;
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
    if (agent) fillAgent(agent, agentUrl.trim() || AGENT_URL);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.uuid || !canSubmit) return;

    try {
      const identity = await resolveDeviceIdentity(agentUrl.trim() || AGENT_URL);
      const nextAgentId = textValue(identity.agent_id).trim();
      const nextAgentName = textValue(identity.agent_name).trim();
      const nextDeviceCode = textValue(identity.device_code).trim();
      const nextPort = Number(port || 9100);
      const nextInterfaceValue =
        connectType === "tcp"
          ? tcpInterfaceValue(ip.trim(), nextPort)
          : interfaceValue.trim();

      const nextAgentUrl = isBrowserPrinterAgentId(nextAgentId)
        ? BROWSER_PRINTER_AGENT_URL
        : agentUrl.trim() || AGENT_URL;

      fillAgent(identity, nextAgentUrl);

      await savePrinter({
        print_config_uuid: printConfigUuid,
        login_uuid_fk: user.uuid,
        display_name: displayName.trim(),
        connect_type: connectType,
        ip: ip.trim(),
        port: nextPort,
        interface_value: nextInterfaceValue,
        paper_width_mm: Number(paperWidth || 80),
        kitchen_cut_mode: kitchenCutMode,
        cash_drawer_enabled: cashDrawerEnabled,
        role_codes: selectedRoles,
        // backend บังคับ: ZONE ส่งทั้งโซนและหมวดหมู่ที่เลือกไว้, CATEGORY ส่งแค่หมวดหมู่
        // savePrinter() ใน config-api.ts เป็นจุดที่ตัด zone_uuid_fk ออกเมื่อไม่ใช่ ZONE
        mapping_type: mappingType,
        sharing_mode: sharingMode,
        zone_uuid_fk: selectedZones,
        cate_uuid_fk: selectedCategories,
        agent_url: nextAgentUrl,
        agent_id: nextAgentId,
        agent_name: nextAgentName,
        device_code: nextDeviceCode,
      });
      showToast({ title: t("printer.saved"), tone: "success" });
      router.push("/printers");
    } catch (error) {
      showToast({
        title: t("printer.saveFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    }
  }

  return {
    t,
    isEditing,
    loading,
    saving,
    searching,
    found,
    roleOptions,
    mappingType,
    setMappingType,
    sharingMode,
    setSharingMode,
    categoryOptions,
    zoneOptions,
    connectType,
    setConnectType,
    displayName,
    setDisplayName,
    interfaceValue,
    setInterfaceValue,
    ip,
    setIp,
    port,
    setPort,
    paperWidth,
    setPaperWidth,
    kitchenCutMode,
    setKitchenCutMode,
    cashDrawerEnabled,
    setCashDrawerEnabled,
    selectedRoles,
    setSelectedRoles,
    selectedCategories,
    setSelectedCategories,
    selectedZones,
    setSelectedZones,
    selectedDevice,
    usbSelectDescription,
    canSubmit,
    validationMessage,
    selectDevice,
    searchUsbDevices,
    submit,
    router,
  };
}

export type PrinterFormWorkflow = ReturnType<typeof usePrinterForm>;
