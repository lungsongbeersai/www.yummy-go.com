export const SUNMI_PRINTER_INTERFACE = "sunmi://builtin";
export const SUNMI_PRINT_MODE = "sunmi_builtin";
export const SUNMI_PRINTER_AGENT_ID = "sunmi-native";

export function canHostSunmiBuiltinPrinter(role: unknown) {
  return [1, 2, 3].includes(Number(role));
}
