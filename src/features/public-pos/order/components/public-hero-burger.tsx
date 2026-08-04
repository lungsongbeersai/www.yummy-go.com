"use client";

import { useEffect, useRef, useState } from "react";
// type-only — ไม่ดึง three เข้า bundle ตัว runtime มาจาก dynamic import ข้างล่าง
import type { MeshBasicMaterial, MeshStandardMaterial } from "three";
import { cn } from "@/lib/utils";

const MODEL_URL = "/models/burger-hero.glb";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
}

/** เกณฑ์ขั้นต่ำก่อนยอมโหลดโมเดล
 *
 *  หน้านี้ลูกค้าเปิดผ่าน QR ด้วยเน็ตร้าน โมเดลจึงเป็นของแถม ไม่ใช่ของจำเป็น
 *  ถ้าด่านไหนไม่ผ่านก็ไม่โหลดอะไรเลย แล้วปล่อยให้ ornament แบบ CSS
 *  ที่วางซ้อนอยู่ข้างหลังทำงานต่อไปตามปกติ
 */
function shouldLoadScene() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return false;

  const nav = navigator as NavigatorWithHints;
  // เครื่องแรมน้อย/คอร์น้อยเรนเดอร์แล้วหนืด ค่า undefined = เบราว์เซอร์ไม่บอก ให้ผ่าน
  if ((nav.deviceMemory ?? 8) < 4) return false;
  if ((nav.hardwareConcurrency ?? 8) < 4) return false;

  // เคารพโหมดประหยัดเน็ตของผู้ใช้ และไม่ยัดไฟล์ลงเน็ต 2G
  const connection = nav.connection;
  if (connection?.saveData) return false;
  if (connection?.effectiveType && /2g/.test(connection.effectiveType)) {
    return false;
  }

  return true;
}

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ?? canvas.getContext("webgl"),
    );
  } catch {
    return false;
  }
}

/** เบอร์เกอร์ 3D ของ hero — โหลดแบบ dynamic ทั้ง three และตัวโมเดล
 *  จึงไม่มีอะไรถูกดาวน์โหลดเลยจนกว่าจะผ่านด่านและ hero เลื่อนเข้ามาในจอ */
export function HeroBurger({ className }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !shouldLoadScene() || !hasWebGL()) return;

    let disposed = false;
    let disposeScene: (() => void) | null = null;

    const start = async () => {
      const [THREE, { GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
        import("three"),
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import("three/examples/jsm/libs/meshopt_decoder.module.js"),
      ]);
      if (disposed) return;

      const loader = new GLTFLoader();
      // โมเดลบีบด้วย EXT_meshopt_compression ซึ่ง three ต้องมี decoder ถึงจะอ่านออก
      loader.setMeshoptDecoder(MeshoptDecoder);
      const gltf = await loader.loadAsync(MODEL_URL);
      if (disposed) return;

      const model = gltf.scene;

      // วัสดุต้นทางเป็น emissive ล้วน (baseColor ดำ) แสงอบมากับเท็กซ์เจอร์แล้ว
      // เปลี่ยนเป็น MeshBasicMaterial ให้ตรงกับที่มันเป็นจริง — ไม่ต้องมีไฟในฉาก
      // และไม่ต้องมี normal ซึ่งถูกตัดออกตอน optimize ไปแล้ว
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const source = object.material as MeshStandardMaterial;
        object.material = new THREE.MeshBasicMaterial({
          map: source.emissiveMap ?? source.map,
          side: THREE.DoubleSide,
          toneMapped: false,
        });
        source.dispose();
      });

      // จัดให้อยู่กึ่งกลางและปรับสเกลให้พอดีกรอบ ไม่ต้องพึ่งหน่วยที่มากับไฟล์
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);
      const maxAxis = Math.max(size.x, size.y, size.z) || 1;
      model.scale.setScalar(2 / maxAxis);

      const pivot = new THREE.Group();
      pivot.add(model);
      pivot.rotation.x = 0.18;

      const scene = new THREE.Scene();
      scene.add(pivot);

      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      camera.position.set(0, 0.1, 4.4);

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      renderer.setClearAlpha(0);
      Object.assign(renderer.domElement.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
      });
      mount.appendChild(renderer.domElement);

      const resize = () => {
        const width = mount.clientWidth;
        const height = mount.clientHeight;
        if (!width || !height) return;
        // จำกัด DPR ที่ 2 — สูงกว่านี้ตาแทบไม่เห็นต่าง แต่ค่า fill rate พุ่ง
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      resize();

      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(mount);

      let frameId = 0;
      let running = false;
      let lastTime = performance.now();

      const renderFrame = (now: number) => {
        const delta = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        pivot.rotation.y += delta * 0.35;
        pivot.position.y = Math.sin(now / 1600) * 0.06;
        renderer.render(scene, camera);
        frameId = requestAnimationFrame(renderFrame);
      };

      const setRunning = (next: boolean) => {
        if (next === running) return;
        running = next;
        if (next) {
          lastTime = performance.now();
          frameId = requestAnimationFrame(renderFrame);
        } else if (frameId) {
          cancelAnimationFrame(frameId);
          frameId = 0;
        }
      };

      // หยุดวาดเมื่อสลับแท็บหรือเลื่อน hero พ้นจอ — ไม่กินแบตตอนไม่มีใครดู
      let onScreen = true;
      const syncRunning = () => setRunning(onScreen && !document.hidden);
      const visibilityObserver = new IntersectionObserver((entries) => {
        onScreen = entries.some((entry) => entry.isIntersecting);
        syncRunning();
      });
      visibilityObserver.observe(mount);
      document.addEventListener("visibilitychange", syncRunning);
      syncRunning();

      setReady(true);

      disposeScene = () => {
        setRunning(false);
        resizeObserver.disconnect();
        visibilityObserver.disconnect();
        document.removeEventListener("visibilitychange", syncRunning);
        scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.geometry.dispose();
          const material = object.material as MeshBasicMaterial;
          material.map?.dispose();
          material.dispose();
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
    };

    // เริ่มโหลดเมื่อ hero ใกล้เข้าจอเท่านั้น
    const loadObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        loadObserver.disconnect();
        void start().catch(() => {
          // โหลดไม่ได้ก็ปล่อยผ่าน — ornament แบบ CSS ยังอยู่ข้างหลัง
        });
      },
      { rootMargin: "200px" },
    );
    loadObserver.observe(mount);

    return () => {
      disposed = true;
      loadObserver.disconnect();
      disposeScene?.();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute transition-opacity duration-700 motion-reduce:transition-none",
        ready ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  );
}
