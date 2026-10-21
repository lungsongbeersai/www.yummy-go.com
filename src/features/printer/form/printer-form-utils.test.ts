import { describe, expect, it } from "vitest";
import {
  arraysHaveSameValues,
  applyDefaultPrinterCategories,
  cashDrawerEnabledOf,
  formatIpInput,
  initialPrinterFormValues,
  kitchenCutModeOf,
  mergeUsbPrinterOptions,
  printerFormValues,
  printerSelfTestTarget,
  requiresZoneMapping,
  shouldResolveCurrentPrinterIdentity,
  sharingModeOf,
  accessModeOf,
  categoryPrintPermission,
  categoryPrintPermissionsEqual,
  categoryPrintPermissionsForCategories,
  employeeRoleLabel,
  invalidPrintPermissionCategories,
  printRoleSettingsValidation,
  selectCategoryForPrintPermission,
  toggleCategoryPrintRole,
  updateCategoryPrintPermission,
} from "@/features/printer/form/printer-form-utils";
import type { DefaultCategoryGroupDetail, Printer, PrinterCategoryPrintPermission } from "@/services/printer";

describe("printerSelfTestTarget", () => {
  const form = {
    connectType: "tcp" as const,
    ip: "192.168.100.75",
    port: "9100",
    interfaceValue: "tcp://192.168.100.20:9100",
    availableUsbPrinters: [],
  };

  it("uses the current unsaved IP and port, without requiring roles or a name", () => {
    expect(printerSelfTestTarget({ ...form, port: "9200" })).toEqual({
      connect_type: "tcp",
      interface_value: "tcp://192.168.100.75:9200",
    });
    expect(printerSelfTestTarget({ ...form, port: "" })?.interface_value).toBe(
      "tcp://192.168.100.75:9100",
    );
  });

  it.each(["", "192.168", "192.168.1.256", "192.168..1"])("requires a complete valid IP: %s", (ip) => {
    expect(printerSelfTestTarget({ ...form, ip })).toBeNull();
  });

  it.each(["0", "65536", "9100.5", "invalid"])("rejects invalid ports: %s", (port) => {
    expect(printerSelfTestTarget({ ...form, port })).toBeNull();
  });

  it("cannot send a saved USB queue to another computer with the same queue name", () => {
    expect(printerSelfTestTarget({ ...form, connectType: "usb", interfaceValue: "cups:Receipt" })).toBeNull();
  });

  it("allows a USB printer discovered on this device even when its IP is unknown", () => {
    expect(printerSelfTestTarget({
      ...form,
      connectType: "usb",
      ip: "",
      interfaceValue: "win:XP-80",
      availableUsbPrinters: [{ name: "XP-80", interface_value: "win:XP-80", platform: "win32" }],
    })).toEqual({ connect_type: "usb", interface_value: "win:XP-80" });
  });
});

describe("formatIpInput", () => {
  it("auto-inserts a dot after every 3 digits while typing forward", () => {
    let value = "";
    for (const key of "192168".split("")) {
      value = formatIpInput(value + key, value);
    }
    expect(value).toBe("192.168.");
  });

  it("builds up to the full example address by incremental typing", () => {
    const keystrokes = "192168100.77".split("");
    let value = "";
    for (const key of keystrokes) {
      value = formatIpInput(value + key, value);
    }
    expect(value).toBe("192.168.100.77");
  });

  it("strips characters other than digits and dots", () => {
    expect(formatIpInput("192a.168b.100c.77d", "")).toBe("192.168.100.77");
  });

  it("collapses consecutive dots and drops a leading dot", () => {
    expect(formatIpInput(".192..168", "")).toBe("192.168.");
  });

  it("caps at 4 octets and ignores extra digits/dots", () => {
    expect(formatIpInput("192.168.100.255.99", "")).toBe("192.168.100.255");
    expect(formatIpInput("192.168.100.2559", "192.168.100.255")).toBe(
      "192.168.100.255",
    );
  });

  it("does not re-insert a trailing dot while deleting", () => {
    expect(formatIpInput("192", "192.")).toBe("192");
    expect(formatIpInput("192.", "192.1")).toBe("192.");
  });

  it("keeps an explicit short octet followed by a user-typed dot", () => {
    expect(formatIpInput("19.", "19")).toBe("19.");
  });
});

describe("cashDrawerEnabledOf", () => {
  it("keeps the legacy default enabled", () => {
    expect(cashDrawerEnabledOf(null)).toBe(true);
    expect(cashDrawerEnabledOf({} as never)).toBe(true);
  });

  it("restores an explicitly disabled cash drawer", () => {
    expect(cashDrawerEnabledOf({ cash_drawer_enabled: false } as never)).toBe(false);
  });
});

describe("kitchenCutModeOf", () => {
  it("keeps the legacy default as cutting every kitchen ticket", () => {
    expect(kitchenCutModeOf(null)).toBe("per_ticket");
    expect(kitchenCutModeOf({} as never)).toBe("per_ticket");
  });

  it("restores a saved no-cut printer setting", () => {
    expect(kitchenCutModeOf({ kitchen_cut_mode: "none" } as never)).toBe("none");
  });
});

describe("requiresZoneMapping", () => {
  it("requires zone mapping for numbered kitchen (k-*) and bar (b-*) station roles", () => {
    expect(requiresZoneMapping(["k-001"])).toBe(true);
    expect(requiresZoneMapping(["k-002"])).toBe(true);
    expect(requiresZoneMapping(["b-001"])).toBe(true);
    expect(requiresZoneMapping(["b-002"])).toBe(true);
    expect(requiresZoneMapping(["invoice", "b-001"])).toBe(true);
  });

  it("does not require zone mapping for invoice/receipt/QR-order/report-only roles", () => {
    expect(requiresZoneMapping(["invoice", "receipt"])).toBe(false);
    expect(requiresZoneMapping(["q-001"])).toBe(false);
    expect(requiresZoneMapping(["report"])).toBe(false);
    expect(requiresZoneMapping([])).toBe(false);
  });
});

describe("arraysHaveSameValues", () => {
  it("ignores order", () => {
    expect(arraysHaveSameValues(["a", "b"], ["b", "a"])).toBe(true);
  });

  it("detects a real difference in the selected set", () => {
    expect(arraysHaveSameValues(["a", "b"], ["a", "c"])).toBe(false);
    expect(arraysHaveSameValues(["a"], ["a", "b"])).toBe(false);
  });
});

describe("applyDefaultPrinterCategories", () => {
  const details: DefaultCategoryGroupDetail[] = [
    { cate_uuid: "food", is_default: true },
    { cate_uuid: "foreign-drinks", is_default: true },
    { cate_uuid: "drinks", is_default: false },
    { cate_uuid: "food", is_default: true },
    { zone_uuid: "zone", is_default: true },
  ];
  const loadedCategories = {
    storeUuid: "current-store",
    categories: [{ cate_uuid: "food" }, { cate_uuid: "drinks" }],
  };

  it("selects only distinct suggested categories available in the current store", () => {
    expect(applyDefaultPrinterCategories([], details, "current-store", loadedCategories)).toEqual(["food"]);
  });

  it("waits for the current store's categories, including when a previous store is loaded", () => {
    expect(applyDefaultPrinterCategories([], details, "current-store", null)).toEqual([]);
    expect(applyDefaultPrinterCategories([], details, "other-store", loadedCategories)).toEqual([]);
    expect(applyDefaultPrinterCategories([], details, "", loadedCategories)).toEqual([]);
    expect(applyDefaultPrinterCategories([], details, "current-store", loadedCategories)).toEqual(["food"]);
  });

  it("keeps manual or saved selections even when absent from the available options", () => {
    const selected = ["drinks", "saved-category"];
    expect(applyDefaultPrinterCategories(selected, details, "current-store", loadedCategories)).toBe(selected);
    expect(applyDefaultPrinterCategories(selected, details, "current-store", null)).toBe(selected);
  });

  it("leaves an empty selection when the store has no available categories", () => {
    expect(applyDefaultPrinterCategories([], details, "current-store", {
      storeUuid: "current-store", categories: [],
    })).toEqual([]);
  });
});

describe("mergeUsbPrinterOptions", () => {
  it("keeps a saved USB printer selectable when it is temporarily not discovered", () => {
    expect(
      mergeUsbPrinterOptions(
        [
          {
            name: "Counter",
            interface_value: "win:Counter",
            platform: "windows",
          },
        ],
        "win:Kitchen",
        "Kitchen printer",
      ),
    ).toEqual([
      {
        name: "Kitchen printer",
        interface_value: "win:Kitchen",
        platform: "saved",
      },
      {
        name: "Counter",
        interface_value: "win:Counter",
        platform: "windows",
      },
    ]);
  });

  it("does not duplicate a saved printer that discovery returned", () => {
    const discovered = [
      {
        name: "Kitchen",
        interface_value: "win:Kitchen",
        platform: "windows",
      },
    ];

    expect(
      mergeUsbPrinterOptions(discovered, "win:Kitchen", "Kitchen printer"),
    ).toBe(discovered);
  });
});

describe("printerFormValues", () => {
  it("restores the saved USB device as the selected option", () => {
    expect(
      printerFormValues({
        print_config_uuid: "printer-1",
        printer_name: "Kitchen",
        connect_type: "usb",
        interface_value: "win:Kitchen",
        paper_width_mm: 80,
        is_active: true,
        role_codes: ["k-001"],
        cate_uuid_fk: ["category-1"],
      }).selectedDevice,
    ).toBe("win:Kitchen");
  });

  it("uses the Agent LAN URL for a new shared-printer owner", () => {
    expect(
      initialPrinterFormValues(
        null,
        {
          agent_id: "owner-agent",
          agent_name: "Owner POS",
          device_code: "OWNER-PC",
          agent_url: "http://192.168.100.20:7777",
        },
        false,
      ).agentUrl,
    ).toBe("http://192.168.100.20:7777");
  });
});

describe("shouldResolveCurrentPrinterIdentity", () => {
  it("preserves the saved owner identity during ordinary edits", () => {
    expect(
      shouldResolveCurrentPrinterIdentity({
        isEditing: true,
        savedIdentityComplete: true,
        connectType: "tcp",
        interfaceValue: "",
        savedInterfaceValue: "",
      }),
    ).toBe(false);
    expect(
      shouldResolveCurrentPrinterIdentity({
        isEditing: true,
        savedIdentityComplete: true,
        connectType: "usb",
        interfaceValue: "win:Kitchen",
        savedInterfaceValue: "win:Kitchen",
      }),
    ).toBe(false);
  });

  it("resolves the current Agent for a new printer or a changed USB device", () => {
    expect(
      shouldResolveCurrentPrinterIdentity({
        isEditing: false,
        savedIdentityComplete: false,
        connectType: "tcp",
        interfaceValue: "",
        savedInterfaceValue: "",
      }),
    ).toBe(true);
    expect(
      shouldResolveCurrentPrinterIdentity({
        isEditing: true,
        savedIdentityComplete: true,
        connectType: "usb",
        interfaceValue: "win:Counter",
        savedInterfaceValue: "win:Kitchen",
      }),
    ).toBe(true);
  });
});

describe("queue ticket preference", () => {
  it("selects printing for a new printer and restores the saved opt-out", () => {
    expect(printerFormValues(null).queueTicketEnabled).toBe(true);
    expect(printerFormValues({ print_config_uuid: "printer", printer_name: "Counter", connect_type: "tcp", interface_value: "tcp://192.168.1.20:9100", paper_width_mm: 80, is_active: true, role_codes: [], cate_uuid_fk: [], queue_ticket_enabled: false }).queueTicketEnabled).toBe(false);
  });
});

describe("new printer access default", () => {
  const printer = { print_config_uuid: "printer", printer_name: "Printer", connect_type: "tcp", interface_value: "tcp://192.168.1.20:9100", paper_width_mm: 80, is_active: true, role_codes: [], cate_uuid_fk: [] };
  it("starts new printers as device-only without changing existing configurations", () => {
    expect(printerFormValues(null).sharingMode).toBe("DEDICATED");
    expect(printerFormValues(null).accessMode).toBe("DIRECT");
  });
  it("preserves dedicated settings and the legacy default when editing", () => {
    expect(sharingModeOf(printer)).toBe("DEDICATED");
    expect(sharingModeOf({ ...printer, sharing_mode: "DEDICATED" })).toBe("DEDICATED");
    expect(sharingModeOf({ ...printer, sharing_mode: "SHARED" })).toBe("SHARED");
  });
  it("restores the saved Internet choice independently of the legacy Shared flag", () => {
    expect(accessModeOf(printer)).toBe("DIRECT");
    expect(accessModeOf({ ...printer, sharing_mode: "SHARED" })).toBe("LAN");
    expect(accessModeOf({ ...printer, sharing_mode: "SHARED", access_mode: "INTERNET" })).toBe("INTERNET");
    expect(printerFormValues({ ...printer, sharing_mode: "SHARED", access_mode: "INTERNET" }).accessMode).toBe("INTERNET");
  });
});


describe("restoring printer mappings", () => {
  const printer = {
    print_config_uuid: "usb-printer",
    printer_name: "Kitchen USB",
    connect_type: "usb",
    interface_value: "cups:Kitchen",
    paper_width_mm: 80,
    is_active: true,
    role_codes: ["k-001"],
    mapping_type: "ZONE" as const,
    cate_uuid_fk: ["food"],
    zone_uuid_fk: ["inside"],
  };

  it("restores a USB printer with its selected roles, categories, and zones", () => {
    expect(printerFormValues(printer)).toMatchObject({
      connectType: "usb",
      interfaceValue: "cups:Kitchen",
      selectedDevice: "cups:Kitchen",
      ip: "",
      selectedRoles: ["k-001"],
      mappingType: "ZONE",
      selectedCategories: ["food"],
      selectedZones: ["inside"],
    });
  });

  it("restores mappings from embedded details when UUID lists are empty", () => {
    expect(printerFormValues({
      ...printer,
      cate_uuid_fk: [],
      zone_uuid_fk: [],
      categories: [{ cate_uuid: "food" }],
      zones: [{ zone_uuid: "inside" }],
    })).toMatchObject({ selectedCategories: ["food"], selectedZones: ["inside"] });
  });

  it("does not turn a legacy saved USB endpoint into a WiFi printer requiring an IP", () => {
    for (const interfaceValue of ["cups:Kitchen", "win:Kitchen"]) {
      expect(printerFormValues({ ...printer, connect_type: "", interface_value: interfaceValue }))
        .toMatchObject({ connectType: "usb", selectedDevice: interfaceValue, ip: "" });
    }
    expect(printerFormValues({ ...printer, connect_type: "tcp", interface_value: "tcp://192.168.1.20:9100" }))
      .toMatchObject({ connectType: "tcp", ip: "192.168.1.20" });
  });
});

describe("employee role print permissions", () => {
  const printer: Printer = {
    print_config_uuid: "printer", printer_name: "Bar", connect_type: "tcp",
    interface_value: "tcp://192.168.1.20:9100", paper_width_mm: 80,
    is_active: true, role_codes: ["b-001"], cate_uuid_fk: ["drinks", "food"],
  };
  const rules: PrinterCategoryPrintPermission[] = [
    { cate_uuid_fk: "drinks", all_roles: false, allowed_role_ids: [17] },
    { cate_uuid_fk: "food", all_roles: true, allowed_role_ids: [] },
  ];

  it("keeps new and legacy printers unrestricted and defaults new categories to all roles", () => {
    expect(printerFormValues(null).printRoleMode).toBe(1);
    expect(printerFormValues(printer)).toMatchObject({
      printRoleMode: 1,
      categoryPrintPermissions: [
        { cate_uuid_fk: "drinks", all_roles: true, allowed_role_ids: [] },
        { cate_uuid_fk: "food", all_roles: true, allowed_role_ids: [] },
      ],
    });
    expect(categoryPrintPermission(rules, "new-category")).toEqual({
      cate_uuid_fk: "new-category", all_roles: true, allowed_role_ids: [],
    });
  });

  it("restores configured rules independently from the printer's active role mode", () => {
    for (const printRoleMode of [1, 2] as const) {
      const values = printerFormValues({ ...printer, print_role_mode: printRoleMode, category_print_permissions: rules });
      expect(values.printRoleMode).toBe(printRoleMode);
      expect(values.categoryPrintPermissions).toEqual(rules);
      values.categoryPrintPermissions[0].allowed_role_ids.push(19);
      expect(rules[0].allowed_role_ids).toEqual([17]);
    }
  });

  it("chooses a specific real role without enabling all roles or changing another category", () => {
    const next = toggleCategoryPrintRole(rules, "food", 23);
    expect(categoryPrintPermission(next, "food")).toEqual({
      cate_uuid_fk: "food", all_roles: false, allowed_role_ids: [23],
    });
    expect(categoryPrintPermission(next, "drinks")).toEqual(rules[0]);
    expect(rules[1].all_roles).toBe(true);
  });

  it("selects an unchecked category when its role is edited and preserves each category after saving", () => {
    const initial = printerFormValues({
      ...printer,
      cate_uuid_fk: ["food"],
      print_role_mode: 2,
      category_print_permissions: [rules[1]],
    });
    const selected = selectCategoryForPrintPermission(initial.selectedCategories, "drinks");
    const edited = toggleCategoryPrintRole(initial.categoryPrintPermissions, "drinks", 17);
    const saved = printerFormValues({
      ...printer,
      cate_uuid_fk: selected,
      print_role_mode: 2,
      category_print_permissions: categoryPrintPermissionsForCategories(selected, edited),
    });

    expect(initial.selectedCategories).toEqual(["food"]);
    expect(selected).toEqual(["food", "drinks"]);
    expect(selectCategoryForPrintPermission(selected, "drinks")).toEqual(selected);
    expect(saved).toMatchObject({
      printRoleMode: 2,
      selectedCategories: ["food", "drinks"],
      categoryPrintPermissions: [rules[1], rules[0]],
    });
    expect(invalidPrintPermissionCategories(2, "CATEGORY", selected, edited)).toEqual([]);
  });

  it("requires a role after deselecting the last one only when restrictions are active", () => {
    const next = toggleCategoryPrintRole(rules, "drinks", 17);
    expect(invalidPrintPermissionCategories(2, "CATEGORY", printer.cate_uuid_fk, next)).toEqual(["drinks"]);
    expect(invalidPrintPermissionCategories(2, "ZONE", printer.cate_uuid_fk, next)).toEqual(["drinks"]);
    expect(invalidPrintPermissionCategories(1, "CATEGORY", printer.cate_uuid_fk, next)).toEqual([]);
    expect(invalidPrintPermissionCategories(2, "OFF", printer.cate_uuid_fk, next)).toEqual([]);
    const all = updateCategoryPrintPermission(next, { cate_uuid_fk: "drinks", all_roles: true, allowed_role_ids: [] });
    expect(invalidPrintPermissionCategories(2, "CATEGORY", printer.cate_uuid_fk, all)).toEqual([]);
  });

  it("saves only selected categories without erasing draft rules for categories toggled off", () => {
    expect(categoryPrintPermissionsForCategories(["food", "new"], rules)).toEqual([
      rules[1], { cate_uuid_fk: "new", all_roles: true, allowed_role_ids: [] },
    ]);
    expect(categoryPrintPermissionsForCategories(["drinks"], rules)).toEqual([rules[0]]);
  });

  it("compares rules without treating role or category ordering as unsaved edits", () => {
    const first = [{ cate_uuid_fk: "drinks", all_roles: false, allowed_role_ids: [23, 17] }, rules[1]];
    const reordered = [rules[1], { cate_uuid_fk: "drinks", all_roles: false, allowed_role_ids: [17, 23] }];
    expect(categoryPrintPermissionsEqual(first, reordered)).toBe(true);
    expect(categoryPrintPermissionsEqual(first, rules)).toBe(false);
  });

  it("uses employee role names returned by the backend in the active language", () => {
    const role = { roles_id: 17, roles_name: "Counter", roles_name_la: "ແຄັດເຊຍ", roles_name_eng: "Cashier" };
    expect(employeeRoleLabel(role, "la")).toBe("ແຄັດເຊຍ");
    expect(employeeRoleLabel(role, "en")).toBe("Cashier");
    expect(employeeRoleLabel({ ...role, roles_name_eng: "" }, "en")).toBe("Counter");
  });

  it("requires a loaded role list before enabling restrictions while preserving unrestricted saves", () => {
    const roleStates = [
      { loaded: false, loading: false, error: null },
      { loaded: false, loading: true, error: null },
      { loaded: false, loading: false, error: "Connection failed" },
    ];
    for (const roleOptions of roleStates) {
      expect(printRoleSettingsValidation(1, "CATEGORY", printer.cate_uuid_fk, rules, roleOptions)).toEqual({
        roleOptionsStatus: "ready", invalidCategoryUuids: [],
      });
      expect(printRoleSettingsValidation(2, "CATEGORY", printer.cate_uuid_fk, rules, roleOptions).roleOptionsStatus)
        .toBe(roleOptions.error ? "error" : "loading");
    }
    const next = toggleCategoryPrintRole(rules, "drinks", 17);
    expect(printRoleSettingsValidation(2, "CATEGORY", printer.cate_uuid_fk, next, {
      loaded: true, loading: false, error: null,
    })).toEqual({ roleOptionsStatus: "ready", invalidCategoryUuids: ["drinks"] });
  });
});
