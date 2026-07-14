// ============================================================
// PLC Lao Developer — interactive 3D scene (Three.js)
// Loaded lazily by the Design Component. Loads Three.js r128
// (+ UnrealBloom postprocessing) from CDN at runtime.
// Interactions: mouse parallax, hover on the core, drag to
// spin (with inertia), click shockwave, scroll-driven camera,
// gyro parallax on mobile.
// ============================================================

const CDN = "https://cdn.jsdelivr.net/npm/three@0.128.0";
const CORE_SRC = "/build/three.min.js";
const FX_SRCS = [
  "/examples/js/shaders/CopyShader.js",
  "/examples/js/shaders/LuminosityHighPassShader.js",
  "/examples/js/postprocessing/EffectComposer.js",
  "/examples/js/postprocessing/RenderPass.js",
  "/examples/js/postprocessing/ShaderPass.js",
  "/examples/js/postprocessing/UnrealBloomPass.js",
];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("failed: " + src));
    document.head.appendChild(s);
  });
}

function makeGlowTexture(THREE) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 256;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(140,190,255,0.9)");
  g.addColorStop(0.22, "rgba(70,130,246,0.4)");
  g.addColorStop(0.6, "rgba(40,80,200,0.12)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(cv);
}

export async function initScene(canvas, opts = {}) {
  if (canvas.__api) return canvas.__api;

  try {
    if (!window.THREE) await loadScript(CDN + CORE_SRC);
  } catch (e) {
    console.warn("[scene3d] three.js unavailable — 3D disabled");
    return null;
  }
  const THREE = window.THREE;
  if (!THREE) return null;

  let fxOK = true;
  try {
    if (!THREE.EffectComposer) for (const p of FX_SRCS) await loadScript(CDN + p);
  } catch (e) {
    fxOK = false;
  }

  const coarse = matchMedia("(pointer: coarse)").matches;
  const mobile = coarse || innerWidth < 820;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: "high-performance" });
  } catch (e) {
    console.warn("[scene3d] WebGL unavailable — 3D disabled");
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050810);
  scene.fog = new THREE.FogExp2(0x050810, 0.02);

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
  camera.position.set(0, 0.4, 16);

  // ---------- lights ----------
  scene.add(new THREE.AmbientLight(0x16244a, 1.15));
  const l1 = new THREE.PointLight(0x3b82f6, 1.6, 90);
  const l2 = new THREE.PointLight(0x22d3ee, 1.2, 90);
  scene.add(l1, l2);
  const dl = new THREE.DirectionalLight(0x7ca6ff, 0.4);
  dl.position.set(4, 12, 8);
  scene.add(dl);

  // ---------- core ----------
  const CORE_POS = new THREE.Vector3(0, 0.6, -2);
  const core = new THREE.Group();
  core.position.copy(CORE_POS);
  scene.add(core);

  const inner = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.05, 0),
    new THREE.MeshPhongMaterial({ color: 0x0a1f4d, emissive: 0x123c8f, emissiveIntensity: 0.9, shininess: 90, flatShading: true })
  );
  core.add(inner);

  const COL_BLUE = new THREE.Color(0x4c8dff);
  const COL_CYAN = new THREE.Color(0x37e2ff);
  const wireMat = new THREE.LineBasicMaterial({ color: 0x4c8dff, transparent: true, opacity: 0.55 });
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(3.05, 1)), wireMat);
  core.add(wire);
  const wire2 = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(4.05, 1)),
    new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.12 })
  );
  core.add(wire2);

  const glowTex = makeGlowTexture(THREE);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.45, depthWrite: false }));
  glow.scale.set(15, 15, 1);
  core.add(glow);

  const rings = [];
  const ringCols = [0x3b82f6, 0x22d3ee, 0x60a5fa];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(
      new THREE.TorusGeometry(4.5 + i * 0.75, 0.022 + i * 0.008, 8, 200),
      new THREE.MeshBasicMaterial({ color: ringCols[i], transparent: true, opacity: 0.4 - i * 0.09, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    r.rotation.set(1.15 + i * 0.42, 0.32 * i, 0.5 * i);
    core.add(r);
    rings.push(r);
  }

  const sats = [];
  for (let i = 0; i < 8; i++) {
    const sat = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.14 + (i % 3) * 0.05, 0),
      new THREE.MeshPhongMaterial({ color: 0x0e2a5c, emissive: i % 2 ? 0x22d3ee : 0x3b82f6, emissiveIntensity: 1.6, flatShading: true })
    );
    sat.userData = { r: 4.9 + ((i * 0.37) % 2.3), sp: 0.22 + (i % 4) * 0.09, ph: (i / 8) * Math.PI * 2, vy: 0.6 + (i % 3) * 0.5 };
    core.add(sat);
    sats.push(sat);
  }

  // ---------- environment ----------
  const grid = new THREE.GridHelper(120, 60, 0x2451b8, 0x0d1e46);
  grid.position.y = -7.5;
  grid.material.transparent = true;
  grid.material.opacity = 0.32;
  scene.add(grid);

  function makePoints(count, rMin, rMax, size, opacity, map) {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const palette = [0x1d4ed8, 0x3b82f6, 0x60a5fa, 0x22d3ee, 0x93c5fd].map((c) => new THREE.Color(c));
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize()
        .multiplyScalar(rMin + Math.random() * (rMax - rMin));
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y * 0.8; pos[i * 3 + 2] = v.z;
      const c = palette[(Math.random() * palette.length) | 0];
      const k = 0.5 + Math.random() * 0.5;
      col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size, vertexColors: true, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, map: map || null,
    });
    if (map) { mat.alphaTest = 0.01; }
    return new THREE.Points(geo, mat);
  }

  const stars = makePoints(mobile ? 900 : 2400, 9, 36, 0.085, 0.85);
  scene.add(stars);
  const dust = makePoints(mobile ? 120 : 300, 6, 24, 0.9, 0.12, glowTex);
  scene.add(dust);

  // ---------- shockwave pool ----------
  const shocks = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1.0, 64),
      new THREE.MeshBasicMaterial({ color: 0x8fc2ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })
    );
    m.position.copy(CORE_POS);
    m.userData.t = -1;
    scene.add(m);
    shocks.push(m);
  }

  // ---------- postprocessing ----------
  let composer = null, bloom = null;
  if (fxOK && !mobile && THREE.EffectComposer && THREE.UnrealBloomPass) {
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), opts.bloom ?? 1.05, 0.55, 0.2);
    composer.addPass(bloom);
    composer.setSize(innerWidth, innerHeight);
  }

  // ---------- interaction state ----------
  const tm = { x: 0, y: 0 }; // target pointer (NDC)
  const cm = { x: 0, y: 0 }; // eased pointer
  const spin = { x: 0, y: 0 };
  let heroP = 0, totP = 0, punch = 0, flash = 0, hover = false;
  let dragging = false, lx = 0, ly = 0;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const isInteractive = (el) => el && el.closest && el.closest("a,button,input,textarea,select,label,[data-no-pulse]");

  function pulse() {
    const m = shocks.find((s) => s.userData.t < 0) || shocks[0];
    m.userData.t = 0;
    m.scale.set(1, 1, 1);
    punch = 1;
    flash = 1;
  }

  const onMouse = (e) => {
    tm.x = (e.clientX / innerWidth) * 2 - 1;
    tm.y = -((e.clientY / innerHeight) * 2 - 1);
  };
  const onDown = (e) => {
    if (!e.isPrimary || isInteractive(e.target)) return;
    dragging = true;
    lx = e.clientX; ly = e.clientY;
    document.body.style.userSelect = "none";
    pulse();
  };
  const onDragMove = (e) => {
    if (!dragging) return;
    spin.y += (e.clientX - lx) * 0.0022;
    spin.x += (e.clientY - ly) * 0.0014;
    lx = e.clientX; ly = e.clientY;
  };
  const onUp = () => {
    dragging = false;
    document.body.style.userSelect = "";
  };
  const onOrient = (e) => {
    if (e.gamma == null) return;
    tm.x = Math.max(-1, Math.min(1, e.gamma / 28));
    tm.y = Math.max(-1, Math.min(1, -(e.beta - 45) / 28));
  };
  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    if (composer) composer.setSize(innerWidth, innerHeight);
  };

  window.addEventListener("mousemove", onMouse, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("pointermove", onDragMove, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  window.addEventListener("pointercancel", onUp, { passive: true });
  window.addEventListener("resize", onResize);
  if (coarse) window.addEventListener("deviceorientation", onOrient, { passive: true });

  // ---------- animation ----------
  const clock = new THREE.Clock();
  const lookTarget = new THREE.Vector3();

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    cm.x += (tm.x - cm.x) * 0.05;
    cm.y += (tm.y - cm.y) * 0.05;
    punch = Math.max(0, punch - dt * 2.6);
    flash = Math.max(0, flash - dt * 2.2);

    camera.position.x = cm.x * 1.7;
    camera.position.y = 0.4 - cm.y * 1.3 - heroP * 7;
    camera.position.z = 16 + heroP * 3 - punch * 0.6;
    lookTarget.set(0, 0.6 - heroP * 6.2, -2);
    camera.lookAt(lookTarget);

    // hover detection (ray vs core sphere)
    ndc.set(tm.x, tm.y);
    raycaster.setFromCamera(ndc, camera);
    hover = heroP < 0.5 && raycaster.ray.distanceToPoint(CORE_POS) < 3.6;

    // core motion: idle spin + drag inertia + pointer steer
    core.rotation.y += dt * 0.12 + spin.y;
    core.rotation.x += dt * 0.03 + spin.x;
    spin.x *= 1 - dt * 2.2;
    spin.y *= 1 - dt * 2.2;
    inner.rotation.y -= dt * 0.2;
    inner.rotation.x = cm.y * 0.22;
    wire2.rotation.y -= dt * 0.05;

    const scaleT = 1 + (hover ? 0.06 : 0) + flash * 0.1;
    core.scale.x += (scaleT - core.scale.x) * dt * 6;
    core.scale.y = core.scale.z = core.scale.x;

    wireMat.opacity = Math.min(1, 0.5 + (hover ? 0.28 : 0) + flash * 0.4);
    wireMat.color.lerp(hover ? COL_CYAN : COL_BLUE, dt * 5);
    glow.material.opacity = 0.4 + Math.sin(t * 1.4) * 0.07 + flash * 0.3 + (hover ? 0.1 : 0);

    rings.forEach((r, i) => { r.rotation.z += dt * (0.05 + i * 0.035); });
    sats.forEach((s) => {
      const u = s.userData;
      const a = t * u.sp + u.ph;
      s.position.set(Math.cos(a) * u.r, Math.sin(a * u.vy) * 1.15, Math.sin(a) * u.r);
      s.rotation.y += dt * 1.4;
    });

    stars.rotation.y = t * 0.016 + totP * 1.4;
    stars.material.opacity = 0.72 + Math.sin(t * 2.3) * 0.12 + flash * 0.25;
    dust.rotation.y = -t * 0.01 - totP * 0.5;

    l1.position.set(Math.cos(t * 0.3) * 9, 5 + Math.sin(t * 0.2) * 2, Math.sin(t * 0.3) * 9);
    l2.position.set(Math.cos(t * 0.24 + Math.PI) * 8, -3 + Math.cos(t * 0.31) * 2, Math.sin(t * 0.24 + Math.PI) * 8);

    grid.position.z = (t * 1.4) % 2;

    shocks.forEach((m) => {
      if (m.userData.t < 0) return;
      m.userData.t += dt / 0.85;
      if (m.userData.t >= 1) {
        m.userData.t = -1;
        m.material.opacity = 0;
      } else {
        const p = m.userData.t;
        m.scale.setScalar(1 + p * 14);
        m.material.opacity = (1 - p) * 0.8;
        m.quaternion.copy(camera.quaternion);
      }
    });

    if (composer) composer.render();
    else renderer.render(scene, camera);
  });

  const api = {
    onScroll(h, tp) { heroP = h; totP = tp; },
    setBloom(v) { if (bloom) bloom.strength = v; },
    pulse,
    dispose() {
      renderer.setAnimationLoop(null);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("deviceorientation", onOrient);
      renderer.dispose();
      canvas.__api = null;
    },
  };
  canvas.__api = api;
  return api;
}
