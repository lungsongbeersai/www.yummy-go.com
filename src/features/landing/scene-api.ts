export interface SceneApi {
  onScroll: (heroProgress: number, totalProgress: number) => void;
  setActive: (active: boolean) => void;
  pulse: () => void;
  dispose: () => void;
}
