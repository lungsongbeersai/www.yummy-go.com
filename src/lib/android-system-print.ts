import { Capacitor, registerPlugin } from "@capacitor/core";

interface AndroidSystemPrintPlugin {
  printHtml(options: {
    baseUrl: string;
    html: string;
    jobName: string;
  }): Promise<void>;
}

const AndroidSystemPrint = registerPlugin<AndroidSystemPrintPlugin>("AndroidSystemPrint");

export function canUseAndroidSystemPrint() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function printHtmlWithAndroidSystemPrint({
  html,
  jobName,
}: {
  html: string;
  jobName: string;
}) {
  if (!canUseAndroidSystemPrint()) return false;

  await AndroidSystemPrint.printHtml({
    baseUrl: window.location.origin,
    html,
    jobName,
  });
  return true;
}
