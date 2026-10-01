import type { Viewport } from "next";
import { headers } from "next/headers";
import { CustomerDisplayPage } from "@/features/customer-display/display/customer-display-page";
import { SWAN_CUSTOMER_DISPLAY_USER_AGENT } from "@/features/customer-display/shared/native-customer-display";

export async function generateViewport(): Promise<Viewport> {
  const userAgent = (await headers()).get("user-agent") ?? "";
  // The Swan 1 HDMI firmware advertises 720 dpi for a 1280 px panel. WebView
  // clamps the minimum scale to .25, yielding about 1138 visible CSS pixels.
  const isSwanCustomerDisplay = userAgent.includes(SWAN_CUSTOMER_DISPLAY_USER_AGENT);
  return {
    width: isSwanCustomerDisplay ? 1138 : "device-width",
    initialScale: isSwanCustomerDisplay ? 0.25 : 1,
    viewportFit: "cover",
  };
}

export default function Page() {
  return <CustomerDisplayPage />;
}
