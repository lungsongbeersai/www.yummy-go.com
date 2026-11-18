import { isImmersiveScreen } from "@/components/layout/shell-menu-helpers";

// Match Tailwind's existing lg breakpoint; phones and portrait tablets retain
// native navigation, while POS workspaces keep their dedicated full-screen UI.
export const NATIVE_DESKTOP_CHROME_MEDIA_QUERY =
  "(min-width: 1024px) and (orientation: landscape)";

interface NativeDesktopChromeInput {
  wideLandscape: boolean;
  pathname: string;
  desktopHomeLayout: boolean;
  desktopPosLayout: boolean;
}

export function shouldUseNativeDesktopChrome({
  wideLandscape,
  pathname,
  desktopHomeLayout,
  desktopPosLayout,
}: NativeDesktopChromeInput) {
  return wideLandscape
    && !isImmersiveScreen(pathname)
    && !desktopHomeLayout
    && !desktopPosLayout;
}
