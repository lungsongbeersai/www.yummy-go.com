import { Capacitor, registerPlugin } from "@capacitor/core";
import { isCapacitorAndroidApp } from "@/lib/capacitor-platform";

interface AndroidSystemPrintPlugin {
  printHtml(options: {
    baseUrl: string;
    html: string;
    jobName: string;
  }): Promise<void>;
}

const AndroidSystemPrint = registerPlugin<AndroidSystemPrintPlugin>("AndroidSystemPrint");

export function canUseAndroidSystemPrint() {
  // Remote web updates cannot add plugins to an already installed Play build.
  return isCapacitorAndroidApp() && Capacitor.isPluginAvailable("AndroidSystemPrint");
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
