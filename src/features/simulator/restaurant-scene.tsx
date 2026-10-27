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
import { Html } from "@react-three/drei/web/Html";
import { Color, Object3D, SRGBColorSpace, Vector3, type Group, type InstancedMesh } from "three";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export interface SceneTable {
  id: string;
  name: string;
  zone: string;
  status: string;
  guests: number;
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
  furniture: Color;
  trim: Color;
  primary: Color;
  paper: Color;
  success: Color;
  warning: Color;
  info: Color;
  pending: Color;
}

interface PlacedTable extends SceneTable {
  x: number;
  z: number;
}

interface FloorPlan {
  tables: PlacedTable[];
  width: number;
  depth: number;
}

type Position = [number, number, number];

function createFloorPlan(tables: SceneTable[]): FloorPlan {
  const columns = Math.max(2, Math.ceil(Math.sqrt(Math.max(tables.length, 1))));
  const rows = Math.max(2, Math.ceil(tables.length / columns));
  return {
    tables: tables.map((table, index) => ({
      ...table,
      x: (index % columns - (columns - 1) / 2) * 3.5,
      z: (Math.floor(index / columns) - (rows - 1) / 2) * 3.6,
    })),
    width: Math.max(14, columns * 3.5 + 5),
    depth: Math.max(14, rows * 3.6 + 7),
  };
}

function available(status: string) {
  return ["available", "free", "empty", "1"].includes(status.toLowerCase());
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
      const styles = getComputedStyle(document.documentElement);
      setPalette({
        background: resolve(styles, "--muted"),
        floor: resolve(styles, "--card"),
        furniture: resolve(styles, "--muted-foreground"),
        trim: resolve(styles, "--border"),
        primary: resolve(styles, "--primary"),
        paper: resolve(styles, "--primary-foreground"),
        success: resolve(styles, "--success"),
        warning: resolve(styles, "--warning"),
        info: resolve(styles, "--info"),
        pending: resolve(styles, "--pending"),
      });
    };
    const frame = requestAnimationFrame(update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme-color", "style"],
    });
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
}: {
  positions: Position[];
  size: Position;
  color: Color;
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
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, positions.length]} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </instancedMesh>
  );
}

function Box({
  position,
  size,
  color,
  rotation,
}: {
  position: Position;
  size: Position;
  color: Color;
  rotation?: Position;
}) {
  return (
    <mesh position={position} rotation={rotation} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.75} />
    </mesh>
  );
}

function RestaurantFurniture({ plan, palette }: { plan: FloorPlan; palette: Palette }) {
  const { t } = useTranslation("simulator");
  const chairSeats = useMemo<Position[]>(() => plan.tables.flatMap((table) => [
    [table.x - 1.03, 0.48, table.z], [table.x + 1.03, 0.48, table.z],
    [table.x, 0.48, table.z - 1.03], [table.x, 0.48, table.z + 1.03],
  ]), [plan]);
  const chairBases = useMemo<Position[]>(() => chairSeats.map(([x, , z]) => [x, 0.23, z]), [chairSeats]);
  const chairBacksX = useMemo<Position[]>(() => plan.tables.flatMap((table) => [
    [table.x - 1.28, 0.79, table.z], [table.x + 1.28, 0.79, table.z],
  ]), [plan]);
  const chairBacksZ = useMemo<Position[]>(() => plan.tables.flatMap((table) => [
    [table.x, 0.79, table.z - 1.28], [table.x, 0.79, table.z + 1.28],
  ]), [plan]);
  const tableBases = useMemo<Position[]>(() => plan.tables.map((table) => [table.x, 0.43, table.z]), [plan]);
  const zoneLabels = useMemo(() => [...new Map(plan.tables.filter((table) => table.zone).map((table) => [table.zone, table])).values()], [plan]);
  const counterZ = -plan.depth / 2 + 1.45;
  const cashierX = plan.width / 2 - 1.3;
  const entryZ = plan.depth / 2 - 0.2;
  return (
    <group>
      <Box position={[0, -0.19, 0]} size={[plan.width, 0.35, plan.depth]} color={palette.trim} />
      <Box position={[0, 0, 0]} size={[plan.width - 0.15, 0.05, plan.depth - 0.15]} color={palette.floor} />
      <Box position={[0, 0.035, counterZ]} size={[plan.width - 0.4, 0.05, 2.9]} color={palette.background} />
      <Box position={[0, 0.8, -plan.depth / 2]} size={[plan.width, 1.6, 0.15]} color={palette.trim} />
      <Box position={[-plan.width / 2, 0.45, -1]} size={[0.15, 0.9, plan.depth - 2]} color={palette.trim} />
      <Instances positions={chairSeats} size={[0.58, 0.12, 0.58]} color={palette.primary} />
      <Instances positions={chairBases} size={[0.14, 0.4, 0.14]} color={palette.furniture} />
      <Instances positions={chairBacksX} size={[0.1, 0.55, 0.58]} color={palette.primary} />
      <Instances positions={chairBacksZ} size={[0.58, 0.55, 0.1]} color={palette.primary} />
      <Instances positions={tableBases} size={[0.2, 0.85, 0.2]} color={palette.furniture} />
      {zoneLabels.map((table) => <Html key={table.zone} center position={[table.x, 0.1, table.z - 1.65]} distanceFactor={22}>
        <span className="pointer-events-none whitespace-nowrap rounded-md bg-muted/90 px-2 py-0.5 font-lao text-xs text-muted-foreground">{table.zone}</span>
      </Html>)}

      <Box position={[-2, 0.55, counterZ]} size={[5.1, 1.1, 1]} color={palette.furniture} />
      <Box position={[-2, 1.14, counterZ]} size={[5.25, 0.14, 1.13]} color={palette.paper} />
      {[-3.5, -2.5, -1.5].map((x) => (
        <group key={x} position={[x, 1.24, counterZ]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.23, 0.055, 6, 12]} />
            <meshStandardMaterial color={palette.furniture} />
          </mesh>
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.2, 0.17, 0.14, 8]} />
            <meshStandardMaterial color={palette.trim} metalness={0.5} />
          </mesh>
        </group>
      ))}
      <Box position={[1.7, 0.8, counterZ - 0.55]} size={[0.9, 1.6, 0.75]} color={palette.paper} />
      <Box position={[1.7, 0.8, counterZ - 0.13]} size={[0.05, 0.7, 0.04]} color={palette.furniture} />
      <Box position={[cashierX, 0.5, 1]} size={[1.45, 1, 2.8]} color={palette.primary} />
      <Box position={[cashierX, 1.04, 1]} size={[1.6, 0.1, 2.95]} color={palette.paper} />
      <Box position={[cashierX, 1.3, 0.6]} size={[0.6, 0.42, 0.08]} color={palette.furniture} rotation={[-0.2, -Math.PI / 2, 0]} />
      <Box position={[cashierX, 1.12, 1.85]} size={[0.4, 0.2, 0.4]} color={palette.furniture} />
      <Box position={[cashierX, 1.25, 1.9]} size={[0.23, 0.07, 0.23]} color={palette.paper} />
      <Box position={[-4.4, 1.28, counterZ]} size={[0.45, 0.25, 0.4]} color={palette.furniture} />
      <Box position={[-4.4, 1.43, counterZ + 0.1]} size={[0.28, 0.07, 0.27]} color={palette.paper} />
      <Box position={[-1.25, 1, entryZ]} size={[0.14, 2, 0.14]} color={palette.primary} />
      <Box position={[1.25, 1, entryZ]} size={[0.14, 2, 0.14]} color={palette.primary} />
      <Box position={[0, 2.05, entryZ]} size={[2.64, 0.18, 0.2]} color={palette.primary} />
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (plan.width / 2 - 0.7), 0, entryZ - 1]}>
          <mesh position={[0, 0.24, 0]}>
            <cylinderGeometry args={[0.31, 0.22, 0.48, 8]} />
            <meshStandardMaterial color={palette.furniture} />
          </mesh>
          <mesh position={[0, 0.84, 0]}>
            <icosahedronGeometry args={[0.52, 0]} />
            <meshStandardMaterial color={palette.primary} flatShading />
          </mesh>
        </group>
      ))}
      <Html center position={[-1.7, 2.25, counterZ]} distanceFactor={23}>
        <span className="pointer-events-none whitespace-nowrap rounded-md border bg-card/95 px-3 py-1 font-lao text-xs font-semibold text-foreground shadow-sm">
          {t("scene.kitchen", { defaultValue: "Kitchen" })}
        </span>
      </Html>
      <Html center position={[cashierX, 2, 1]} distanceFactor={23}>
        <span className="pointer-events-none whitespace-nowrap rounded-md border bg-card/95 px-3 py-1 font-lao text-xs font-semibold text-foreground shadow-sm">
          {t("scene.cashier", { defaultValue: "Cashier" })}
        </span>
      </Html>
      <Html center position={[0, 2.4, entryZ]} distanceFactor={23}>
        <span className="pointer-events-none whitespace-nowrap rounded-md border border-primary/30 bg-primary px-3 py-1 font-lao text-xs font-semibold text-primary-foreground shadow-sm">
          {t("scene.entrance", { defaultValue: "Entrance" })}
        </span>
      </Html>
    </group>
  );
}

function DiningTable({ table, palette, selected, onSelect }: {
  table: PlacedTable;
  palette: Palette;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const free = available(table.status);
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(table.id);
  };
  return (
    <group position={[table.x, 0, table.z]}>
      <mesh position={[0, 0.92, 0]} onClick={handleClick}>
        <cylinderGeometry args={[0.77, 0.77, 0.12, 16]} />
        <meshStandardMaterial color={selected ? palette.primary : palette.paper} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.28, selected ? 1.36 : 1.31, 32]} />
        <meshBasicMaterial color={selected ? palette.primary : free ? palette.success : palette.warning} transparent opacity={selected ? 0.9 : 0.35} />
      </mesh>
      {!free && [0, 1].map((index) => (
        <group key={index} position={[index ? 0.32 : -0.32, 1.005, 0]}>
          <mesh>
            <cylinderGeometry args={[0.2, 0.18, 0.035, 12]} />
            <meshStandardMaterial color={palette.floor} />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <sphereGeometry args={[0.105, 6, 4]} />
            <meshStandardMaterial color={palette.warning} />
          </mesh>
        </group>
      ))}
      <Html center position={[0, 1.55, 0]} distanceFactor={20}>
        <button
          type="button"
          className={`min-h-9 min-w-12 rounded-lg border px-2.5 py-1 font-lao text-xs shadow-sm focus-visible:outline-2 focus-visible:outline-ring ${selected ? "border-primary bg-primary font-semibold text-primary-foreground" : "bg-card/95 text-foreground"}`}
          aria-label={`${table.name} · ${table.zone} · ${table.status} · ${table.guests}`}
          aria-pressed={selected}
          onClick={() => onSelect(table.id)}
        >
          {table.name}
          {table.guests > 0 && <span className="ml-1.5 opacity-70">· {table.guests}</span>}
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
    const seat = index % 4;
    if (character.role === "waiter") return [table.x + 1.5, 0, table.z + 0.9];
    return [table.x + (seat === 0 ? -1.03 : seat === 1 ? 1.03 : 0), 0.24,
      table.z + (seat === 2 ? -1.03 : seat === 3 ? 1.03 : 0)];
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
  const [initialPosition] = useState<Position>(() => character.role === "customer"
    ? [0, 0, plan.depth / 2 - 0.7]
    : characterDestination(character, index, plan));
  const color = character.role === "chef" ? palette.paper
    : character.role === "waiter" ? palette.primary
      : character.role === "cashier" ? palette.pending
        : index % 2 ? palette.info : palette.warning;
  useFrame((state, delta) => {
    if (!group.current) return;
    const person = group.current;
    if (!paused) {
      const remaining = person.position.distanceTo(destination);
      if (remaining > 0.035) {
        person.rotation.y = Math.atan2(destination.x - person.position.x, destination.z - person.position.z);
        person.position.lerp(destination, Math.min(delta * 2.2, 1));
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
        <meshStandardMaterial color={palette.paper.clone().lerp(palette.warning, 0.2)} flatShading />
      </mesh>
      <group ref={arms} position={[0, 1.03, 0]}>
        <Box position={[-0.26, -0.15, 0]} size={[0.12, 0.43, 0.13]} color={color} />
        <Box position={[0.26, -0.15, 0]} size={[0.12, 0.43, 0.13]} color={color} />
      </group>
      <group ref={legs} rotation={seated ? [0.5, 0, 0] : [0, 0, 0]}>
        <Box position={[-0.1, 0.35, 0]} size={[0.12, 0.55, 0.13]} color={palette.furniture} />
        <Box position={[0.1, 0.35, 0]} size={[0.12, 0.55, 0.13]} color={palette.furniture} />
      </group>
      {character.role === "chef" && <mesh position={[0, 1.55, 0]}>
        <cylinderGeometry args={[0.23, 0.18, 0.2, 8]} />
        <meshStandardMaterial color={palette.paper} />
      </mesh>}
      {character.role === "waiter" && <mesh position={[0.35, 0.98, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.04, 10]} />
        <meshStandardMaterial color={palette.furniture} />
      </mesh>}
      {followed && <Html center position={[0, 1.85, 0]} distanceFactor={18}>
        <span className="pointer-events-none whitespace-nowrap rounded-md border border-primary/40 bg-card px-2 py-1 font-lao text-xs text-foreground shadow-sm">{character.state}</span>
      </Html>}
    </group>
  );
}

function SceneContents({ tables, selectedTableId, onSelectTable, paused, characters, palette, visible, followedId, onSelectCharacter, onContextChange }: RestaurantSceneProps & {
  palette: Palette;
  visible: boolean;
  followedId: string | null;
  onSelectCharacter: (id: string) => void;
  onContextChange: (lost: boolean) => void;
}) {
  const plan = useMemo(() => createFloorPlan(tables), [tables]);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const followPosition = useRef(new Vector3());
  const previousTarget = useMemo(() => new Vector3(), []);
  const extent = Math.max(plan.width, plan.depth);
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
      <ambientLight intensity={1.9} />
      <directionalLight position={[5, 10, 8]} intensity={2.2} />
      <directionalLight position={[-5, 6, -4]} intensity={0.6} />
      <RestaurantFurniture plan={plan} palette={palette} />
      {plan.tables.map((table) => <DiningTable key={table.id} table={table} palette={palette} selected={selectedTableId === table.id} onSelect={onSelectTable} />)}
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
      <OrbitControls ref={controls} makeDefault regress enableDamping={false} minDistance={5} maxDistance={extent * 2.5} minPolarAngle={0.25} maxPolarAngle={Math.PI / 2.15} target={[0, 0, 0]} />
      <AdaptiveDpr pixelated />
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
  const { t } = useTranslation("simulator");
  const requestedFollowId = props.selectedCharacterId === undefined ? followedId : props.selectedCharacterId;
  const activeFollowedId = props.characters.some((character) => character.id === requestedFollowId && character.state !== "left") ? requestedFollowId : null;
  const extent = Math.max(14, Math.ceil(Math.sqrt(Math.max(props.tables.length, 1))) * 3.5 + 6);
  if (!palette) return <Skeleton className="h-full min-h-80 rounded-xl" />;
  return (
    <div className="relative isolate h-full min-h-80 overflow-hidden rounded-xl border bg-muted">
      <Canvas
        frameloop={visible && !contextLost ? "demand" : "never"}
        dpr={[0.75, 1.5]}
        camera={{ position: [extent * 0.68, extent * 0.75, extent * 0.9], fov: 42, near: 0.1, far: Math.max(150, extent * 5) }}
        gl={{ antialias: false, alpha: false, powerPreference: "low-power" }}
        performance={{ min: 0.5 }}
        fallback={<div className="p-6 font-lao text-sm text-muted-foreground">{t("scene.unavailable", { defaultValue: "3D graphics are unavailable. Use the table panel to continue." })}</div>}
      >
        <SceneContents {...props} palette={palette} visible={visible && !contextLost} followedId={activeFollowedId} onSelectCharacter={(id) => { setFollowedId(id); props.onSelectCharacter?.(id); }} onContextChange={setContextLost} />
      </Canvas>
      {contextLost && <div role="alert" className="absolute inset-x-3 top-3 rounded-lg border bg-card p-3 font-lao text-sm text-foreground shadow-sm">
        {t("scene.recovering", { defaultValue: "3D graphics paused. Waiting for the browser to restore graphics; table operations remain available." })}
      </div>}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border bg-card/95 px-3 py-2 font-lao text-xs text-muted-foreground shadow-sm">
        {t("scene.controls", { defaultValue: "Drag to rotate · Scroll to zoom · Select a table or person" })}
      </div>
      {activeFollowedId && <Button size="sm" variant="secondary" className="absolute right-3 top-3 font-lao" onClick={() => { setFollowedId(null); props.onStopFollowing?.(); }}>
        {t("scene.stopFollowing", { defaultValue: "Stop following" })}
      </Button>}
    </div>
  );
}
