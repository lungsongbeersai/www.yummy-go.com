interface Screen {
  readonly isExtended: boolean;
}

interface ScreenDetailed extends Screen {
  readonly availLeft: number;
  readonly availTop: number;
  readonly devicePixelRatio: number;
  readonly isInternal: boolean;
  readonly isPrimary: boolean;
  readonly label: string;
  readonly left: number;
  readonly top: number;
}

interface ScreenDetails extends EventTarget {
  readonly currentScreen: ScreenDetailed;
  readonly screens: readonly ScreenDetailed[];
  oncurrentscreenchange: ((this: ScreenDetails, event: Event) => void) | null;
  onscreenschange: ((this: ScreenDetails, event: Event) => void) | null;
}

interface Window {
  getScreenDetails?: () => Promise<ScreenDetails>;
}

interface FullscreenOptions {
  screen?: ScreenDetailed;
}
