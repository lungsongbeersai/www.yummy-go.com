"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { AdaptiveDpr } from "@react-three/drei/core/AdaptiveDpr";
import { OrbitControls } from "@react-three/drei/core/OrbitControls";
import { SceneLabel as Html } from "./scene-label";
import { CanvasTexture, Color, Object3D, RepeatWrapping, SRGBColorSpace, Vector3, type Group, type InstancedMesh, type Texture } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { useTranslation } from "react-i18next";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export interface SceneTable {
  id: string;
  name: string;
  zone: string;
  status: string;
  guests: number | null;
  seats?: number | null;
}

export interface SceneCharacter {
  id: string;
  role: "customer" | "waiter" | "chef" | "cashier";
  state: string;
  tableId?: string;
}

export interface RestaurantSceneProps {
  tables: SceneTable[];
  selectedTableId: string | null;
  onSelectTable: (id: string) => void;
  paused: boolean;
  characters: SceneCharacter[];
  onSelectCharacter?: (id: string) => void;
  selectedCharacterId?: string | null;
  onStopFollowing?: () => void;
}

interface Palette {
  background: Color;
  floor: Color;
  wood: Color;
  plant: Color;
  kitchen: Color;
  cashier: Color;
  wall: Color;
  rug: Color;
  furniture: Color;
  trim: Color;
  primary: Color;
  paper: Color;
  success: Color;
  warning: Color;
  info: Color;
  billing: Color;
  pending: Color;
  destructive: Color;
}

interface PlacedTable extends SceneTable {
  x: number;
  z: number;
  zoneIndex: number;
}

interface FloorPlan {
  tables: PlacedTable[];
  width: number;
  depth: number;
}

type Position = [number, number, number];

interface ViewControls {
  zoom: (factor: number) => void;
  reset: () => void;
}

function tableRadius(table: SceneTable) {
  return 0.78 + Math.max(0, Math.min(table.seats || 4, 8) - 4) * 0.045;
}

function chairLayout(table: PlacedTable) {
  const count = Math.min(8, Math.max(1, Math.round(table.seats || 4)));
  const radius = tableRadius(table) + 0.37;
  return Array.from({ length: count }, (_, index) => {
    const angle = index * Math.PI * 2 / count + (count === 2 ? Math.PI / 2 : 0);
    return { x: table.x + Math.sin(angle) * radius, z: table.z + Math.cos(angle) * radius, angle };
  });
}

function createFloorPlan(tables: SceneTable[]): FloorPlan {
  const columns = Math.max(2, Math.ceil(Math.sqrt(Math.max(tables.length, 1))));
  const rows = Math.max(2, Math.ceil(tables.length / columns));
  const zones = [...new Set(tables.map((table) => table.zone))];
  return {
    tables: tables.map((table, index) => ({
      ...table,
      x: (index % columns - (columns - 1) / 2) * 3.5,
      z: (Math.floor(index / columns) - (rows - 1) / 2) * 3.6,
      zoneIndex: zones.indexOf(table.zone),
    })),
    width: Math.max(14, columns * 3.5 + 5),
    depth: Math.max(14, rows * 3.6 + 7),
  };
}

function available(status: string) {
  return ["available", "free", "empty", "1"].includes(status.toLowerCase());
}

function tableStatusColor(status: string, palette: Palette): Color {
  if (available(status)) return palette.success;
  if (["draft", "3"].includes(status)) return palette.pending;
  if (["awaiting", "4"].includes(status)) return palette.warning;
  if (["calling", "5"].includes(status)) return palette.destructive;
  if (["billing", "6"].includes(status)) return palette.billing;
  return palette.info;
}

function makeWoodTexture(palette: Palette) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = `#${palette.wood.clone().lerp(palette.paper, 0.3).getHexString()}`;
  context.fillRect(0, 0, 256, 256);
  const grain = palette.wood.clone().lerp(palette.furniture, 0.15);
  context.strokeStyle = `#${grain.getHexString()}`;
  for (let line = 0; line < 64; line++) {
    context.globalAlpha = 0.035 + (line % 5) * 0.012;
    context.lineWidth = line % 7 === 0 ? 1.6 : 0.6;
    context.beginPath();
    for (let y = 0; y <= 256; y += 8) {
      const x = line * 4 + Math.sin(y / 55 + line * 0.7) * 2.2;
      if (y === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

function useScenePalette() {
  const [palette, setPalette] = useState<Palette | null>(null);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    const resolve = (styles: CSSStyleDeclaration, token: string) => {
      // Browser color parsing supports the app's OKLCH tokens; Three's CSS parser does not.
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = styles.getPropertyValue("--background").trim() || styles.backgroundColor;
      context.fillRect(0, 0, 1, 1);
      context.fillStyle = styles.getPropertyValue(token).trim() || styles.color;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
      return new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
    };
    const update = () => {
      const workspace = document.querySelector(".simulator-workspace") ?? document.documentElement;
      const styles = getComputedStyle(workspace);
      setPalette({
        background: resolve(styles, "--muted"),
        floor: resolve(styles, "--simulator-floor"),
        wood: resolve(styles, "--simulator-wood"),
        plant: resolve(styles, "--simulator-plant"),
        kitchen: resolve(styles, "--simulator-kitchen"),
        cashier: resolve(styles, "--simulator-cashier"),
        wall: resolve(styles, "--simulator-wall"),
        rug: resolve(styles, "--simulator-rug"),
        furniture: resolve(styles, "--muted-foreground"),
        trim: resolve(styles, "--border"),
        primary: resolve(styles, "--primary"),
        paper: resolve(styles, "--primary-foreground"),
        success: resolve(styles, "--success"),
        warning: resolve(styles, "--warning"),
        info: resolve(styles, "--info"),
        billing: resolve(styles, "--chart-cat-5"),
        pending: resolve(styles, "--pending"),
        destructive: resolve(styles, "--destructive"),
      });
    };
    const frame = requestAnimationFrame(update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme-color", "style"],
    });
    const workspace = document.querySelector(".simulator-workspace");
    if (workspace) observer.observe(workspace, { attributes: true, attributeFilter: ["class", "style"] });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);
  return palette;
}

function usePageVisibility() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(!document.hidden && document.hasFocus());
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    const frame = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
    };
  }, []);
  return visible;
}

function RenderClock({ running, visible }: { running: boolean; visible: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (!visible || !running) return;
    // Demand rendering caps animation work at 30 frames/s even on high-refresh POS screens.
    const interval = window.setInterval(invalidate, 1000 / 30);
    return () => window.clearInterval(interval);
  }, [invalidate, running, visible]);
  return null;
}

function GraphicsLifecycle({ onContextChange }: { onContextChange: (lost: boolean) => void }) {
  const renderer = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const canvas = renderer.domElement;
    const lost = (event: Event) => {
      event.preventDefault();
      onContextChange(true);
    };
    const restored = () => {
      onContextChange(false);
      invalidate();
    };
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
    };
  }, [renderer, invalidate, onContextChange]);
  return null;
}

function Instances({
  positions,
  size,
  color,
  rotations,
  radius,
}: {
  positions: Position[];
  size: Position;
  color: Color;
  rotations?: Position[];
  radius?: number;
}) {
  const ref = useRef<InstancedMesh>(null);
  const [width, height, depth] = size;
  const geometry = useMemo(() => radius ? new RoundedBoxGeometry(width, height, depth, 2, radius) : null, [width, height, depth, radius]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const transform = new Object3D();
    positions.forEach((position, index) => {
      transform.position.set(...position);
      transform.rotation.set(...(rotations?.[index] ?? [0, 0, 0]));
      transform.updateMatrix();
      ref.current?.setMatrixAt(index, transform.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [positions, rotations]);
  if (!positions.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, positions.length]} castShadow receiveShadow>
      {geometry ? <primitive object={geometry} attach="geometry" /> : <boxGeometry args={size} />}
      <meshStandardMaterial color={color} roughness={0.8} />
    </instancedMesh>
  );
}

function Cylinders({ positions, radius, height, color, opacity = 1 }: {
  positions: Position[];
  radius: number;
  height: number;
  color: Color;
  opacity?: number;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const transform = new Object3D();
    positions.forEach((position, index) => {
      transform.position.set(...position);
      transform.updateMatrix();
      ref.current?.setMatrixAt(index, transform.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [positions]);
  if (!positions.length) return null;
  return <instancedMesh ref={ref} args={[undefined, undefined, positions.length]} castShadow receiveShadow>
    <cylinderGeometry args={[radius, radius * 0.93, height, 24]} />
    <meshStandardMaterial color={color} roughness={opacity < 1 ? 0.12 : 0.45} metalness={opacity < 1 ? 0.15 : 0} transparent={opacity < 1} opacity={opacity} />
  </instancedMesh>;
}

function Box({
  position,
  size,
  color,
  rotation,
  metalness = 0,
  roughness = 0.75,
  map,
}: {
  position: Position;
  size: Position;
  color: Color;
  rotation?: Position;
  metalness?: number;
  roughness?: number;
  map?: Texture | null;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} map={map} />
    </mesh>
  );
}

function RestaurantFurniture({ plan, palette }: { plan: FloorPlan; palette: Palette }) {
  const { t } = useTranslation("simulator");
  const seatingZones = useMemo(() => [...new Set(plan.tables.map((table) => table.zoneIndex))].map((index) => {
    const tables = plan.tables.filter((table) => table.zoneIndex === index);
    const chairs = tables.flatMap(chairLayout);
    const seats: Position[] = chairs.map(({ x, z }) => [x, 0.48, z]);
    const shells: Position[] = chairs.map(({ x, z }) => [x, 0.405, z]);
    const backs: Position[] = chairs.map(({ x, z, angle }) => [x + Math.sin(angle) * 0.28, 0.78, z + Math.cos(angle) * 0.28]);
    const backFrames: Position[] = chairs.map(({ x, z, angle }) => [x + Math.sin(angle) * 0.32, 0.76, z + Math.cos(angle) * 0.32]);
    const rotations: Position[] = chairs.map(({ angle }) => [0, angle, 0]);
    const legs: Position[] = chairs.flatMap(({ x, z, angle }) => [-0.22, 0.22].flatMap((side) => [-0.22, 0.22].map((front): Position => [
      x + side * Math.cos(angle) + front * Math.sin(angle), 0.22,
      z - side * Math.sin(angle) + front * Math.cos(angle),
    ])));
    return { index, seats, shells, backs, backFrames, rotations, legs };
  }), [plan]);
  const tableBases = useMemo<Position[]>(() => plan.tables.map((table) => [table.x, 0.43, table.z]), [plan]);
  const tableFeet = useMemo<Position[]>(() => plan.tables.map((table) => [table.x, 0.09, table.z]), [plan]);
  const placeSettings = useMemo(() => {
    const plates: Position[] = [];
    const rims: Position[] = [];
    const mats: Position[] = [];
    const glasses: Position[] = [];
    const cutlery: Position[] = [];
    const rotations: Position[] = [];
    plan.tables.forEach((table) => chairLayout(table).forEach(({ angle }) => {
      const radius = tableRadius(table) * 0.65;
      const x = table.x + Math.sin(angle) * radius;
      const z = table.z + Math.cos(angle) * radius;
      plates.push([x, 1.001, z]);
      rims.push([x, 0.994, z]);
      mats.push([x, 0.984, z]);
      glasses.push([x + Math.cos(angle) * 0.2 - Math.sin(angle) * 0.13, 1.063, z - Math.sin(angle) * 0.2 - Math.cos(angle) * 0.13]);
      [-1, 1].forEach((side) => {
        cutlery.push([x + Math.cos(angle) * 0.205 * side, 1.001, z - Math.sin(angle) * 0.205 * side]);
        rotations.push([0, angle, 0]);
      });
    }));
    return { plates, rims, mats, glasses, cutlery, rotations };
  }, [plan]);
  const zoneLabels = useMemo(() => [...new Map(plan.tables.filter((table) => table.zone).map((table) => [table.zone, table])).values()], [plan]);
  const floorSeams = useMemo<Position[]>(() => Array.from({ length: Math.floor(plan.width / 1.8) }, (_, index) => [
    -plan.width / 2 + (index + 1) * 1.8, 0.028, 0,
  ]), [plan.width]);
  const crossSeams = useMemo<Position[]>(() => Array.from({ length: Math.floor(plan.depth / 1.8) }, (_, index) => [
    0, 0.028, -plan.depth / 2 + (index + 1) * 1.8,
  ]), [plan.depth]);
  const wallSlats = useMemo<Position[]>(() => Array.from({ length: Math.floor(plan.width / 0.3) }, (_, index) => [
    -plan.width / 2 + (index + 0.5) * 0.3, 0.45, -plan.depth / 2 + 0.12,
  ]), [plan.width, plan.depth]);
  const tones = useMemo(() => ({
    seam: palette.floor.clone().lerp(palette.wood, 0.16),
    metal: palette.kitchen.clone().lerp(palette.paper, 0.45),
    tile: palette.kitchen.clone().lerp(palette.wall, 0.7),
    leaf: palette.plant.clone().lerp(palette.paper, 0.2),
    timber: palette.wood.clone().lerp(palette.paper, 0.18),
    chairFrame: palette.wood.clone().lerp(palette.furniture, 0.28),
    linen: palette.rug.clone().lerp(palette.paper, 0.4),
    porcelain: palette.paper.clone().lerp(palette.wall, 0.25),
  }), [palette]);
  const counterZ = -plan.depth / 2 + 1.45;
  const cashierX = plan.width / 2 - 1.3;
  const entryZ = plan.depth / 2 - 0.2;
  return (
    <group>
      <Box position={[0, -0.19, 0]} size={[plan.width, 0.35, plan.depth]} color={tones.timber} />
      <Box position={[0, 0, 0]} size={[plan.width - 0.15, 0.05, plan.depth - 0.15]} color={palette.floor} />
      <Instances positions={floorSeams} size={[0.012, 0.003, plan.depth - 0.2]} color={tones.seam} />
      <Instances positions={crossSeams} size={[plan.width - 0.2, 0.003, 0.012]} color={tones.seam} />
      <Box position={[0, 0.035, counterZ]} size={[plan.width - 0.4, 0.05, 2.9]} color={tones.tile} />
      <Box position={[0, 1.1, -plan.depth / 2]} size={[plan.width, 2.2, 0.15]} color={palette.wall} />
      <Box position={[0, 2.2, -plan.depth / 2]} size={[plan.width, 0.06, 0.2]} color={tones.timber} />
      <Box position={[0, 0.45, -plan.depth / 2 + 0.08]} size={[plan.width - 0.1, 0.8, 0.08]} color={palette.cashier} />
      <Instances positions={wallSlats} size={[0.035, 0.75, 0.025]} color={tones.timber} />
      <Box position={[-plan.width / 2, 0.5, -1]} size={[0.15, 1, plan.depth - 2]} color={palette.wall} />
      <Box position={[-plan.width / 2, 1.03, -1]} size={[0.22, 0.06, plan.depth - 2]} color={tones.timber} />
      {seatingZones.map((zone) => {
        const color = palette.cashier.clone().lerp(palette.rug, zone.index % 3 * 0.13);
        return <group key={zone.index}>
          <Instances positions={zone.legs} size={[0.065, 0.38, 0.065]} color={tones.chairFrame} />
          <Instances positions={zone.shells} rotations={zone.rotations} size={[0.66, 0.075, 0.64]} radius={0.035} color={tones.chairFrame} />
          <Instances positions={zone.seats} rotations={zone.rotations} size={[0.62, 0.14, 0.6]} radius={0.06} color={color} />
          <Instances positions={zone.backFrames} rotations={zone.rotations} size={[0.67, 0.48, 0.07]} radius={0.03} color={tones.chairFrame} />
          <Instances positions={zone.backs} rotations={zone.rotations} size={[0.61, 0.42, 0.11]} radius={0.05} color={color} />
        </group>;
      })}
      <Instances positions={tableBases} size={[0.13, 0.8, 0.13]} color={tones.chairFrame} />
      <Instances positions={tableFeet} size={[0.85, 0.09, 0.12]} radius={0.03} color={tones.chairFrame} />
      <Instances positions={tableFeet} size={[0.12, 0.09, 0.85]} radius={0.03} color={tones.chairFrame} />
      <Cylinders positions={placeSettings.mats} radius={0.225} height={0.006} color={tones.linen} />
      <Cylinders positions={placeSettings.rims} radius={0.175} height={0.014} color={tones.porcelain} />
      <Cylinders positions={placeSettings.plates} radius={0.135} height={0.012} color={palette.paper} />
      <Cylinders positions={placeSettings.glasses} radius={0.045} height={0.14} color={palette.paper} opacity={0.65} />
      <Instances positions={placeSettings.cutlery} rotations={placeSettings.rotations} size={[0.025, 0.012, 0.18]} color={tones.metal} />
      {plan.tables.map((table) => <mesh key={table.id} position={[table.x, 0.058, table.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.8, 1]}>
        <circleGeometry args={[1.15, 32]} />
        <meshBasicMaterial color={palette.furniture} transparent opacity={0.055} depthWrite={false} />
      </mesh>)}
      {zoneLabels.map((table) => <Html key={table.zone} center position={[table.x, 0.1, table.z - 1.65]} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <span className="block max-w-28 truncate rounded border border-border/50 bg-card/85 px-2 py-0.5 font-lao text-[10px] font-medium text-muted-foreground">{table.zone}</span>
      </Html>)}

      <Box position={[-2, 0.55, counterZ]} size={[5.1, 1.1, 1]} color={palette.kitchen} metalness={0.35} />
      <Box position={[-2, 1.14, counterZ]} size={[5.25, 0.14, 1.13]} color={tones.metal} metalness={0.65} roughness={0.35} />
      {[-3.6, -2, -0.4].map((x) => <Box key={x} position={[x, 0.55, counterZ + 0.52]} size={[1.45, 0.82, 0.04]} color={tones.metal} metalness={0.45} />)}
      {[-3.5, -2.5, -1.5].map((x) => (
        <group key={x} position={[x, 1.24, counterZ]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.23, 0.055, 6, 12]} />
            <meshStandardMaterial color={palette.wood} />
          </mesh>
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.2, 0.17, 0.14, 8]} />
            <meshStandardMaterial color={tones.metal} metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      ))}
      <Box position={[1.7, 0.8, counterZ - 0.55]} size={[0.9, 1.6, 0.75]} color={tones.metal} metalness={0.4} />
      <Box position={[1.7, 0.8, counterZ - 0.13]} size={[0.05, 0.7, 0.04]} color={palette.furniture} />
      <Box position={[cashierX, 0.5, 1]} size={[1.45, 1, 2.8]} color={palette.wall} />
      <Box position={[cashierX, 1.04, 1]} size={[1.6, 0.1, 2.95]} color={tones.timber} />
      <Box position={[cashierX - 0.74, 0.5, 1]} size={[0.04, 0.8, 2.55]} color={palette.cashier} />
      {Array.from({ length: 12 }, (_, index) => <Box key={index} position={[cashierX - 0.77, 0.5, -0.18 + index * 0.215]} size={[0.02, 0.76, 0.035]} color={tones.timber} />)}
      <Box position={[cashierX, 1.3, 0.6]} size={[0.6, 0.42, 0.08]} color={palette.furniture} rotation={[-0.2, -Math.PI / 2, 0]} />
      <Box position={[cashierX - 0.05, 1.32, 0.6]} size={[0.025, 0.3, 0.47]} color={palette.info} rotation={[0, 0, -0.2]} />
      <Box position={[cashierX, 1.12, 1.85]} size={[0.4, 0.2, 0.4]} color={palette.furniture} />
      <Box position={[cashierX, 1.25, 1.9]} size={[0.23, 0.07, 0.23]} color={palette.paper} />
      <Box position={[-4.4, 1.28, counterZ]} size={[0.45, 0.25, 0.4]} color={palette.furniture} />
      <Box position={[-4.4, 1.43, counterZ + 0.1]} size={[0.28, 0.07, 0.27]} color={palette.paper} />
      <Box position={[-1.25, 1, entryZ]} size={[0.14, 2, 0.14]} color={palette.wood} />
      <Box position={[1.25, 1, entryZ]} size={[0.14, 2, 0.14]} color={palette.wood} />
      <Box position={[0, 2.05, entryZ]} size={[2.64, 0.18, 0.2]} color={palette.wood} />
      <Box position={[0, 0.045, entryZ - 0.8]} size={[2.3, 0.025, 1.3]} color={palette.cashier} />
      {[-1, 1].flatMap((side) => [entryZ - 1, counterZ + 0.6].map((z) => (
        <group key={`${side}:${z}`} position={[side * (plan.width / 2 - 0.7), 0, z]}>
          <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.32, 0.23, 0.48, 24]} />
            <meshStandardMaterial color={palette.wall} roughness={0.85} />
          </mesh>
          <Cylinders positions={[[0, 0.48, 0]]} radius={0.28} height={0.02} color={palette.wood} />
          <Box position={[0, 0.85, 0]} size={[0.045, 0.95, 0.045]} color={palette.wood} />
          {Array.from({ length: 7 }, (_, index) => {
            const angle = index * Math.PI * 2 / 7;
            return <mesh key={index} position={[Math.sin(angle) * 0.23, 0.95 + index % 3 * 0.2, Math.cos(angle) * 0.23]} scale={[0.45, 1, 0.2]} rotation={[0.3 * Math.cos(angle), angle, -0.4 * Math.sin(angle)]} castShadow>
              <sphereGeometry args={[0.42, 10, 6]} />
              <meshStandardMaterial color={index % 2 ? palette.plant : tones.leaf} roughness={0.85} />
            </mesh>;
          })}
        </group>
      )))}
      <Html center position={[-1.7, 2.1, counterZ]} zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
        <span className="block whitespace-nowrap rounded-md border border-info/30 bg-card/95 px-2 py-1 font-lao text-xs font-semibold text-foreground shadow-sm">
          {t("scene.kitchen", { defaultValue: "Kitchen" })}
        </span>
      </Html>
      <Html center position={[cashierX, 1.9, 1]} zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
        <span className="block whitespace-nowrap rounded-md border border-primary/30 bg-card/95 px-2 py-1 font-lao text-xs font-semibold text-foreground shadow-sm">
          {t("scene.cashier", { defaultValue: "Cashier" })}
        </span>
      </Html>
      <Html center position={[0, 2.4, entryZ]} zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
        <span className="block whitespace-nowrap rounded-md border border-primary/30 bg-primary px-2 py-1 font-lao text-xs font-semibold text-primary-foreground shadow-sm">
          {t("scene.entrance", { defaultValue: "Entrance" })}
        </span>
      </Html>
    </group>
  );
}

function DiningTable({ table, palette, selected, onSelect, woodTexture }: {
  table: PlacedTable;
  palette: Palette;
  selected: boolean;
  onSelect: (id: string) => void;
  woodTexture: Texture | null;
}) {
  const statusColor = tableStatusColor(table.status, palette);
  const radius = tableRadius(table);
  const statusDot = available(table.status) ? "bg-success"
    : table.status === "draft" ? "bg-pending"
      : table.status === "awaiting" ? "bg-warning"
        : table.status === "calling" ? "bg-destructive"
          : table.status === "billing" ? "bg-chart-cat-5" : "bg-info";
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(table.id);
  };
  return (
    <group position={[table.x, 0, table.z]} onClick={handleClick}>
      <mesh position={[0, 0.93, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius - 0.015, 0.1, 48]} />
        <meshStandardMaterial color={woodTexture ? palette.paper : palette.wood} map={woodTexture} roughness={0.58} />
      </mesh>
      <mesh position={[0, 0.875, 0]} castShadow>
        <cylinderGeometry args={[radius - 0.025, radius - 0.07, 0.025, 48]} />
        <meshStandardMaterial color={palette.wood} roughness={0.65} />
      </mesh>
      {selected && <>
        <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[radius + 0.8, 48]} />
          <meshBasicMaterial color={palette.primary} transparent opacity={0.065} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.048, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius + 0.76, radius + 0.8, 48]} />
          <meshBasicMaterial color={statusColor} transparent opacity={0.75} depthWrite={false} />
        </mesh>
      </>}
      <group position={[0, 1.025, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.065, 0.055, 0.09, 16]} />
            <meshStandardMaterial color={palette.wall} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.09, 0]} scale={[1, 1.2, 1]} castShadow>
            <sphereGeometry args={[0.075, 10, 6]} />
            <meshStandardMaterial color={palette.plant} roughness={0.9} />
          </mesh>
      </group>
      <Html center position={[0, 1.37, 0]} zIndexRange={[50, 0]}>
        <button
          type="button"
          className={`inline-flex min-h-8 min-w-10 items-center justify-center gap-1.5 rounded-md border px-2 py-1 font-lao text-[11px] font-semibold shadow-sm focus-visible:outline-2 focus-visible:outline-ring ${selected ? "border-primary bg-primary text-primary-foreground shadow-md" : "border-border/65 bg-card/95 text-foreground"}`}
          aria-label={`${table.name} · ${table.zone} · ${table.status}${table.guests === null ? "" : ` · ${table.guests}`}`}
          aria-pressed={selected}
          onClick={() => onSelect(table.id)}
        >
          <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${selected ? "bg-primary-foreground" : statusDot}`} />
          <span className="max-w-20 truncate">{table.name}</span>
        </button>
      </Html>
    </group>
  );
}

function characterDestination(character: SceneCharacter, index: number, plan: FloorPlan): Position {
  const table = plan.tables.find((candidate) => candidate.id === character.tableId);
  const state = character.state.toLowerCase();
  if (character.role === "chef") return [-1.5 + index % 2, 0, -plan.depth / 2 + 0.55];
  if (character.role === "cashier") return [plan.width / 2 - 0.45, 0, 1];
  if (/enter|arriv|leav|exit|^left$/.test(state)) return [(index % 3 - 1) * 0.5, 0, plan.depth / 2 - 0.85];
  if (/^waiting$|wait.*seat|queue|welcom/.test(state)) return [-2.3, 0, plan.depth / 2 - 1.2 - (index % 3) * 0.6];
  if (table) {
    if (character.role === "waiter") return [table.x + 1.5, 0, table.z + 0.9];
    const chairs = chairLayout(table);
    const seat = chairs[index % chairs.length];
    return [seat.x, 0.24, seat.z];
  }
  return [plan.width / 2 - 2.6, 0, -1.8 + (index % 3) * 0.8];
}

function Character({ character, index, plan, palette, paused, onSelect, followed, followPosition }: {
  character: SceneCharacter;
  index: number;
  plan: FloorPlan;
  palette: Palette;
  paused: boolean;
  onSelect: (id: string) => void;
  followed: boolean;
  followPosition: RefObject<Vector3>;
}) {
  const group = useRef<Group>(null);
  const legs = useRef<Group>(null);
  const arms = useRef<Group>(null);
  const seated = character.role === "customer" && Boolean(character.tableId)
    && !/enter|arriv|leav|exit|walk|queue|seat.*wait/.test(character.state.toLowerCase());
  const destination = useMemo(() => new Vector3(...characterDestination(character, index, plan)), [character, index, plan]);
  const [initialPosition] = useState<Position>(() => character.role === "customer" && !paused
    ? [0, 0, plan.depth / 2 - 0.7]
    : characterDestination(character, index, plan));
  const outfitIndex = useMemo(() => [...character.id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0), [character.id]);
  const color = character.role === "chef" ? palette.paper
    : character.role === "waiter" ? palette.primary
      : character.role === "cashier" ? palette.cashier
        : [palette.info, palette.rug, palette.warning, palette.pending, palette.primary, palette.cashier][outfitIndex % 6];
  const skin = useMemo(() => palette.paper.clone().lerp(palette.wood, 0.18 + outfitIndex % 4 * 0.08), [palette, outfitIndex]);
  const hair = useMemo(() => palette.wood.clone().lerp(palette.furniture, 0.3), [palette]);
  const apron = character.role === "chef" ? palette.kitchen : palette.paper;
  useLayoutEffect(() => {
    // A read-only scene has no animation clock; keep markers with their tables
    // when zone filtering or a refreshed layout changes table positions.
    if (paused && group.current) {
      group.current.position.copy(destination);
      const table = plan.tables.find((candidate) => candidate.id === character.tableId);
      if (seated && table) group.current.rotation.y = Math.atan2(table.x - destination.x, table.z - destination.z);
    }
  }, [paused, destination, seated, plan, character.tableId]);
  useFrame((state, delta) => {
    if (!group.current) return;
    const person = group.current;
    if (!paused) {
      const remaining = person.position.distanceTo(destination);
      if (remaining > 0.035) {
        person.rotation.y = Math.atan2(destination.x - person.position.x, destination.z - person.position.z);
        person.position.lerp(destination, Math.min(delta * 2.2, 1));
      }
      if (seated && remaining <= 0.035) {
        const table = plan.tables.find((candidate) => candidate.id === character.tableId);
        if (table) person.rotation.y = Math.atan2(table.x - person.position.x, table.z - person.position.z);
      }
      if (legs.current && !seated) legs.current.rotation.x = remaining > 0.12 ? Math.sin(state.clock.elapsedTime * 7 + index) * 0.2 : 0;
      if (arms.current) {
        const working = /prepar|cook|eating|pay|serv|order/.test(character.state.toLowerCase());
        arms.current.rotation.x = working ? -0.45 + Math.sin(state.clock.elapsedTime * 3 + index) * 0.2 : 0;
      }
    }
    if (followed) {
      followPosition.current.set(person.position.x, person.position.y + 0.6, person.position.z);
    }
  });
  return (
    <group ref={group} position={initialPosition} scale={[1, seated ? 0.72 : 1, 1]} onClick={(event) => { event.stopPropagation(); onSelect(character.id); }}>
      <mesh position={[0, 0.88, 0]}>
        <capsuleGeometry args={[0.19, 0.37, 3, 6]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      <mesh position={[0, 1.34, 0]}>
        <sphereGeometry args={[0.17, 8, 6]} />
        <meshStandardMaterial color={skin} flatShading />
      </mesh>
      <mesh position={[0, 1.39, -0.025]} rotation={[-0.15, 0, 0]}>
        <sphereGeometry args={[0.175, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={hair} flatShading />
      </mesh>
      {character.role !== "customer" && <Box position={[0, 0.82, 0.18]} size={[0.27, 0.37, 0.035]} color={apron} />}
      <group ref={arms} position={[0, 1.03, 0]}>
        <Box position={[-0.26, -0.15, 0]} size={[0.12, 0.43, 0.13]} color={color} />
        <Box position={[0.26, -0.15, 0]} size={[0.12, 0.43, 0.13]} color={color} />
      </group>
      <group ref={legs} rotation={seated ? [0.5, 0, 0] : [0, 0, 0]}>
        <Box position={[-0.1, 0.35, 0]} size={[0.12, 0.55, 0.13]} color={palette.furniture} />
        <Box position={[0.1, 0.35, 0]} size={[0.12, 0.55, 0.13]} color={palette.furniture} />
        <Box position={[-0.1, 0.1, 0.035]} size={[0.15, 0.1, 0.22]} color={palette.wood} />
        <Box position={[0.1, 0.1, 0.035]} size={[0.15, 0.1, 0.22]} color={palette.wood} />
      </group>
      {character.role === "chef" && <mesh position={[0, 1.55, 0]}>
        <cylinderGeometry args={[0.23, 0.18, 0.2, 8]} />
        <meshStandardMaterial color={palette.paper} />
      </mesh>}
      {character.role === "waiter" && <mesh position={[0.35, 0.98, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.04, 10]} />
        <meshStandardMaterial color={palette.furniture} />
      </mesh>}
      {followed && <Html center position={[0, 1.85, 0]} zIndexRange={[60, 0]} style={{ pointerEvents: "none" }}>
        <span className="pointer-events-none whitespace-nowrap rounded-md border border-primary/40 bg-card px-2 py-1 font-lao text-xs text-foreground shadow-sm">{character.state}</span>
      </Html>}
    </group>
  );
}

function SceneContents({ tables, selectedTableId, onSelectTable, paused, characters, palette, visible, followedId, onSelectCharacter, onContextChange, viewControlsRef }: RestaurantSceneProps & {
  palette: Palette;
  visible: boolean;
  followedId: string | null;
  onSelectCharacter: (id: string) => void;
  onContextChange: (lost: boolean) => void;
  viewControlsRef: RefObject<ViewControls | null>;
}) {
  const plan = useMemo(() => createFloorPlan(tables), [tables]);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const followPosition = useRef(new Vector3());
  const previousTarget = useMemo(() => new Vector3(), []);
  const woodTexture = useMemo(() => makeWoodTexture(palette), [palette]);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const aspect = useThree((state) => state.size.width / state.size.height);
  const extent = Math.max(plan.width, plan.depth);
  useEffect(() => () => woodTexture?.dispose(), [woodTexture]);
  useEffect(() => {
    const reset = () => {
      const fit = Math.max(1, 1.15 / Math.max(aspect, 0.4));
      camera.position.set(extent * 0.61 * fit, extent * 0.82 * fit, extent * 0.83 * fit);
      controls.current?.target.set(0, 0, 0);
      controls.current?.update();
      invalidate();
    };
    const actions: ViewControls = {
      reset,
      zoom: (factor) => {
        const target = controls.current?.target;
        if (!target) return;
        const offset = camera.position.clone().sub(target);
        const distance = Math.min(extent * 3.5, Math.max(5, offset.length() * factor));
        camera.position.copy(target).add(offset.setLength(distance));
        controls.current?.update();
        invalidate();
      },
    };
    viewControlsRef.current = actions;
    reset();
    return () => { if (viewControlsRef.current === actions) viewControlsRef.current = null; };
  }, [camera, invalidate, extent, aspect, viewControlsRef]);
  useFrame(({ camera }, delta) => {
    if (!followedId || !controls.current) return;
    previousTarget.copy(controls.current.target);
    controls.current.target.lerp(followPosition.current, Math.min(1, Math.max(delta, 1 / 30) * 4));
    camera.position.add(previousTarget.sub(controls.current.target).negate());
    controls.current.update();
  });
  return (
    <>
      <color attach="background" args={[palette.background]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight color={palette.paper} groundColor={palette.wood} intensity={0.9} />
      <directionalLight color={palette.paper} position={[-12, 24, 14]} intensity={2.1} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-extent} shadow-camera-right={extent} shadow-camera-top={extent} shadow-camera-bottom={-extent} shadow-camera-far={extent * 4} shadow-bias={-0.0003} shadow-normalBias={0.045} shadow-radius={3} />
      <directionalLight color={palette.wall} position={[8, 12, -8]} intensity={0.55} />
      <RestaurantFurniture plan={plan} palette={palette} />
      {plan.tables.map((table) => <DiningTable key={table.id} table={table} palette={palette} woodTexture={woodTexture} selected={selectedTableId === table.id} onSelect={onSelectTable} />)}
      {characters.filter((character) => character.state !== "left").slice(0, 24).map((character, index) => <Character
        key={character.id}
        character={character}
        index={index}
        plan={plan}
        palette={palette}
        paused={paused}
        onSelect={onSelectCharacter}
        followed={followedId === character.id}
        followPosition={followPosition}
      />)}
      <OrbitControls ref={controls} makeDefault regress enableDamping={false} minDistance={5} maxDistance={extent * 3.5} minPolarAngle={0.25} maxPolarAngle={Math.PI / 2.15} target={[0, 0, 0]} />
      <AdaptiveDpr />
      <RenderClock running={!paused || Boolean(followedId)} visible={visible} />
      <GraphicsLifecycle onContextChange={onContextChange} />
    </>
  );
}

export default function RestaurantScene(props: RestaurantSceneProps) {
  const palette = useScenePalette();
  const visible = usePageVisibility();
  const [followedId, setFollowedId] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const viewControlsRef = useRef<ViewControls | null>(null);
  const { t } = useTranslation("simulator");
  const requestedFollowId = props.selectedCharacterId === undefined ? followedId : props.selectedCharacterId;
  const activeFollowedId = props.characters.some((character) => character.id === requestedFollowId && character.state !== "left") ? requestedFollowId : null;
  const extent = Math.max(14, Math.ceil(Math.sqrt(Math.max(props.tables.length, 1))) * 3.5 + 6);
  if (!palette) return <Skeleton className="h-full min-h-80 rounded-xl" />;
  return (
    <div className="relative isolate h-full min-h-80 overflow-hidden bg-muted/40">
      <Canvas
        shadows="soft"
        frameloop={visible && !contextLost ? "demand" : "never"}
        dpr={[0.75, 1.5]}
        camera={{ position: [extent * 0.68, extent * 0.75, extent * 0.9], fov: 42, near: 0.1, far: Math.max(150, extent * 5) }}
        gl={{ antialias: true, alpha: false, powerPreference: "low-power" }}
        performance={{ min: 0.5 }}
        fallback={<div className="p-6 font-lao text-sm text-muted-foreground">{t("scene.unavailable", { defaultValue: "3D graphics are unavailable. Use the table panel to continue." })}</div>}
      >
        <SceneContents {...props} palette={palette} visible={visible && !contextLost} followedId={activeFollowedId} onSelectCharacter={(id) => { setFollowedId(id); props.onSelectCharacter?.(id); }} onContextChange={setContextLost} viewControlsRef={viewControlsRef} />
      </Canvas>
      {contextLost && <div role="alert" className="absolute inset-x-3 top-3 rounded-lg border bg-card p-3 font-lao text-sm text-foreground shadow-sm">
        {t("scene.recovering", { defaultValue: "3D graphics paused. Waiting for the browser to restore graphics; table operations remain available." })}
      </div>}
      <div className="pointer-events-none absolute bottom-4 left-4 max-w-[calc(100%-11rem)] rounded-md border border-border/60 bg-card/90 px-2.5 py-2 font-lao text-[10px] leading-relaxed text-muted-foreground">
        {t("scene.controls", { defaultValue: "Drag to rotate · Scroll to zoom · Select a table or person" })}
      </div>
      <div className="absolute bottom-4 right-4 flex gap-1 rounded-lg border bg-card/95 p-1 shadow-sm">
        <Button size="icon" variant="ghost" className="size-10" aria-label={t("scene.zoomOut", { defaultValue: "Zoom out" })} title={t("scene.zoomOut", { defaultValue: "Zoom out" })} onClick={() => viewControlsRef.current?.zoom(1.2)}><Minus className="size-4" /></Button>
        <Button size="icon" variant="ghost" className="size-10" aria-label={t("scene.zoomIn", { defaultValue: "Zoom in" })} title={t("scene.zoomIn", { defaultValue: "Zoom in" })} onClick={() => viewControlsRef.current?.zoom(1 / 1.2)}><Plus className="size-4" /></Button>
        <Button size="icon" variant="ghost" className="size-10" aria-label={t("scene.resetView", { defaultValue: "Reset view" })} title={t("scene.resetView", { defaultValue: "Reset view" })} onClick={() => { setFollowedId(null); props.onStopFollowing?.(); viewControlsRef.current?.reset(); }}><RotateCcw className="size-3.5" /></Button>
      </div>
      {activeFollowedId && <Button size="sm" variant="secondary" className="absolute right-3 top-3 font-lao" onClick={() => { setFollowedId(null); props.onStopFollowing?.(); }}>
        {t("scene.stopFollowing", { defaultValue: "Stop following" })}
      </Button>}
    </div>
  );
}
