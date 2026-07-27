import type { BufferGeometry, Material, Mesh, Object3D, Sprite, Texture } from "three";
import { calculateSceneDpr, type SceneProfile } from "@/features/landing/scene-quality";
import {
  EMPTY_FPS_SAMPLE,
  getAdaptiveScale,
  getFrameDelta,
  pushFpsSample,
  type FpsSample
} from "@/features/landing/scene-performance";
import type { SceneApi, SceneStats } from "@/features/landing/scene-api";

export type { SceneApi, SceneStats } from "@/features/landing/scene-api";

/** จำนวนหน้าต่างวัด FPS ที่ต้องรอหลังปรับ scale ก่อนจะปรับอีกครั้ง (~2 วินาที) */
const ADAPTIVE_COOLDOWN_WINDOWS = 3;

interface SceneOptions {
  profile: SceneProfile;
  /** โหมด Auto เท่านั้น — ลด/เพิ่ม render scale ตาม FPS ที่วัดได้จริง */
  adaptive?: boolean;
  onStats?: (stats: SceneStats) => void;
}

interface SatelliteMotion {
  mesh: Mesh;
  radius: number;
  speed: number;
  phase: number;
  verticalSpeed: number;
}

interface Shockwave {
  mesh: Mesh;
  progress: number;
}

function makeGlowTexture(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, "rgba(140,190,255,0.9)");
    gradient.addColorStop(0.22, "rgba(70,130,246,0.4)");
    gradient.addColorStop(0.6, "rgba(40,80,200,0.12)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
  }
  return canvas;
}

export async function initScene(canvas: HTMLCanvasElement, opts: SceneOptions): Promise<SceneApi | null> {
  const THREE = await import("three");
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const { profile, adaptive = false, onStats } = opts;

  let renderer: import("three").WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: profile.antialias,
      powerPreference: "high-performance"
    });
  } catch {
    console.warn("[scene3d] WebGL unavailable - 3D disabled");
    return null;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050810);
  scene.fog = new THREE.FogExp2(0x050810, 0.02);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(0, 0.4, 16);

  let renderScale = 1;

  const resizeRenderer = () => {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(
      calculateSceneDpr(width, height, window.devicePixelRatio || 1, profile, renderScale)
    );
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resizeRenderer();

  scene.add(new THREE.AmbientLight(0x16244a, 1.15));
  const primaryLight = new THREE.PointLight(0x3b82f6, 1.6, 90);
  const secondaryLight = new THREE.PointLight(0x22d3ee, 1.2, 90);
  scene.add(primaryLight, secondaryLight);
  const directionalLight = new THREE.DirectionalLight(0x7ca6ff, 0.4);
  directionalLight.position.set(4, 12, 8);
  scene.add(directionalLight);

  const corePosition = new THREE.Vector3(0, 0.6, -2);
  const core = new THREE.Group();
  core.position.copy(corePosition);
  scene.add(core);

  const inner = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.05, 0),
    new THREE.MeshPhongMaterial({
      color: 0x0a1f4d,
      emissive: 0x123c8f,
      emissiveIntensity: 0.9,
      shininess: 90,
      flatShading: true
    })
  );
  core.add(inner);

  const blue = new THREE.Color(0x4c8dff);
  const cyan = new THREE.Color(0x37e2ff);
  const wireMaterial = new THREE.LineBasicMaterial({
    color: 0x4c8dff,
    transparent: true,
    opacity: 0.55
  });
  const wireSource = new THREE.IcosahedronGeometry(3.05, 1);
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(wireSource), wireMaterial);
  wireSource.dispose();
  core.add(wire);

  const outerWireSource = new THREE.IcosahedronGeometry(4.05, 1);
  const outerWire = new THREE.LineSegments(
    new THREE.WireframeGeometry(outerWireSource),
    new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.12 })
  );
  outerWireSource.dispose();
  core.add(outerWire);

  const glowTexture = new THREE.CanvasTexture(makeGlowTexture());
  const glow: Sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    })
  );
  glow.scale.set(15, 15, 1);
  core.add(glow);

  const rings: Mesh[] = [];
  const ringColors = [0x3b82f6, 0x22d3ee, 0x60a5fa];
  for (let index = 0; index < 3; index++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.5 + index * 0.75, 0.022 + index * 0.008, 8, 200),
      new THREE.MeshBasicMaterial({
        color: ringColors[index],
        transparent: true,
        opacity: 0.4 - index * 0.09,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    ring.rotation.set(1.15 + index * 0.42, 0.32 * index, 0.5 * index);
    core.add(ring);
    rings.push(ring);
  }

  const satellites: SatelliteMotion[] = [];
  for (let index = 0; index < 8; index++) {
    const satellite = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.14 + (index % 3) * 0.05, 0),
      new THREE.MeshPhongMaterial({
        color: 0x0e2a5c,
        emissive: index % 2 ? 0x22d3ee : 0x3b82f6,
        emissiveIntensity: 1.6,
        flatShading: true
      })
    );
    core.add(satellite);
    satellites.push({
      mesh: satellite,
      radius: 4.9 + ((index * 0.37) % 2.3),
      speed: 0.22 + (index % 4) * 0.09,
      phase: (index / 8) * Math.PI * 2,
      verticalSpeed: 0.6 + (index % 3) * 0.5
    });
  }

  const grid = new THREE.GridHelper(120, 60, 0x2451b8, 0x0d1e46);
  grid.position.y = -7.5;
  grid.material.transparent = true;
  grid.material.opacity = 0.32;
  scene.add(grid);

  const makePoints = (
    count: number,
    minRadius: number,
    maxRadius: number,
    size: number,
    opacity: number,
    map?: Texture
  ) => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [0x1d4ed8, 0x3b82f6, 0x60a5fa, 0x22d3ee, 0x93c5fd].map(
      (color) => new THREE.Color(color)
    );
    const position = new THREE.Vector3();

    for (let index = 0; index < count; index++) {
      position
        .set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
        .normalize()
        .multiplyScalar(minRadius + Math.random() * (maxRadius - minRadius));
      positions[index * 3] = position.x;
      positions[index * 3 + 1] = position.y * 0.8;
      positions[index * 3 + 2] = position.z;
      const color = palette[(Math.random() * palette.length) | 0];
      const intensity = 0.5 + Math.random() * 0.5;
      colors[index * 3] = color.r * intensity;
      colors[index * 3 + 1] = color.g * intensity;
      colors[index * 3 + 2] = color.b * intensity;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      map: map ?? null
    });
    if (map) material.alphaTest = 0.01;
    return new THREE.Points(geometry, material);
  };

  const stars = makePoints(profile.stars, 9, 36, 0.085, 0.85);
  scene.add(stars);
  const dust = makePoints(profile.dust, 6, 24, 0.9, 0.12, glowTexture);
  scene.add(dust);

  const shockwaves: Shockwave[] = [];
  for (let index = 0; index < 3; index++) {
    const shockwave = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1, 64),
      new THREE.MeshBasicMaterial({
        color: 0x8fc2ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    shockwave.position.copy(corePosition);
    shockwave.visible = false;
    scene.add(shockwave);
    shockwaves.push({ mesh: shockwave, progress: -1 });
  }

  const targetPointer = { x: 0, y: 0 };
  const currentPointer = { x: 0, y: 0 };
  const spin = { x: 0, y: 0 };
  let heroProgress = 0;
  let totalProgress = 0;
  let punch = 0;
  let flash = 0;
  let hovering = false;
  let dragging = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let previousUserSelect = "";
  let active = false;
  let disposed = false;
  let animationFrame = 0;
  let resizeFrame = 0;
  let previousFrameTime: number | null = null;
  let elapsedTime = 0;
  let fpsSample: FpsSample = EMPTY_FPS_SAMPLE;
  let measuredFps = 0;
  let adaptiveCooldown = 0;

  const readStats = (): SceneStats => ({
    fps: measuredFps,
    dpr: Math.round(renderer.getPixelRatio() * 100) / 100,
    tier: profile.tier,
    adaptive,
    renderScale
  });

  const emitStats = () => onStats?.(readStats());

  const raycaster = new THREE.Raycaster();
  const normalizedPointer = new THREE.Vector2();
  const lookTarget = new THREE.Vector3();

  const isInteractive = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest("a,button,input,textarea,select,label,[data-no-pulse]"));

  const pulse = () => {
    if (!active || disposed) return;
    const shockwave = shockwaves.find((item) => item.progress < 0) ?? shockwaves[0];
    shockwave.progress = 0;
    shockwave.mesh.scale.set(1, 1, 1);
    shockwave.mesh.visible = true;
    punch = 1;
    flash = 1;
  };

  const onMouseMove = (event: MouseEvent) => {
    targetPointer.x = (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    targetPointer.y = -((event.clientY / Math.max(1, window.innerHeight)) * 2 - 1);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!active || !event.isPrimary || isInteractive(event.target)) return;
    dragging = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    pulse();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!active || !dragging) return;
    spin.y += (event.clientX - lastPointerX) * 0.0022;
    spin.x += (event.clientY - lastPointerY) * 0.0014;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
  };

  const onPointerUp = () => {
    dragging = false;
    document.body.style.userSelect = previousUserSelect;
  };

  const onOrientation = (event: DeviceOrientationEvent) => {
    if (!active || event.gamma == null || event.beta == null) return;
    targetPointer.x = Math.max(-1, Math.min(1, event.gamma / 28));
    targetPointer.y = Math.max(-1, Math.min(1, -(event.beta - 45) / 28));
  };

  const renderFrame = (deltaSeconds: number, time: number) => {
    const pointerEase = 1 - Math.exp(-3.08 * deltaSeconds);
    currentPointer.x += (targetPointer.x - currentPointer.x) * pointerEase;
    currentPointer.y += (targetPointer.y - currentPointer.y) * pointerEase;
    punch = Math.max(0, punch - deltaSeconds * 2.6);
    flash = Math.max(0, flash - deltaSeconds * 2.2);

    camera.position.x = currentPointer.x * 1.7;
    camera.position.y = 0.4 - currentPointer.y * 1.3 - heroProgress * 7;
    camera.position.z = 16 + heroProgress * 3 - punch * 0.6;
    lookTarget.set(0, 0.6 - heroProgress * 6.2, -2);
    camera.lookAt(lookTarget);

    normalizedPointer.set(targetPointer.x, targetPointer.y);
    raycaster.setFromCamera(normalizedPointer, camera);
    // hover เป็นเรื่องของอุปกรณ์ชี้ตำแหน่ง ไม่ใช่ระดับคุณภาพ — จอสัมผัสไม่มี hover จริง
    hovering =
      !coarsePointer && heroProgress < 0.5 && raycaster.ray.distanceToPoint(corePosition) < 3.6;

    core.rotation.y += deltaSeconds * 0.12 + spin.y * deltaSeconds * 60;
    core.rotation.x += deltaSeconds * 0.03 + spin.x * deltaSeconds * 60;
    // ใช้ exponential decay ไม่ใช่ (1 - k*dt) เพื่อให้ผลลัพธ์เท่ากันทุกเฟรมเรต (60/120/144Hz)
    const spinDecay = Math.exp(-2.2 * deltaSeconds);
    spin.x *= spinDecay;
    spin.y *= spinDecay;
    inner.rotation.y -= deltaSeconds * 0.2;
    inner.rotation.x = currentPointer.y * 0.22;
    outerWire.rotation.y -= deltaSeconds * 0.05;

    const targetScale = 1 + (hovering ? 0.06 : 0) + flash * 0.1;
    core.scale.x += (targetScale - core.scale.x) * (1 - Math.exp(-6 * deltaSeconds));
    core.scale.y = core.scale.z = core.scale.x;

    wireMaterial.opacity = Math.min(1, 0.5 + (hovering ? 0.28 : 0) + flash * 0.4);
    wireMaterial.color.lerp(hovering ? cyan : blue, 1 - Math.exp(-5 * deltaSeconds));
    glow.material.opacity = 0.4 + Math.sin(time * 1.4) * 0.07 + flash * 0.3 + (hovering ? 0.1 : 0);

    rings.forEach((ring, index) => {
      ring.rotation.z += deltaSeconds * (0.05 + index * 0.035);
    });
    satellites.forEach((satellite) => {
      const angle = time * satellite.speed + satellite.phase;
      satellite.mesh.position.set(
        Math.cos(angle) * satellite.radius,
        Math.sin(angle * satellite.verticalSpeed) * 1.15,
        Math.sin(angle) * satellite.radius
      );
      satellite.mesh.rotation.y += deltaSeconds * 1.4;
    });

    stars.rotation.y = time * 0.016 + totalProgress * 1.4;
    stars.material.opacity = 0.72 + Math.sin(time * 2.3) * 0.12 + flash * 0.25;
    dust.rotation.y = -time * 0.01 - totalProgress * 0.5;

    primaryLight.position.set(
      Math.cos(time * 0.3) * 9,
      5 + Math.sin(time * 0.2) * 2,
      Math.sin(time * 0.3) * 9
    );
    secondaryLight.position.set(
      Math.cos(time * 0.24 + Math.PI) * 8,
      -3 + Math.cos(time * 0.31) * 2,
      Math.sin(time * 0.24 + Math.PI) * 8
    );

    grid.position.z = (time * 1.4) % 2;

    shockwaves.forEach((shockwave) => {
      if (shockwave.progress < 0) return;
      shockwave.progress += deltaSeconds / 0.85;
      const material = shockwave.mesh.material as import("three").MeshBasicMaterial;
      if (shockwave.progress >= 1) {
        shockwave.progress = -1;
        material.opacity = 0;
        shockwave.mesh.visible = false;
        return;
      }
      shockwave.mesh.scale.setScalar(1 + shockwave.progress * 14);
      material.opacity = (1 - shockwave.progress) * 0.8;
      shockwave.mesh.quaternion.copy(camera.quaternion);
    });

    renderer.render(scene, camera);
  };

  // วัด FPS แล้วให้โหมด Auto ปรับ render scale เอง (โหมดที่ผู้ใช้เลือก tier เองจะไม่ถูกแตะ)
  const trackPerformance = (rawSeconds: number) => {
    fpsSample = pushFpsSample(fpsSample, rawSeconds);
    if (!fpsSample.settled) return;

    measuredFps = fpsSample.fps;

    if (adaptive && adaptiveCooldown <= 0) {
      const nextScale = getAdaptiveScale(renderScale, measuredFps);
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

    // ไม่มี frame cap แล้ว — rAF คุมจังหวะตามรีเฟรชจริงของจอ (60/120/144Hz)
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

  if (!coarsePointer) window.addEventListener("mousemove", onMouseMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerup", onPointerUp, { passive: true });
  window.addEventListener("pointercancel", onPointerUp, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  if (coarsePointer) window.addEventListener("deviceorientation", onOrientation, { passive: true });

  renderFrame(0, elapsedTime);
  emitStats();

  return {
    onScroll(nextHeroProgress, nextTotalProgress) {
      heroProgress = nextHeroProgress;
      totalProgress = nextTotalProgress;
    },
    setActive(nextActive) {
      if (disposed || active === nextActive) return;
      active = nextActive;
      previousFrameTime = null;
      fpsSample = EMPTY_FPS_SAMPLE;

      if (active) {
        animationFrame = window.requestAnimationFrame(onAnimationFrame);
      } else {
        if (animationFrame) window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        measuredFps = 0;
      }
      emitStats();
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
      document.body.style.userSelect = previousUserSelect;

      const geometries = new Set<BufferGeometry>();
      const materials = new Set<Material>();
      const textures = new Set<Texture>();
      scene.traverse((object: Object3D) => {
        const resource = object as Object3D & {
          geometry?: BufferGeometry;
          material?: Material | Material[];
        };
        if (resource.geometry) geometries.add(resource.geometry);
        const objectMaterials = Array.isArray(resource.material)
          ? resource.material
          : resource.material
            ? [resource.material]
            : [];
        objectMaterials.forEach((material) => {
          materials.add(material);
          Object.values(material).forEach((value) => {
            if (value instanceof THREE.Texture) textures.add(value);
          });
        });
      });

      geometries.forEach((geometry) => geometry.dispose());
      textures.forEach((texture) => texture.dispose());
      materials.forEach((material) => material.dispose());
      scene.clear();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    }
  };
}
