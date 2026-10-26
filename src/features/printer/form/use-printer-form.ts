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
import { printerPrintModeForPlatform } from "@/lib/printer-platform";
import { isCapacitorMobileApp } from "@/lib/capacitor-platform";
import type {
  AgentInfo,
  DefaultCategoryZoneDetail,
  PrinterKitchenCutMode,
  PrinterAccessMode,
  PrinterPrintRoleMode,
  PrinterCategoryPrintPermission,
} from "@/services/printer";
import type { Zone } from "@/services/zone";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useToastStore } from "@/stores/toast-store";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import { usePrinterSelfTest } from "@/features/printer/use-printer-self-test";
import {
  arraysHaveSameValues,
  applyDefaultPrinterCategories,
  assignedPrinterNamesByValue,
  buzzerOnCutOf,
  cashDrawerEnabledOf,
  categoryLabel,
  categoryPrintPermission,
  categoryPrintPermissionsEqual,
  categoryPrintPermissionsForCategories,
  employeeRoleLabel,
  printRoleSettingsValidation,
  cutFeedLinesOf,
  initialPrinterFormValues,
  kitchenCutModeOf,
  mappingTypeOf,
  mergeUsbPrinterOptions,
  printerFormValues,
  printerSelfTestTarget,
  requiresZoneMapping,
  selectCategoryForPrintPermission,
  shouldResolveCurrentPrinterIdentity,
  textValue,
  toggleCategoryPrintRole,
  updateCategoryPrintPermission,
  zoneLabel,
  type ConnectType,
  type MappingTypeSelection,
  type PrinterFormCategories,
} from "./printer-form-utils";

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
  const employeeRoles = usePrinterStore((state) => state.employeeRoles);
  const loadingEmployeeRoles = usePrinterStore((state) => state.loadingEmployeeRoles);
  const employeeRolesLoaded = usePrinterStore((state) => state.employeeRolesLoaded);
  const employeeRolesError = usePrinterStore((state) => state.employeeRolesError);
  const loadEmployeeRoles = usePrinterStore((state) => state.loadEmployeeRoles);
  const agent = usePrinterStore((state) => state.agent);
  const loading = usePrinterStore((state) => state.loading);
  const searching = usePrinterStore((state) => state.searching);
  const saving = usePrinterStore((state) => state.saving);
  const {
    printing, pendingSelfTest, runSelfTest, completeSelfTest,
    selfTestSelection, selfTestProfile, setSelfTestProfile, confirmSelfTest, cancelSelfTest,
    selfTestPhase, selfTestError, checkSelfTest,
  } = usePrinterSelfTest();
  const internetSettings = usePrinterStore((state) => state.internetPrintSettings);
  const loadingInternetSettings = usePrinterStore((state) => state.loadingInternetPrintSettings);
  const loadInternetSettings = usePrinterStore((state) => state.loadInternetPrintSettings);
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
  const loadCategories = useReferenceStore((state) => state.loadCategories);
  // Keep this form's scoped result; the shared options may belong to another screen/store.
  const [loadedCategories, setLoadedCategories] = useState<PrinterFormCategories | null>(null);
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
      (loadedCategories?.storeUuid === storeUuid ? loadedCategories.categories : [])
        .map((category) => ({
          label: categoryLabel(category, language),
          value: category.cate_uuid,
          assignedTo: categoryAssignments.get(category.cate_uuid) ?? [],
        }))
        .filter((category) => category.value),
    [loadedCategories, storeUuid, categoryAssignments, language],
  );
  const employeeRoleOptions = useMemo(
    () => employeeRoles.map((role) => ({
      value: Number(role.roles_id),
      label: employeeRoleLabel(role, language),
    })).filter((role) => Number.isInteger(role.value) && role.value > 0),
    [employeeRoles, language],
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
  const [queueTicketEnabled, setQueueTicketEnabled] = useState(initialForm.queueTicketEnabled);
  const [printShowLogo, setPrintShowLogo] = useState(initialForm.printShowLogo);
  const [buzzerOnCut, setBuzzerOnCut] = useState(initialForm.buzzerOnCut);
  const [cutFeedLines, setCutFeedLines] = useState(initialForm.cutFeedLines);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    initialForm.selectedRoles,
  );
  const [selectedMappingType, setMappingType] = useState<MappingTypeSelection>(
    initialForm.mappingType,
  );
  const [accessMode, setAccessMode] = useState<PrinterAccessMode>(
    initialForm.accessMode,
  );
  useResetOnDeps([connectType], () => {
    if (connectType === "usb") setAccessMode("DIRECT");
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialForm.selectedCategories,
  );
  const [printRoleMode, setPrintRoleMode] = useState<PrinterPrintRoleMode>(initialForm.printRoleMode);
  const [categoryPrintPermissions, setCategoryPrintPermissions] = useState<PrinterCategoryPrintPermission[]>(
    initialForm.categoryPrintPermissions,
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
  const [formDataLoaded, setFormDataLoaded] = useState(false);
  const autoUsbSearchDone = useRef(false);
  // เก็บค่าอ้างอิงล่าสุดที่มาจากแหล่งข้อมูลจริง (ไม่ใช่ที่ผู้ใช้พิมพ์/ติ๊ก) ไว้เทียบหา isDirty —
  // ต้องอัปเดตพร้อมกับ reset ด้านล่างเสมอ (เป็น state ไม่ใช่ ref เพราะ react-hooks/refs ห้ามอ่าน
  // ref.current ระหว่าง render) ไม่งั้นตอนข้อมูลเรคคอร์ดเพิ่งโหลดเสร็จ (เช่น reload หน้าแก้ไขตรงๆ)
  // จะเทียบกับ initialForm ที่ยังว่างอยู่ แล้วเข้าใจผิดว่าฟอร์ม dirty ทั้งที่ผู้ใช้ยังไม่ได้แตะอะไรเลย
  const [baseline, setBaseline] = useState(initialForm);
  const usbOptions = useMemo(
    () => mergeUsbPrinterOptions(found, interfaceValue, displayName),
    [displayName, found, interfaceValue],
  );
  const savedUsbUnavailable = Boolean(
    isEditing &&
    connectType === "usb" &&
    interfaceValue.trim() &&
    !found.some((item) => item.interface_value === interfaceValue.trim()),
  );
  const selectedCategoryPrintPermissions = categoryPrintPermissionsForCategories(
    selectedCategories, categoryPrintPermissions,
  );
  const permissionCategoryOptions = selectedCategories.map((uuid) =>
    categoryOptions.find((category) => category.value === uuid) ?? { value: uuid, label: uuid },
  );
  const reloadEmployeeRoles = useCallback(
    () => loadEmployeeRoles(language),
    [language, loadEmployeeRoles],
  );
  useEffect(() => {
    if (printRoleMode !== 2 || !user?.uuid) return;
    void reloadEmployeeRoles().catch(() => undefined);
  }, [printRoleMode, reloadEmployeeRoles, user?.uuid]);

  function togglePrintRole(categoryUuid: string, roleId: number) {
    setSelectedCategories((current) => selectCategoryForPrintPermission(current, categoryUuid));
    setCategoryPrintPermissions((current) => toggleCategoryPrintRole(current, categoryUuid, roleId));
  }

  function setAllPrintRoles(categoryUuid: string, allRoles: boolean) {
    setSelectedCategories((current) => selectCategoryForPrintPermission(current, categoryUuid));
    setCategoryPrintPermissions((current) => updateCategoryPrintPermission(current, {
      ...categoryPrintPermission(current, categoryUuid),
      all_roles: allRoles,
      allowed_role_ids: [],
    }));
  }

  // เครื่องพิมพ์ครัว/บาร์มักผูกกับโซน — พอเพิ่งเลือก role พวกนี้ (ตอนยังเป็น "ปิด") แนะนำสลับเป็น ZONE
  // ให้อัตโนมัติ, พอเอา role ครัว/บาร์ออกจนไม่เหลือเลย ก็สลับกลับเป็น "ปิด" ให้เช่นกัน — ทั้งสองทิศทาง
  // ทำแค่ตอน "เพิ่ง" เปลี่ยนสถานะเท่านั้น (ดู current ก่อน set) เพื่อไม่ทับค่าที่ผู้ใช้เปลี่ยนเป็นหมวดหมู่เอง
  // ใช้ useResetOnDeps (ทำระหว่าง render) แทน useEffect เพราะ dependency เป็น boolean ไม่ใช่
  // selectedRoles ตรงๆ จึงยิงเฉพาะตอน "เพิ่ง" กลายเป็น true/false เท่านั้น — setState ตรงๆ ใน effect ต้องห้าม
  const zoneMappingRequired = requiresZoneMapping(selectedRoles);
  useResetOnDeps([zoneMappingRequired], () => {
    setMappingType((current) => {
      if (zoneMappingRequired) return current === "OFF" ? "ZONE" : current;
      return current === "ZONE" ? "OFF" : current;
    });
  });
  // ขั้นที่ 3 (ผูกโซน/หมวดหมู่) แสดงเฉพาะตอนมี role ครัว/บาร์ — ไม่มีก็ถือว่า "ปิด" เสมอ ทั้งตอน
  // ตรวจความครบถ้วนและตอนบันทึก เพื่อไม่ให้หมวดหมู่ที่มองไม่เห็นแล้วถูกส่งไปค้างที่ backend
  // (เช่นเครื่องเดิมที่เคยตั้ง CATEGORY ไว้กับใบเสร็จ) ส่วนค่าที่ผู้ใช้เลือกยังเก็บไว้ ถ้าติ๊ก role
  // ครัว/บาร์กลับมา ขั้นที่ 3 จะแสดงค่าเดิม
  const mappingType: MappingTypeSelection = zoneMappingRequired ? selectedMappingType : "OFF";

  const fillAgent = useCallback((nextAgent: AgentInfo, nextAgentUrl?: string) => {
    setAgentUrl(
      isBrowserPrinterAgentId(nextAgent.agent_id)
        ? BROWSER_PRINTER_AGENT_URL
        : textValue(nextAgent.agent_url) || nextAgentUrl || AGENT_URL,
    );
    setAgentId(textValue(nextAgent.agent_id));
    setAgentName(textValue(nextAgent.agent_name));
    setDeviceCode(textValue(nextAgent.device_code));
  }, []);

  // ดึง uuid ออกมาเป็นตัวแปรก่อน เพราะถ้าอ้าง user?.uuid ภายใน callback
  // React Compiler จะ infer dependency เป็น object `user` ทั้งก้อน ไม่ตรงกับ dependency array
  const userUuid = user?.uuid;

  const loadFormData = useCallback(async (isCurrent: () => boolean) => {
    if (!userUuid) return;
    try {
      await Promise.all([
        loadPrintersForLocalAgent({ login_uuid_fk: userUuid, lang: language }),
        loadRoles(language),
        loadInternetSettings(),
        storeUuid ? loadCategories(language, storeUuid).then((categories) => {
          if (isCurrent()) setLoadedCategories({ storeUuid, categories });
        }) : Promise.resolve(),
        loadZones(language, branchUuid),
      ]);
    } catch (error) {
      if (isCurrent()) {
        showToast({
          title: t("printer.loadFailed"),
          description: error instanceof Error ? error.message : "",
          tone: "error",
        });
      }
    } finally {
      if (isCurrent()) setFormDataLoaded(true);
    }
  }, [
    branchUuid,
    language,
    loadCategories,
    loadPrintersForLocalAgent,
    loadRoles,
    loadInternetSettings,
    loadZones,
    showToast,
    storeUuid,
    t,
    userUuid,
  ]);

  useEffect(() => {
    let cancelled = false;
    void loadFormData(() => !cancelled);
    return () => { cancelled = true; };
  }, [loadFormData]);

  // Hydrate once per record, including a record that arrives after mount.
  // Refreshing the list creates new objects; using `editing` as a reset key
  // discarded the user's USB connection, name, roles, and mapping edits.
  const formRecordKey = isEditing ? (editing?.print_config_uuid ?? null) : "";
  useResetOnDeps([formRecordKey], () => {
    if (isEditing && !editing) return;

    const values = printerFormValues(editing);
    setBaseline(values);
    setConnectType(values.connectType);
    setDisplayName(values.displayName);
    setInterfaceValue(values.interfaceValue);
    setIp(values.ip);
    setPort(values.port);
    setPaperWidth(values.paperWidth);
    setKitchenCutMode(kitchenCutModeOf(editing));
    setCashDrawerEnabled(cashDrawerEnabledOf(editing));
    setQueueTicketEnabled(values.queueTicketEnabled);
    setPrintShowLogo(values.printShowLogo);
    setBuzzerOnCut(buzzerOnCutOf(editing));
    setCutFeedLines(cutFeedLinesOf(editing));
    setSelectedRoles(values.selectedRoles);
    setMappingType(values.mappingType);
    setAccessMode(values.accessMode);
    setSelectedCategories(values.selectedCategories);
    setPrintRoleMode(values.printRoleMode);
    setCategoryPrintPermissions(values.categoryPrintPermissions);
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
    setAgentUrl((value) => textValue(agent.agent_url) || value || AGENT_URL);
    setAgentId((value) => value || nextAgentId);
    setAgentName((value) => value || nextAgentName);
    setDeviceCode((value) => value || nextDeviceCode);
  });

  // แนะนำโซน/หมวดหมู่เริ่มต้นตาม role ที่เลือก (backend ส่ง is_default มาให้) — เฉพาะตอนเพิ่ม
  // เครื่องพิมพ์ใหม่เท่านั้น (แก้ไขเครื่องเดิมใช้ค่าที่บันทึกไว้แล้วเสมอ) และเติมเฉพาะช่องที่ผู้ใช้
  // ยังไม่เลือกอะไรเลย ไม่ทับค่าที่ผู้ใช้ติ๊กเองไปแล้ว — ผิดพลาดแบบเงียบได้ เพราะเป็นแค่ suggestion เสริม
  useEffect(() => {
    if (isEditing || !userUuid || !selectedRoles.length || mappingType === "OFF" ||
      !storeUuid || loadedCategories?.storeUuid !== storeUuid) return;
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
            applyDefaultPrinterCategories(current, categoryGroup.details, storeUuid, loadedCategories),
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
    loadedCategories,
    mappingType,
    selectedRoles,
    storeUuid,
    userUuid,
  ]);

  const hasAgentIdentity =
    Boolean(agentUrl.trim()) &&
    Boolean(agentId.trim()) &&
    Boolean(agentName.trim()) &&
    Boolean(deviceCode.trim());
  const recordMissing = isEditing && formDataLoaded && !loading && !editing;
  const selfTestTarget = printerSelfTestTarget({
    connectType,
    interfaceValue,
    ip,
    port,
    availableUsbPrinters: found,
  });
  const canSelfTest = Boolean(selfTestTarget) && !pendingSelfTest && !recordMissing && !loading && !saving && !searching && !printing;

  async function printSelfTest() {
    if (!canSelfTest || !selfTestTarget) return;
    await runSelfTest(selfTestTarget);
  }

  // ใช้เตือนก่อนออกจากหน้าตอนกด "ยกเลิก" — ไม่รวม agent* / deviceCode เพราะฟิลด์เหล่านั้นถูกเติมเอง
  // จาก agent ที่ตรวจพบอัตโนมัติ (ดู fillAgent/useResetOnDeps ด้านบน) ไม่ใช่สิ่งที่ผู้ใช้แก้ไข
  // ถ้านับรวมด้วยจะกลายเป็น dirty เท็จตั้งแต่หน้ายังโหลดไม่ทันที่ผู้ใช้จะแตะอะไรเลย
  const isDirty =
    displayName !== baseline.displayName ||
    connectType !== baseline.connectType ||
    interfaceValue !== baseline.interfaceValue ||
    ip !== baseline.ip ||
    port !== baseline.port ||
    paperWidth !== baseline.paperWidth ||
    kitchenCutMode !== baseline.kitchenCutMode ||
    cashDrawerEnabled !== baseline.cashDrawerEnabled ||
    queueTicketEnabled !== baseline.queueTicketEnabled ||
    printShowLogo !== baseline.printShowLogo ||
    buzzerOnCut !== baseline.buzzerOnCut ||
    cutFeedLines !== baseline.cutFeedLines ||
    selectedMappingType !== baseline.mappingType ||
    accessMode !== baseline.accessMode ||
    selectedDevice !== baseline.selectedDevice ||
    !arraysHaveSameValues(selectedRoles, baseline.selectedRoles) ||
    printRoleMode !== baseline.printRoleMode ||
    !categoryPrintPermissionsEqual(
      selectedCategoryPrintPermissions,
      categoryPrintPermissionsForCategories(selectedCategories, baseline.categoryPrintPermissions),
    ) ||
    !arraysHaveSameValues(selectedCategories, baseline.selectedCategories) ||
    !arraysHaveSameValues(selectedZones, baseline.selectedZones);

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);
  // เก็บเหตุผลที่ยังกดบันทึกไม่ได้ไว้เป็นรายการ แทนที่จะรู้แค่ boolean เดียว — ผู้ใช้ที่เลื่อนหน้าจอ
  // มาเจอปุ่ม Save ที่ถูก disable โดยไม่เห็น badge สีแดงด้านบนแล้ว จะได้รู้ว่าขาดอะไรบ้างจริงๆ
  const missingFields: string[] = [];
  if (recordMissing) missingFields.push(t("printer.validationRecordMissing"));
  if (!displayName.trim()) missingFields.push(t("printer.validationDisplayName"));
  if (selectedRoles.length === 0) missingFields.push(t("printer.validationRoles"));
  const roleSettingsValidation = printRoleSettingsValidation(
    printRoleMode, mappingType, selectedCategories, categoryPrintPermissions,
    { loaded: employeeRolesLoaded, loading: loadingEmployeeRoles, error: employeeRolesError },
  );
  if (roleSettingsValidation.roleOptionsStatus === "loading") missingFields.push(t("printer.employeeRolesLoading"));
  if (roleSettingsValidation.roleOptionsStatus === "error") missingFields.push(t("printer.employeeRolesLoadFailed"));
  const invalidPermissionCategories = roleSettingsValidation.invalidCategoryUuids;
  if (invalidPermissionCategories.length) {
    missingFields.push(t("printer.validationPrintRoles", {
      categories: permissionCategoryOptions
        .filter((category) => invalidPermissionCategories.includes(category.value))
        .map((category) => category.label).join(", "),
    }));
  }
  // backend บังคับ: ZONE ต้องเลือกทั้งโซนและหมวดหมู่คู่กัน — CATEGORY (ค่าเริ่มต้น) ปล่อยว่างได้
  // เพื่อรองรับเครื่องพิมพ์ที่ไม่ผูกกับเมนู เช่น ใบเรียกเก็บเงิน/ใบเสร็จ/รายงาน
  if (mappingType === "ZONE") {
    if (selectedZones.length === 0) missingFields.push(t("printer.validationZones"));
    if (selectedCategories.length === 0) missingFields.push(t("printer.validationCategories"));
  }
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
        const result = await discoverPrinters("usb", showSuccess);
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
    if (savedUsbUnavailable) return t("printer.savedUsbUnavailable");
    if (found.length) return t("printer.deviceCount", { count: found.length });
    if (usbSearchComplete) return t("printer.noUsbPrinters");
    return t("printer.usbSearchPending");
  })();

  function selectDevice(interfaceValue: string) {
    const printer = usbOptions.find(
      (item) => item.interface_value === interfaceValue,
    );
    if (!printer) return;
    setSelectedDevice(interfaceValue);
    setConnectType("usb");
    setDisplayName((current) => current.trim() || textValue(printer.name));
    setInterfaceValue(textValue(printer.interface_value));
    if (agent) fillAgent(agent, agentUrl.trim() || AGENT_URL);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.uuid) return;
    if (!canSubmit) {
      showToast({
        title: t("printer.saveFailed"),
        description: validationMessage,
        tone: "error",
      });
      return;
    }

    try {
      const savedIdentityComplete = Boolean(
        agentId.trim() && agentName.trim() && deviceCode.trim(),
      );
      const shouldResolveCurrentIdentity = shouldResolveCurrentPrinterIdentity({
        isEditing,
        savedIdentityComplete,
        connectType,
        interfaceValue,
        savedInterfaceValue: baseline.interfaceValue,
      });
      // The saved/advertised LAN URL is for sharing. Resolve this terminal
      // through its configured Agent endpoint, as the initial discovery does.
      const identity: AgentInfo = shouldResolveCurrentIdentity
        ? await resolveDeviceIdentity()
        : {
            agent_id: agentId.trim(),
            agent_name: agentName.trim(),
            device_code: deviceCode.trim(),
          };
      if (
        shouldResolveCurrentIdentity &&
        isBrowserPrinterAgentId(identity.agent_id) &&
        !isCapacitorMobileApp()
      ) {
        throw new Error(t("printer.validationAgentRequired"));
      }
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
        : textValue(identity.agent_url) ||
          textValue(agent?.agent_url) ||
          agentUrl.trim() ||
          AGENT_URL;

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
        queue_ticket_enabled: queueTicketEnabled,
        print_show_logo: printShowLogo,
        buzzer_on_cut: buzzerOnCut,
        cut_feed_lines: cutFeedLines.trim() ? Number(cutFeedLines) : null,
        role_codes: selectedRoles,
        print_role_mode: printRoleMode,
        ...(mappingType === "OFF" ? {} : {
          category_print_permissions: selectedCategoryPrintPermissions,
        }),
        // "OFF" (ค่าเริ่มต้น ไม่ผูกกับเมนู) ต้องไม่ส่ง mapping_type เลย ไม่ใช่ส่งเป็นค่าใดค่าหนึ่ง —
        // backend บังคับ: ZONE ส่งทั้งโซนและหมวดหมู่ที่เลือกไว้, CATEGORY ส่งแค่หมวดหมู่
        // savePrinter() ใน config-api.ts เป็นจุดที่ตัด zone_uuid_fk/cate_uuid_fk ออกตาม mapping_type
        mapping_type: mappingType === "OFF" ? undefined : mappingType,
        sharing_mode: accessMode === "DIRECT" ? "DEDICATED" : "SHARED",
        access_mode: accessMode,
        zone_uuid_fk: selectedZones,
        cate_uuid_fk: selectedCategories,
        agent_url: nextAgentUrl,
        agent_id: nextAgentId,
        agent_name: nextAgentName,
        device_code: nextDeviceCode,
        // ชื่อ agent เป็นชื่อที่ผู้ใช้ตั้งเอง จึงเดา OS จาก agent_id ไม่ได้
        // ใช้ platform ที่ Agent รายงานมาเพื่อไม่ให้ Windows TCP ถูกบันทึกเป็น mobile_wifi
        print_mode: shouldResolveCurrentIdentity
          ? printerPrintModeForPlatform(
              identity.platform,
              isCapacitorMobileApp(),
            )
          : editing?.print_mode,
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
    isDirty,
    loading,
    saving,
    printing,
    canSelfTest,
    printSelfTest,
    pendingSelfTest,
    completeSelfTest,
    selfTestSelection, selfTestProfile, setSelfTestProfile, confirmSelfTest, cancelSelfTest,
    selfTestPhase, selfTestError, checkSelfTest,
    searching,
    found,
    usbOptions,
    roleOptions,
    employeeRoleOptions,
    loadingEmployeeRoles,
    employeeRolesLoaded,
    employeeRolesError,
    reloadEmployeeRoles,
    printRoleMode,
    setPrintRoleMode,
    permissionCategoryOptions,
    categoryPrintPermissions,
    selectedCategoryPrintPermissions,
    togglePrintRole,
    setAllPrintRoles,
    mappingType,
    setMappingType,
    zoneMappingRequired,
    accessMode,
    setAccessMode,
    internetSettings,
    loadingInternetSettings,
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
    queueTicketEnabled,
    setQueueTicketEnabled,
    printShowLogo,
    setPrintShowLogo,
    showQueueTicketOption: user?.store_table_status === 2,
    buzzerOnCut,
    setBuzzerOnCut,
    cutFeedLines,
    setCutFeedLines,
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
    recordMissing,
    selectDevice,
    searchUsbDevices,
    submit,
    router,
  };
}

export type PrinterFormWorkflow = ReturnType<typeof usePrinterForm>;
