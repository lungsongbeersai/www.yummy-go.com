import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Fog,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  NeutralToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  Plane,
  PMREMGenerator,
  PointLight,
  Points,
  PointsMaterial,
  Raycaster,
  RingGeometry,
  Scene,
  Spherical,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Texture
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { calculateSceneDpr, type SceneProfile } from "@/features/landing/scene-quality";
import {
  EMPTY_FPS_SAMPLE,
  getAdaptiveScale,
  getFrameDelta,
  pushFpsSample,
  type FpsSample
} from "@/features/landing/scene-performance";
import {
  LANDING_TOUR_FEATURE_STOPS,
  LANDING_TOUR_STOPS,
  smoothstep,
  tourPosition,
  tourSegment,
  type LandingTourFeatureStop,
  type LandingTourStop
} from "@/features/landing/landing-tour";
import { buildRestaurant, collectDisposables, type RestaurantHotspot } from "@/features/landing/scene-restaurant";
import type { SceneApi, SceneHotspotEvent, SceneStats } from "@/features/landing/scene-api";

export type { SceneApi, SceneStats } from "@/features/landing/scene-api";

/** จำนวนหน้าต่างวัด FPS ที่ต้องรอหลังปรับ scale ก่อนจะปรับอีกครั้ง (~2 วินาที) */
const ADAPTIVE_COOLDOWN_WINDOWS = 3;

/** ขยับเกินเท่านี้ (px) = ลาก ไม่ใช่คลิก */
const CLICK_SLOP = 6;

/** ระหว่างที่เมาส์ค้างอยู่บนวัตถุ ยิง raycast ซ้ำอย่างมากเท่านี้ (วินาที) — กล้องขยับ วัตถุใต้เมาส์อาจเปลี่ยน */
const HOVER_RECHECK_SECONDS = 0.12;

interface SceneOptions {
  profile: SceneProfile;
  /** โหมด Auto เท่านั้น — ลด/เพิ่ม render scale ตาม FPS ที่วัดได้จริง */
  adaptive?: boolean;
  onStats?: (stats: SceneStats) => void;
  /** เมาส์ชี้วัตถุในร้าน (null = ไม่ได้ชี้อะไร) */
  onHotspot?: (hotspot: SceneHotspotEvent | null) => void;
  /** คลิกวัตถุที่เป็นตัวแทนจุดทัวร์ (ไม่ใช่โต๊ะ) — หน้าเลื่อนทัวร์ไปจุดนั้น */
  onSelect?: (stop: LandingTourFeatureStop) => void;
}

interface CameraStop {
  position: [number, number, number];
  target: [number, number, number];
}

// มุมกล้องของแต่ละจุดทัวร์ — ลำดับเดียวกับ LANDING_TOUR_STOPS
// กล้องต้องอยู่ในกรอบเสาไฟ (|x| < 7.5, z < 5) หรือสูงกว่าสายไฟ (y > 5.6) ไม่งั้นหลอดไฟจะบังเต็มจอ
const CAMERA_STOPS: Record<LandingTourStop, CameraStop> = {
  intro: { position: [0, 10.4, 19.6], target: [0, 0.6, 0.4] },
  tables: { position: [-1.6, 6.4, 8.8], target: [0.2, 0.8, 2.4] },
  qr: { position: [6.4, 3.0, 4.8], target: [4.0, 1.5, 1.6] },
  print: { position: [6.2, 3.6, 3.4], target: [3.9, 1.4, -3.4] },
  counter: { position: [-5.4, 3.3, 3.4], target: [-4.6, 1.4, -3.2] },
  reports: { position: [0.7, 3.2, 1.6], target: [0.4, 1.3, -4.6] }
};

function makeGlowTexture(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,236,200,1)");
    gradient.addColorStop(0.22, "rgba(255,196,110,0.5)");
    gradient.addColorStop(0.55, "rgba(255,150,60,0.12)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  return canvas;
}

/** ท้องฟ้ากลางคืนโทนเขียว emerald (เข้มด้านบน → สว่างขึ้นที่ขอบฟ้า) — background texture เต็มจอ ถูกกว่าโดมท้องฟ้าเป็น mesh */
function makeSkyTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#030d0a");
    gradient.addColorStop(0.55, "#06201a");
    gradient.addColorStop(0.82, "#0c3528");
    gradient.addColorStop(1, "#135040");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 2, 256);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export async function initScene(canvas: HTMLCanvasElement, opts: SceneOptions): Promise<SceneApi | null> {
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const { profile, adaptive = false, onStats, onHotspot, onSelect } = opts;
  const shadows = profile.shadowMapSize > 0;
  // เครื่องที่ตั้งเพดานเฟรมไว้: เว้นเฟรมให้ครบช่วงก่อนวาด (ลบ 1ms กันจังหวะ rAF แกว่งแล้วข้ามเฟรมเกิน)
  const minFrameMs = profile.maxFps > 0 ? 1000 / profile.maxFps - 1 : 0;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: profile.antialias,
      alpha: false,
      stencil: false,
      powerPreference: "high-performance"
    });
  } catch {
    console.warn("[scene3d] WebGL unavailable - 3D disabled");
    return null;
  }

  // Neutral คงสีแบรนด์ (ส้มหญ้าฝรั่น/เขียวหยก) ได้ตรงกว่า ACES ที่ดันส้มไปเหลือง — Lambert (lite) ใช้ ACES ได้ดีกว่าเพราะไม่มี IBL
  renderer.toneMapping = profile.lite ? ACESFilmicToneMapping : NeutralToneMapping;
  renderer.toneMappingExposure = profile.lite ? 1.1 : 1;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = PCFShadowMap;
  // ของที่สร้างเงาทั้งหมดไม่ขยับ — วาด shadow map ครั้งเดียว แทนการวาดทั้งร้านซ้ำทุกเฟรม
  renderer.shadowMap.autoUpdate = false;

  const scene = new Scene();
  const skyTexture = makeSkyTexture();
  scene.background = skyTexture;
  scene.fog = new Fog(new Color(0x0c2f25), 26, 62);

  // IBL จากห้องจำลอง (สร้างครั้งเดียว) ให้แสงสะท้อนนุ่ม ๆ บนโลหะ/จาน/ไม้ขัดเงา — ถูกกว่าไฟจริงเพิ่มหลายดวง
  let environment: Texture | null = null;
  if (!profile.lite) {
    const pmrem = new PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    scene.environment = environment;
    scene.environmentIntensity = 0.32;
  }

  const camera = new PerspectiveCamera(42, 1, 0.1, 140);

  let renderScale = 1;
  let viewportWidth = 1;
  let viewportHeight = 1;

  const resizeRenderer = () => {
    viewportWidth = Math.max(1, window.innerWidth);
    viewportHeight = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(calculateSceneDpr(viewportWidth, viewportHeight, window.devicePixelRatio || 1, profile, renderScale));
    renderer.setSize(viewportWidth, viewportHeight, false);
    camera.aspect = viewportWidth / viewportHeight;
    // ต้องตรงกับ breakpoint ของ CSS (819px): จอกว้างข้อความอยู่ซ้าย จึงเลื่อนภาพร้านไปทางขวา
    // จอแคบการ์ดอยู่ล่าง จึงเลื่อนร้านขึ้นแทน
    const stacked = viewportWidth < 820;
    const shiftX = stacked ? 0 : -viewportWidth * 0.15;
    const shiftY = stacked ? viewportHeight * 0.16 : 0;
    camera.setViewOffset(viewportWidth, viewportHeight, shiftX, shiftY, viewportWidth, viewportHeight);
    camera.updateProjectionMatrix();
  };
  resizeRenderer();

  // ---------- lights: ฟ้า/พื้น + ไฟหลักหนึ่งดวง (เงา) + ไฟอุ่นกลางร้านหนึ่งดวง ----------
  scene.add(new HemisphereLight(0xfff0dc, 0x0b2a20, profile.lite ? 1.6 : 1.15));
  const key = new DirectionalLight(0xffe8cc, profile.lite ? 1.4 : 1.7);
  key.position.set(-6, 13, 8);
  if (shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
    key.shadow.camera.left = -11;
    key.shadow.camera.right = 11;
    key.shadow.camera.top = 11;
    key.shadow.camera.bottom = -11;
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 36;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.025;
    key.shadow.radius = 3;
  }
  scene.add(key);
  const warmLight = new PointLight(0xffb45c, 34, 24, 1.5);
  warmLight.position.set(0, 4.6, 1.6);
  scene.add(warmLight);

  const glowTexture = new CanvasTexture(makeGlowTexture());
  glowTexture.colorSpace = SRGBColorSpace;
  const restaurant = buildRestaurant({ lite: profile.lite, shadows, glowTexture });
  scene.add(restaurant.root);

  // ---------- sky stars + fireflies ----------
  const starPositions = new Float32Array(profile.stars * 3);
  for (let index = 0; index < profile.stars; index++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.42;
    const radius = 70 + Math.random() * 20;
    starPositions[index * 3] = Math.sin(phi) * Math.cos(theta) * radius;
    starPositions[index * 3 + 1] = Math.cos(phi) * radius * 0.6 + 8;
    starPositions[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  }
  const starGeometry = new BufferGeometry();
  starGeometry.setAttribute("position", new BufferAttribute(starPositions, 3));
  const stars = new Points(
    starGeometry,
    new PointsMaterial({ color: 0xfff1d6, size: 0.35, transparent: true, opacity: 0.8, fog: false, depthWrite: false })
  );
  scene.add(stars);

  // หิ่งห้อยหมุนทั้งก้อน — ไม่อัปเดตตำแหน่งทีละจุดบน CPU แล้วส่ง buffer ขึ้น GPU ทุกเฟรม
  const fireflyCount = profile.dust;
  const fireflyPositions = new Float32Array(fireflyCount * 3);
  for (let index = 0; index < fireflyCount; index++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 3 + Math.random() * 10;
    fireflyPositions[index * 3] = Math.cos(angle) * radius;
    fireflyPositions[index * 3 + 1] = 0.6 + Math.random() * 5;
    fireflyPositions[index * 3 + 2] = Math.sin(angle) * radius;
  }
  const fireflyGeometry = new BufferGeometry();
  fireflyGeometry.setAttribute("position", new BufferAttribute(fireflyPositions, 3));
  const fireflyMaterial = new PointsMaterial({
    map: glowTexture,
    color: 0xa7f3d0,
    size: 0.7,
    transparent: true,
    opacity: 0.75,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const fireflies = new Points(fireflyGeometry, fireflyMaterial);
  scene.add(fireflies);

  // ---------- click ripples ----------
  const rippleGeometry = new RingGeometry(0.9, 1, 48);
  rippleGeometry.rotateX(-Math.PI / 2);
  const ripples: Array<{ mesh: Mesh; material: MeshBasicMaterial; progress: number; scale: number }> = [];
  for (let index = 0; index < 3; index++) {
    const material = new MeshBasicMaterial({
      color: 0x6ee7b7,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
      toneMapped: false
    });
    const ripple = new Mesh(rippleGeometry, material);
    ripple.visible = false;
    scene.add(ripple);
    ripples.push({ mesh: ripple, material, progress: -1, scale: 1 });
  }

  const hotspotByProxy = new Map(restaurant.hotspots.map((hotspot) => [hotspot.proxy, hotspot] as const));
  const proxies = restaurant.hotspots.map((hotspot) => hotspot.proxy);

  const stopVectors = LANDING_TOUR_STOPS.map((stop) => ({
    position: new Vector3(...CAMERA_STOPS[stop].position),
    target: new Vector3(...CAMERA_STOPS[stop].target)
  }));

  const targetPointer = { x: 0, y: 0 };
  const currentPointer = { x: 0, y: 0 };
  const orbit = { yaw: 0, pitch: 0 };
  let tourProgress = 0;
  // ค่าที่กล้องใช้จริง — ไล่ตาม tourProgress แบบนุ่ม ๆ เพราะสกรอลล์ด้วยล้อเมาส์มาเป็นขั้น ๆ กล้องจะกระตุกตาม
  let smoothProgress = 0;
  let scrolling = false;
  let dragging = false;
  let pointerDown: { x: number; y: number; moved: boolean } | null = null;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let previousUserSelect = "";
  let needsRaycast = false;
  let lastRaycastTime = 0;
  let hovered: RestaurantHotspot | null = null;
  let lastHotspotKey = "";
  let active = false;
  let disposed = false;
  let animationFrame = 0;
  let resizeFrame = 0;
  let previousFrameTime: number | null = null;
  let lastRenderAt = 0;
  let elapsedTime = 0;
  let fpsSample: FpsSample = EMPTY_FPS_SAMPLE;
  let measuredFps = 0;
  let adaptiveCooldown = 0;
  let drawCalls = 0;
  let triangles = 0;

  const readStats = (): SceneStats => ({
    fps: measuredFps,
    dpr: Math.round(renderer.getPixelRatio() * 100) / 100,
    tier: profile.tier,
    adaptive,
    renderScale,
    drawCalls,
    triangles
  });
  const emitStats = () => onStats?.(readStats());

  const raycaster = new Raycaster();
  const normalizedPointer = new Vector2();
  const cameraPosition = new Vector3();
  const cameraTarget = new Vector3();
  const offset = new Vector3();
  const spherical = new Spherical();
  const projected = new Vector3();
  const floorPlane = new Plane(new Vector3(0, 1, 0), 0);
  const floorHit = new Vector3();
  const weights = Object.fromEntries(LANDING_TOUR_FEATURE_STOPS.map((stop) => [stop, 0])) as Record<LandingTourFeatureStop, number>;

  const isInteractive = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest("a,button,input,textarea,select,label,[data-no-pulse]"));

  const setPointerFromClient = (clientX: number, clientY: number) => {
    normalizedPointer.set((clientX / viewportWidth) * 2 - 1, -((clientY / viewportHeight) * 2 - 1));
  };

  // ชนกล่องล่องหนแค่ ~8 กล่อง แทนการไล่ทุกสามเหลี่ยมของร้าน
  const pickHotspot = (): RestaurantHotspot | null => {
    raycaster.setFromCamera(normalizedPointer, camera);
    const hit = raycaster.intersectObjects(proxies, false)[0];
    return hit ? (hotspotByProxy.get(hit.object as Mesh) ?? null) : null;
  };

  const spawnRipple = (x: number, z: number, scale = 1) => {
    const ripple = ripples.find((item) => item.progress < 0) ?? ripples[0];
    ripple.progress = 0;
    ripple.scale = scale;
    ripple.mesh.position.set(x, 0.05, z);
    ripple.mesh.scale.setScalar(scale);
    ripple.mesh.visible = true;
  };

  const pulse = () => {
    if (!active || disposed) return;
    spawnRipple(0, 0, 1.5);
  };

  const onMouseMove = (event: MouseEvent) => {
    targetPointer.x = (event.clientX / viewportWidth) * 2 - 1;
    targetPointer.y = -((event.clientY / viewportHeight) * 2 - 1);
    setPointerFromClient(event.clientX, event.clientY);
    needsRaycast = true;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!active || !event.isPrimary || isInteractive(event.target)) return;
    pointerDown = { x: event.clientX, y: event.clientY, moved: false };
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!active || !pointerDown) return;
    if (!pointerDown.moved) {
      if (Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) < CLICK_SLOP) return;
      pointerDown.moved = true;
      dragging = true;
      previousUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = "none";
    }
    orbit.yaw = Math.max(-1.3, Math.min(1.3, orbit.yaw - (event.clientX - lastPointerX) * 0.005));
    orbit.pitch = Math.max(-0.35, Math.min(0.35, orbit.pitch - (event.clientY - lastPointerY) * 0.003));
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
  };

  const onPointerUp = (event: PointerEvent) => {
    const down = pointerDown;
    pointerDown = null;
    if (dragging) {
      dragging = false;
      document.body.style.userSelect = previousUserSelect;
      return;
    }
    if (!down || !active || event.type === "pointercancel") return;

    // คลิกเฉย ๆ (ไม่ได้ลาก): โต๊ะ = เปลี่ยนสถานะ, วัตถุอื่น = พาทัวร์ไปจุดนั้น, พื้นว่าง = ระลอกคลื่น
    setPointerFromClient(event.clientX, event.clientY);
    const hotspot = pickHotspot();
    if (hotspot?.tableIndex !== undefined) {
      restaurant.cycleTable(hotspot.tableIndex);
      spawnRipple(hotspot.center.x, hotspot.center.z, 0.9);
      return;
    }
    if (hotspot) {
      onSelect?.(hotspot.stop);
      return;
    }
    raycaster.setFromCamera(normalizedPointer, camera);
    if (raycaster.ray.intersectPlane(floorPlane, floorHit) && floorHit.length() < 9.5) spawnRipple(floorHit.x, floorHit.z, 1);
  };

  const onOrientation = (event: DeviceOrientationEvent) => {
    if (!active || event.gamma == null || event.beta == null) return;
    targetPointer.x = Math.max(-1, Math.min(1, event.gamma / 30));
    targetPointer.y = Math.max(-1, Math.min(1, -(event.beta - 45) / 30));
  };

  const emitHotspot = () => {
    if (!onHotspot) return;
    if (!hovered) {
      if (lastHotspotKey) {
        lastHotspotKey = "";
        onHotspot(null);
      }
      return;
    }
    projected.copy(hovered.anchor).project(camera);
    const x = Math.round((projected.x * 0.5 + 0.5) * viewportWidth);
    const y = Math.round((-projected.y * 0.5 + 0.5) * viewportHeight);
    const hotspotKey = `${hovered.stop}:${hovered.tableIndex ?? ""}:${x}:${y}`;
    if (hotspotKey === lastHotspotKey) return;
    lastHotspotKey = hotspotKey;
    onHotspot({ stop: hovered.stop, x, y, table: hovered.tableIndex !== undefined });
  };

  const updateCamera = (deltaSeconds: number, time: number) => {
    smoothProgress += (tourProgress - smoothProgress) * (1 - Math.exp(-6 * deltaSeconds));
    if (Math.abs(tourProgress - smoothProgress) < 0.0001) smoothProgress = tourProgress;
    const position = tourPosition(smoothProgress);
    const segment = tourSegment(position);
    const from = stopVectors[segment.from];
    const to = stopVectors[segment.to];
    cameraPosition.lerpVectors(from.position, to.position, segment.t);
    cameraTarget.lerpVectors(from.target, to.target, segment.t);

    LANDING_TOUR_FEATURE_STOPS.forEach((stop, index) => {
      weights[stop] = smoothstep(1 - Math.abs(position - (index + 1)));
    });

    // จอแนวตั้งเห็นร้านแคบ — ถอยกล้องออกตามสัดส่วนจอให้ของหลักยังอยู่ในเฟรม
    const aspect = camera.aspect;
    const fit = aspect < 1.1 ? 1 + (1.1 - aspect) * 0.95 : 1;
    const introWeight = 1 - smoothstep(position);

    if (!dragging) {
      // ปล่อยเมาส์แล้วมุมที่ลากค่อย ๆ คืนสู่มุมทัวร์ — ไม่งั้นการ์ดข้อความจะไม่ตรงกับสิ่งที่เห็น
      const settle = Math.exp(-(0.7 + (1 - introWeight) * 1.1) * deltaSeconds);
      orbit.yaw *= settle;
      orbit.pitch *= settle;
    }

    offset.subVectors(cameraPosition, cameraTarget).multiplyScalar(fit);
    spherical.setFromVector3(offset);
    spherical.theta += orbit.yaw + currentPointer.x * 0.1 + introWeight * Math.sin(time * 0.18) * 0.2;
    spherical.phi = Math.max(0.32, Math.min(1.42, spherical.phi + orbit.pitch - currentPointer.y * 0.04));
    offset.setFromSpherical(spherical);
    camera.position.copy(cameraTarget).add(offset);
    camera.lookAt(cameraTarget);
  };

  const renderFrame = (deltaSeconds: number, time: number) => {
    const pointerEase = 1 - Math.exp(-3 * deltaSeconds);
    currentPointer.x += (targetPointer.x - currentPointer.x) * pointerEase;
    currentPointer.y += (targetPointer.y - currentPointer.y) * pointerEase;

    updateCamera(deltaSeconds, time);

    // hover เป็นเรื่องของอุปกรณ์ชี้ตำแหน่ง — จอสัมผัสไม่มี hover จริง ระหว่างสกรอลล์/ลากก็ข้าม
    if (!coarsePointer && !dragging && !scrolling) {
      if (needsRaycast || (hovered && time - lastRaycastTime > HOVER_RECHECK_SECONDS)) {
        needsRaycast = false;
        lastRaycastTime = time;
        hovered = pickHotspot();
      }
    } else if (hovered) {
      hovered = null;
    }
    emitHotspot();

    restaurant.animate({ deltaSeconds, time, weights, hovered });

    warmLight.intensity = 32 + Math.sin(time * 1.3) * 2;
    fireflies.rotation.y = time * 0.03;
    fireflies.position.y = Math.sin(time * 0.6) * 0.15;
    fireflyMaterial.opacity = 0.6 + Math.sin(time * 1.7) * 0.15;
    stars.rotation.y = time * 0.003;

    ripples.forEach((ripple) => {
      if (ripple.progress < 0) return;
      ripple.progress += deltaSeconds / 0.9;
      if (ripple.progress >= 1) {
        ripple.progress = -1;
        ripple.material.opacity = 0;
        ripple.mesh.visible = false;
        return;
      }
      ripple.mesh.scale.setScalar(ripple.scale * (1 + ripple.progress * 2.6));
      ripple.material.opacity = (1 - ripple.progress) * 0.7;
    });

    renderer.render(scene, camera);
    drawCalls = renderer.info.render.calls;
    triangles = renderer.info.render.triangles;
  };

  const trackPerformance = (rawSeconds: number) => {
    fpsSample = pushFpsSample(fpsSample, rawSeconds);
    if (!fpsSample.settled) return;
    measuredFps = fpsSample.fps;

    // เพดานเฟรมตั้งใจให้ต่ำอยู่แล้ว — ห้ามเอาไปตีความว่าเครื่องช้าแล้วลดความละเอียดซ้ำ
    const effectiveFps = profile.maxFps > 0 ? (measuredFps / profile.maxFps) * 60 : measuredFps;
    if (adaptive && adaptiveCooldown <= 0) {
      const nextScale = getAdaptiveScale(renderScale, effectiveFps);
      if (nextScale !== renderScale) {
        renderScale = nextScale;
        adaptiveCooldown = ADAPTIVE_COOLDOWN_WINDOWS;
        resizeRenderer();
      }
    } else if (adaptiveCooldown > 0) {
      adaptiveCooldown -= 1;
    }
    emitStats();
  };

  const onAnimationFrame = (now: number) => {
    animationFrame = 0;
    if (!active || disposed) return;
    if (minFrameMs > 0 && now - lastRenderAt < minFrameMs) {
      animationFrame = window.requestAnimationFrame(onAnimationFrame);
      return;
    }
    lastRenderAt = now;
    const frame = getFrameDelta(now, previousFrameTime);
    previousFrameTime = frame.frameTime;
    elapsedTime += frame.deltaSeconds;
    renderFrame(frame.deltaSeconds, elapsedTime);
    trackPerformance(frame.rawSeconds);
    if (active && !disposed) animationFrame = window.requestAnimationFrame(onAnimationFrame);
  };

  const onResize = () => {
    if (resizeFrame || disposed) return;
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      if (disposed) return;
      resizeRenderer();
      if (!active) renderFrame(0, elapsedTime);
    });
  };

  // คอมไพล์ shader ทุกตัวก่อนเฟรมแรก (ขนานกันได้ถ้าไดรเวอร์รองรับ) — กันเฟรมแรก ๆ ค้างตอนเริ่มทัวร์
  updateCamera(0, 0);
  try {
    await renderer.compileAsync(scene, camera);
  } catch {
    // คอมไพล์ล่วงหน้าไม่สำเร็จไม่ใช่ข้อผิดพลาดร้ายแรง — ปล่อยให้คอมไพล์ตอนวาดเฟรมแรกตามปกติ
  }

  if (!coarsePointer) window.addEventListener("mousemove", onMouseMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerup", onPointerUp, { passive: true });
  window.addEventListener("pointercancel", onPointerUp, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  if (coarsePointer) window.addEventListener("deviceorientation", onOrientation, { passive: true });

  renderer.shadowMap.needsUpdate = true;
  renderFrame(0, elapsedTime);
  emitStats();

  return {
    onScroll(nextTourProgress) {
      tourProgress = nextTourProgress;
    },
    setActive(nextActive) {
      if (disposed || active === nextActive) return;
      active = nextActive;
      previousFrameTime = null;
      fpsSample = EMPTY_FPS_SAMPLE;

      if (active) {
        // กลับมาหลังหายไปนาน ให้กล้องไปอยู่ตำแหน่งปัจจุบันทันที ไม่ต้องเลื่อนผ่านทุกจุดทัวร์
        smoothProgress = tourProgress;
        animationFrame = window.requestAnimationFrame(onAnimationFrame);
      } else {
        if (animationFrame) window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        measuredFps = 0;
        hovered = null;
        emitHotspot();
      }
      emitStats();
    },
    setScrolling(nextScrolling) {
      if (disposed || scrolling === nextScrolling) return;
      scrolling = nextScrolling;
      if (scrolling) needsRaycast = false;
    },
    pulse,
    dispose() {
      if (disposed) return;
      disposed = true;
      active = false;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
      animationFrame = 0;
      resizeFrame = 0;

      if (!coarsePointer) window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("resize", onResize);
      if (coarsePointer) window.removeEventListener("deviceorientation", onOrientation);
      if (dragging) document.body.style.userSelect = previousUserSelect;
      onHotspot?.(null);

      const { geometries, materials, textures } = collectDisposables(scene);
      geometries.forEach((geometry) => geometry.dispose());
      textures.forEach((texture) => texture.dispose());
      materials.forEach((material) => material.dispose());
      glowTexture.dispose();
      skyTexture.dispose();
      environment?.dispose();
      scene.clear();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    }
  };
}
