// โมเดลร้านอาหารจำลอง (diorama) สำหรับหน้า landing — สร้างจาก geometry ของ three ล้วน
// ไม่มีไฟล์โมเดล/รูปภายนอก (หน้าจอ POS, เมนูบนมือถือ, QR, ป้ายร้าน, กระดานเมนู วาดด้วย canvas 2D)
//
// หลักการเรื่องประสิทธิภาพ (ต้นเหตุที่เวอร์ชันแรกกระตุก):
// 1. ของที่ไม่ขยับทั้งหมด (พื้น ผนัง โต๊ะ เก้าอี้ ลูกค้า โคมไฟ ต้นไม้) ถูก "รวม geometry ตามวัสดุ" หลังสร้างเสร็จ
//    — จาก ~300 mesh เหลือไม่กี่สิบ draw call และ shadow map เรนเดอร์ครั้งเดียว ไม่ใช่ทุกเฟรม
// 2. ของซ้ำที่ขยับ (วงสถานะโต๊ะ, หมุดลอย, แท่งกราฟ) ใช้ InstancedMesh = 1 draw call ต่อชนิด
// 3. แสงเรือง (หลอดไฟ/โคม) เป็น sprite แบบ additive แทน bloom post-processing ที่กินหลาย pass เต็มจอ
// 4. raycast ชนกล่องล่องหนหนึ่งกล่องต่อ hotspot แทนการชนทุกสามเหลี่ยมในร้าน

import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Line,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  RepeatWrapping,
  RingGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  type Material,
  type Side,
  type Texture
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { LandingTourFeatureStop } from "@/features/landing/landing-tour";

export type TableStatus = "free" | "ordered" | "alert";

/** วัตถุที่ชี้/คลิกได้ — hotspot = จุดทัวร์ที่วัตถุนั้นเป็นตัวแทน */
export interface RestaurantHotspot {
  stop: LandingTourFeatureStop;
  /** จุดยึดของป้ายชื่อ (world space) */
  anchor: Vector3;
  /** กล่องล่องหนที่ใช้ raycast — ไม่ถูกวาด */
  proxy: Mesh;
  /** จุดกลางบนพื้น + รัศมี ของวงแหวนไฮไลต์ตอนเมาส์ชี้ */
  center: Vector3;
  radius: number;
  /** ดัชนีโต๊ะ (เฉพาะโต๊ะ) — คลิกโต๊ะ = เปลี่ยนสถานะ ไม่ใช่เลื่อนทัวร์ */
  tableIndex?: number;
}

export interface RestaurantFrame {
  deltaSeconds: number;
  time: number;
  /** น้ำหนักความสำคัญของแต่ละจุดทัวร์ 0..1 (1 = กล้องอยู่ที่จุดนั้นพอดี) */
  weights: Record<LandingTourFeatureStop, number>;
  hovered: RestaurantHotspot | null;
}

export interface Restaurant {
  root: Group;
  hotspots: RestaurantHotspot[];
  cycleTable: (index: number) => TableStatus;
  animate: (frame: RestaurantFrame) => void;
}

interface RestaurantOptions {
  /** Lambert แทน PBR สำหรับเครื่องอ่อน */
  lite: boolean;
  shadows: boolean;
  glowTexture: Texture;
}

// ---------- palette (ร้านอาหารลาวยามค่ำ โทนเขียว emerald ตามธีมหลักของแอป) ----------
const PALETTE = {
  deckRim: 0x4a2e20,
  earth: 0x2a1a16,
  wall: 0x173b31,
  wainscot: 0x6b4028,
  trim: 0xefe2cc,
  cream: 0xf2e6d3,
  wood: 0x9a6038,
  woodLight: 0xc98b52,
  woodDark: 0x3f2718,
  steel: 0xa5aeb6,
  steelDark: 0x5d656d,
  charcoal: 0x232228,
  terracotta: 0xb5562f,
  leaf: 0x2f8a57,
  leafLight: 0x49a86b,
  brass: 0xc99a4a,
  plate: 0xfaf6ef,
  jade: 0x34d399,
  /** emerald-700 = --primary ของแอป */
  jadeDeep: 0x047857,
  mint: 0x6ee7b7,
  saffron: 0xf5a524,
  chili: 0xef4444,
  bulb: 0xffcf85,
  skinA: 0xe7b58c,
  skinB: 0xc68b62,
  skinC: 0x9a6444,
  hairA: 0x231a17,
  hairB: 0x4a2f22
} as const;

export const TABLE_STATUS_COLORS: Record<TableStatus, number> = {
  free: PALETTE.jade,
  ordered: PALETTE.saffron,
  alert: PALETTE.chili
};

const NEXT_TABLE_STATUS: Record<TableStatus, TableStatus> = {
  free: "ordered",
  ordered: "alert",
  alert: "free"
};

/** random ที่ seed ได้ — ร้านต้องหน้าตาเหมือนเดิมทุกครั้งที่โหลด ไม่ใช่สุ่มใหม่ทุกรอบ */
function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================
// canvas textures
// ============================================================

type Draw = (context: CanvasRenderingContext2D, width: number, height: number) => void;

function canvasTexture(width: number, height: number, draw: Draw): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context) draw(context, width, height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawDeck(context: CanvasRenderingContext2D, width: number, height: number) {
  const random = seededRandom(3);
  const rows = 18;
  const plank = height / rows;
  for (let row = 0; row < rows; row++) {
    const shade = 0.86 + random() * 0.2;
    context.fillStyle = `rgb(${Math.round(150 * shade)}, ${Math.round(98 * shade)}, ${Math.round(66 * shade)})`;
    context.fillRect(0, row * plank, width, plank);
    // ลายไม้บาง ๆ
    context.strokeStyle = "rgba(60, 32, 18, 0.18)";
    context.lineWidth = 1;
    for (let grain = 0; grain < 3; grain++) {
      const y = row * plank + plank * (0.25 + grain * 0.25) + (random() - 0.5) * 3;
      context.beginPath();
      context.moveTo(0, y);
      context.bezierCurveTo(width * 0.3, y + 2, width * 0.6, y - 2, width, y + 1);
      context.stroke();
    }
    context.fillStyle = "rgba(38, 20, 12, 0.55)";
    context.fillRect(0, row * plank + plank - 2, width, 2);
    context.fillRect(Math.floor(random() * width), row * plank, 2, plank);
  }
}

function drawTiles(context: CanvasRenderingContext2D, width: number, height: number) {
  const cells = 8;
  const size = width / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      context.fillStyle = (x + y) % 2 ? "#e9dcc6" : "#b9603a";
      context.fillRect(x * size, y * size, size, size);
    }
  }
  context.strokeStyle = "rgba(40, 24, 16, 0.35)";
  context.lineWidth = 2;
  for (let i = 0; i <= cells; i++) {
    context.beginPath();
    context.moveTo(i * size, 0);
    context.lineTo(i * size, height);
    context.moveTo(0, i * size);
    context.lineTo(width, i * size);
    context.stroke();
  }
}

// หน้าจอ POS: แถบหัว, กริดสินค้า, คอลัมน์ตะกร้า + ปุ่มชำระ — สื่อว่าเป็นหน้าขายจริงของแอป
function drawPosScreen(context: CanvasRenderingContext2D, width: number, height: number, mark?: CanvasImageSource) {
  context.fillStyle = "#15131a";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#047857";
  context.fillRect(0, 0, width, 38);
  let titleX = 16;
  if (mark) {
    // ไทล์ขาวแบบไอคอนแอป — มาร์คสีเขียวบนแถบเขียวจะกลืนกันจนมองไม่เห็น
    context.fillStyle = "#ffffff";
    roundRect(context, 8, 5, 28, 28, 7);
    context.fill();
    context.drawImage(mark, 10, 7, 24, 24);
    titleX = 44;
  }
  context.fillStyle = "#f2e6d3";
  context.font = "bold 22px sans-serif";
  context.fillText("Yummy-go POS", titleX, 27);

  const tileColors = ["#f5a524", "#ef6b4a", "#34d399", "#e8c07a", "#c2683f", "#7cc4a4", "#f08c5a", "#d9a441"];
  const gridWidth = width * 0.62;
  const columns = 4;
  const gap = 10;
  const tile = (gridWidth - gap * (columns + 1)) / columns;
  for (let index = 0; index < 12; index++) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = gap + column * (tile + gap);
    const y = 50 + row * (tile * 0.78 + gap);
    context.fillStyle = "#24212b";
    roundRect(context, x, y, tile, tile * 0.78, 8);
    context.fill();
    context.fillStyle = tileColors[index % tileColors.length];
    context.beginPath();
    context.arc(x + tile / 2, y + tile * 0.32, tile * 0.2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#8d8494";
    context.fillRect(x + 10, y + tile * 0.6, tile - 20, 5);
  }

  const cartX = gridWidth + 6;
  context.fillStyle = "#1d1a23";
  context.fillRect(cartX, 44, width - cartX - 8, height - 52);
  for (let line = 0; line < 5; line++) {
    context.fillStyle = "#3a3542";
    context.fillRect(cartX + 12, 62 + line * 30, (width - cartX) * 0.5, 7);
    context.fillStyle = "#f2e6d3";
    context.fillRect(width - 58, 62 + line * 30, 34, 7);
  }
  context.fillStyle = "#047857";
  roundRect(context, cartX + 12, height - 58, width - cartX - 32, 40, 8);
  context.fill();
  context.fillStyle = "#f2e6d3";
  context.font = "bold 18px sans-serif";
  context.fillText("₭ 245,000", cartX + 26, height - 32);
}

function drawPhoneMenu(context: CanvasRenderingContext2D, width: number, height: number) {
  context.fillStyle = "#fbf5ec";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#047857";
  context.fillRect(0, 0, width, 58);
  context.fillStyle = "#fbf5ec";
  context.font = "bold 24px sans-serif";
  context.fillText("T04 · Menu", 18, 38);
  const dishes = ["#f5a524", "#ef6b4a", "#7cc4a4", "#c2683f", "#e8c07a"];
  dishes.forEach((color, index) => {
    const y = 78 + index * 74;
    context.fillStyle = color;
    roundRect(context, 16, y, 56, 56, 14);
    context.fill();
    context.fillStyle = "#3b2618";
    context.fillRect(84, y + 12, width * 0.42, 10);
    context.fillStyle = "#a08f7c";
    context.fillRect(84, y + 34, width * 0.26, 8);
    context.fillStyle = "#047857";
    context.beginPath();
    context.arc(width - 32, y + 28, 15, 0, Math.PI * 2);
    context.fill();
  });
  context.fillStyle = "#047857";
  roundRect(context, 16, height - 70, width - 32, 52, 16);
  context.fill();
  context.fillStyle = "#fbf5ec";
  context.font = "bold 22px sans-serif";
  context.fillText("Order · 3", width / 2 - 46, height - 36);
}

function drawQr(context: CanvasRenderingContext2D, width: number) {
  context.fillStyle = "#fbf5ec";
  context.fillRect(0, 0, width, width);
  const random = seededRandom(7);
  const cells = 21;
  const cell = (width - 24) / cells;
  context.fillStyle = "#1b1a1f";
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      if (!finder && random() > 0.52) context.fillRect(12 + x * cell, 12 + y * cell, cell, cell);
    }
  }
  const finders: Array<[number, number]> = [[0, 0], [14, 0], [0, 14]];
  for (const [fx, fy] of finders) {
    context.fillStyle = "#1b1a1f";
    context.fillRect(12 + fx * cell, 12 + fy * cell, cell * 7, cell * 7);
    context.fillStyle = "#fbf5ec";
    context.fillRect(12 + (fx + 1) * cell, 12 + (fy + 1) * cell, cell * 5, cell * 5);
    context.fillStyle = "#1b1a1f";
    context.fillRect(12 + (fx + 2) * cell, 12 + (fy + 2) * cell, cell * 3, cell * 3);
  }
}

function drawTicket(context: CanvasRenderingContext2D, width: number) {
  context.fillStyle = "#fbf7f0";
  context.fillRect(0, 0, width, width);
  context.fillStyle = "#3b2618";
  context.font = "bold 18px monospace";
  context.fillText("#T04", 10, 24);
  for (let line = 0; line < 6; line++) {
    context.fillStyle = line === 0 ? "#b5562f" : "#8d7f70";
    context.fillRect(10, 40 + line * 14, (line % 3 === 2 ? 0.45 : 0.72) * width, 5);
  }
}

const BRAND_MARK_URL = "/brand/icon-mark.png";

/**
 * โหลดมาร์คของแอป แล้วแปลงพื้นขาวเป็นโปร่งใส (color-to-alpha) — ไฟล์ต้นฉบับเป็น RGB ไม่มี alpha
 * ถ้าวางตรง ๆ บนป้ายนีออนจะเห็นเป็นสี่เหลี่ยมขาว ขอบลายเส้นที่ผสมขาวถูกคืนสีเดิมด้วยการหารกลับ
 */
function loadBrandMark(size: number): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        resolve(null);
        return;
      }
      context.drawImage(image, 0, 0, size, size);
      const pixels = context.getImageData(0, 0, size, size);
      const data = pixels.data;
      for (let index = 0; index < data.length; index += 4) {
        const alpha = 1 - Math.min(data[index], data[index + 1], data[index + 2]) / 255;
        if (alpha <= 0.01) {
          data[index + 3] = 0;
          continue;
        }
        for (let channel = 0; channel < 3; channel++) {
          data[index + channel] = Math.round((data[index + channel] - 255 * (1 - alpha)) / alpha);
        }
        data[index + 3] = Math.round(alpha * 255);
      }
      context.putImageData(pixels, 0, 0);
      resolve(canvas);
    };
    image.onerror = () => resolve(null);
    image.src = BRAND_MARK_URL;
  });
}

function drawSign(context: CanvasRenderingContext2D, width: number, height: number, mark?: CanvasImageSource) {
  context.clearRect(0, 0, width, height);
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.font = "bold 104px sans-serif";
  const label = "Yummy-go";
  const markSize = mark ? height * 0.8 : 0;
  const gap = mark ? 30 : 0;
  const startX = (width - (markSize + gap + context.measureText(label).width)) / 2;
  if (mark) {
    const markY = (height - markSize) / 2;
    context.shadowColor = "#10b981";
    context.shadowBlur = 34;
    context.drawImage(mark, startX, markY, markSize, markSize);
    context.shadowBlur = 0;
    context.drawImage(mark, startX, markY, markSize, markSize);
  }
  const textX = startX + markSize + gap;
  // วาดซ้ำหลายชั้นให้ได้ขอบเรืองแบบนีออน โดยไม่ต้องพึ่ง bloom
  context.shadowColor = "#10b981";
  context.shadowBlur = 42;
  context.fillStyle = "#34d399";
  context.fillText(label, textX, height / 2);
  context.shadowBlur = 14;
  context.fillStyle = "#d1fae5";
  context.fillText(label, textX, height / 2);
}

function drawMenuBoard(context: CanvasRenderingContext2D, width: number, height: number) {
  context.fillStyle = "#1d3a2f";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "rgba(255,255,255,0.04)";
  for (let i = 0; i < 40; i++) context.fillRect((i * 97) % width, (i * 53) % height, 60, 2);
  context.fillStyle = "#f6ecd9";
  context.font = "bold 46px sans-serif";
  context.textAlign = "center";
  context.fillText("MENU", width / 2, 64);
  context.fillStyle = "#f5a524";
  context.fillRect(width / 2 - 70, 80, 140, 3);
  const items: Array<[string, string]> = [
    ["Laap Gai", "35K"],
    ["Khao Piak Sen", "30K"],
    ["Tam Mak Hoong", "25K"],
    ["Ping Kai", "45K"],
    ["Lao Coffee", "15K"]
  ];
  context.font = "28px sans-serif";
  items.forEach(([name, price], index) => {
    const y = 132 + index * 44;
    context.textAlign = "left";
    context.fillStyle = "#f6ecd9";
    context.fillText(name, 36, y);
    context.textAlign = "right";
    context.fillStyle = "#9fe3c4";
    context.fillText(price, width - 36, y);
  });
}

function drawWindow(context: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#3a2440");
  gradient.addColorStop(0.55, "#a8552e");
  gradient.addColorStop(1, "#f0a14a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.fillStyle = "rgba(255, 220, 160, 0.9)";
  for (let i = 0; i < 6; i++) {
    context.beginPath();
    context.arc(20 + i * 22, height * 0.72 - (i % 2) * 8, 3, 0, Math.PI * 2);
    context.fill();
  }
}

function drawRadial(context: CanvasRenderingContext2D, width: number) {
  const gradient = context.createRadialGradient(width / 2, width / 2, 0, width / 2, width / 2, width / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.45)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, width);
}

function drawChartGrid(context: CanvasRenderingContext2D, width: number, height: number) {
  context.clearRect(0, 0, width, height);
  context.strokeStyle = "rgba(52, 211, 153, 0.28)";
  context.lineWidth = 2;
  for (let row = 1; row < 5; row++) {
    const y = (row / 5) * height;
    context.beginPath();
    context.moveTo(24, y);
    context.lineTo(width - 24, y);
    context.stroke();
  }
  context.fillStyle = "rgba(159, 227, 196, 0.9)";
  context.font = "bold 30px sans-serif";
  context.fillText("Today · ₭", 28, 44);
}

// ============================================================
// builder
// ============================================================

type LitMaterial = MeshStandardMaterial | MeshLambertMaterial;

interface LitOptions {
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
  map?: Texture;
}

interface FlatOptions {
  opacity?: number;
  additive?: boolean;
  map?: Texture;
  side?: Side;
  /** false = สีตามที่วาดเป๊ะ ไม่ผ่าน tone mapping (จอ/ป้าย) */
  toneMapped?: boolean;
}

interface Placement {
  rotation?: [number, number, number];
  scale?: [number, number, number];
  /** ไม่สร้างเงา (พื้นเรียบ/ของที่แนบพื้น) */
  noCast?: boolean;
}

export function buildRestaurant({ lite, shadows, glowTexture }: RestaurantOptions): Restaurant {
  const root = new Group();
  const hotspots: RestaurantHotspot[] = [];

  // ---------- caches: วัสดุ/geometry เดียวกันต้องเป็น instance เดียวกัน ถึงจะรวมเป็น draw call เดียวได้ ----------
  const litCache = new Map<string, LitMaterial>();
  const lit = (color: number, options: LitOptions = {}): LitMaterial => {
    const key = [color, options.roughness, options.metalness, options.emissive, options.emissiveIntensity, options.map?.uuid].join(":");
    const cached = litCache.get(key);
    if (cached) return cached;
    const material = lite
      ? new MeshLambertMaterial({
          color,
          map: options.map ?? null,
          emissive: options.emissive ?? 0x000000,
          emissiveIntensity: options.emissiveIntensity ?? 1
        })
      : new MeshStandardMaterial({
          color,
          map: options.map ?? null,
          roughness: options.roughness ?? 0.72,
          metalness: options.metalness ?? 0,
          emissive: options.emissive ?? 0x000000,
          emissiveIntensity: options.emissiveIntensity ?? 1
        });
    litCache.set(key, material);
    return material;
  };

  const flatCache = new Map<string, MeshBasicMaterial>();
  const flat = (color: number, options: FlatOptions = {}): MeshBasicMaterial => {
    const key = [color, options.opacity, options.additive, options.map?.uuid, options.side, options.toneMapped].join(":");
    const cached = flatCache.get(key);
    if (cached) return cached;
    const translucent = Boolean(options.additive) || (options.opacity ?? 1) < 1;
    const material = new MeshBasicMaterial({
      color,
      map: options.map ?? null,
      transparent: translucent,
      opacity: options.opacity ?? 1,
      depthWrite: !translucent,
      side: options.side,
      toneMapped: options.toneMapped ?? true
    });
    if (options.additive) material.blending = AdditiveBlending;
    flatCache.set(key, material);
    return material;
  };

  const geometryCache = new Map<string, BufferGeometry>();
  const geo = (key: string, create: () => BufferGeometry) => {
    const cached = geometryCache.get(key);
    if (cached) return cached;
    const geometry = create();
    geometryCache.set(key, geometry);
    return geometry;
  };
  const rbox = (w: number, h: number, d: number, radius = 0.05, segments = 2) =>
    geo(`rb:${w}:${h}:${d}:${radius}:${segments}`, () => new RoundedBoxGeometry(w, h, d, segments, Math.min(radius, w / 2, h / 2, d / 2)));
  const cyl = (top: number, bottom: number, height: number, segments = 24) =>
    geo(`cy:${top}:${bottom}:${height}:${segments}`, () => new CylinderGeometry(top, bottom, height, segments));
  const sphere = (radius: number, widthSegments = 18, heightSegments = 12) =>
    geo(`sp:${radius}:${widthSegments}:${heightSegments}`, () => new SphereGeometry(radius, widthSegments, heightSegments));
  const capsule = (radius: number, length: number) => geo(`ca:${radius}:${length}`, () => new CapsuleGeometry(radius, length, 6, 14));
  const torus = (radius: number, tube: number, radial = 10, tubular = 40) =>
    geo(`to:${radius}:${tube}:${radial}:${tubular}`, () => new TorusGeometry(radius, tube, radial, tubular));

  /** เพิ่ม mesh ที่ไม่ขยับ — จะถูกรวม geometry ตามวัสดุตอนจบ */
  const put = (parent: Object3D, geometry: BufferGeometry, material: Material, x: number, y: number, z: number, placement: Placement = {}) => {
    const item = new Mesh(geometry, material);
    item.position.set(x, y, z);
    if (placement.rotation) item.rotation.set(...placement.rotation);
    if (placement.scale) item.scale.set(...placement.scale);
    item.userData.static = true;
    item.userData.noCast = Boolean(placement.noCast);
    parent.add(item);
    return item;
  };

  /** mesh ที่ขยับ — ไม่รวม และไม่สร้างเงา (shadow map เรนเดอร์ครั้งเดียว เงาของของที่ขยับจะค้างผิดที่) */
  const live = (parent: Object3D, geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0) => {
    const item = new Mesh(geometry, material);
    item.position.set(x, y, z);
    parent.add(item);
    return item;
  };

  const texture = (width: number, height: number, draw: Draw) => canvasTexture(width, height, draw);

  // จุดเรืองแสงคงที่ (หลอดไฟ/โคม) — เก็บตำแหน่งไว้สร้างเป็น Points ก้อนเดียวตอนจบ
  const glowSmall: number[] = [];
  const glowLarge: number[] = [];
  const glowSign: number[] = [];

  const radialTexture = texture(128, 128, (context, width) => drawRadial(context, width));

  // ============================================================
  // platform (เกาะลอย: พื้นไม้ + ขอบ + ฐานดินเรียวลง)
  // ============================================================
  const deckTexture = texture(512, 512, drawDeck);
  deckTexture.wrapS = deckTexture.wrapT = RepeatWrapping;
  deckTexture.repeat.set(2.2, 2.2);
  put(root, cyl(9.6, 9.6, 0.36, 96), lit(0xffffff, { map: deckTexture, roughness: 0.82 }), 0, -0.18, 0, { noCast: true });
  put(root, cyl(9.9, 9.75, 0.5, 96), lit(PALETTE.deckRim, { roughness: 0.9 }), 0, -0.42, 0, { noCast: true });
  put(root, cyl(9.75, 6.4, 2.2, 64), lit(PALETTE.earth, { roughness: 1 }), 0, -1.77, 0, { noCast: true });
  put(root, torus(9.82, 0.05, 6, 160), flat(PALETTE.jade, { opacity: 0.6, additive: true }), 0, -0.04, 0, {
    rotation: [Math.PI / 2, 0, 0],
    noCast: true
  });

  const tileTexture = texture(256, 256, drawTiles);
  tileTexture.wrapS = tileTexture.wrapT = RepeatWrapping;
  tileTexture.repeat.set(2.4, 1.6);
  const tileMaterial = lit(0xffffff, { map: tileTexture, roughness: 0.55 });
  // พื้นกระเบื้องแปะบนพื้นไม้ — ดันความลึกนิดเดียวกัน z-fighting แทนการยกสูงจนเห็นขอบลอย
  tileMaterial.polygonOffset = true;
  tileMaterial.polygonOffsetFactor = -2;
  put(root, geo("tilePlane", () => new PlaneGeometry(6.2, 3.8)), tileMaterial, 4.2, 0.004, -3.95, {
    rotation: [-Math.PI / 2, 0, 0],
    noCast: true
  });

  // ============================================================
  // walls, windows, sign, menu board, shelf
  // ============================================================
  const wall = lit(PALETTE.wall, { roughness: 0.9 });
  const wainscot = lit(PALETTE.wainscot, { roughness: 0.8 });
  const trim = lit(PALETTE.trim, { roughness: 0.6 });
  put(root, rbox(15.4, 3.2, 0.4, 0.08), wall, 0, 1.6, -6.35);
  put(root, rbox(15.5, 1.05, 0.48, 0.05), wainscot, 0, 0.53, -6.3);
  put(root, rbox(15.6, 0.14, 0.56, 0.04), trim, 0, 3.24, -6.33);
  put(root, rbox(0.4, 2.8, 6.2, 0.08), wall, -7.55, 1.4, -3.4);
  put(root, rbox(0.48, 1.05, 6.3, 0.05), wainscot, -7.5, 0.53, -3.4);
  put(root, rbox(0.56, 0.14, 6.4, 0.04), trim, -7.53, 2.84, -3.4);

  const windowTexture = texture(128, 128, drawWindow);
  const windowGlass = flat(0xffffff, { map: windowTexture, toneMapped: false });
  for (const x of [-1.6, 1.9]) {
    put(root, rbox(1.5, 1.2, 0.12, 0.04), trim, x, 1.95, -6.12);
    put(root, geo("windowGlass", () => new PlaneGeometry(1.3, 1.0)), windowGlass, x, 1.95, -6.05, { noCast: true });
    put(root, rbox(0.06, 1.0, 0.06, 0.02), trim, x, 1.95, -6.02);
    put(root, rbox(1.3, 0.06, 0.06, 0.02), trim, x, 1.95, -6.02);
  }

  const charcoal = lit(PALETTE.charcoal, { roughness: 0.45 });
  const steelDark = lit(PALETTE.steelDark, { roughness: 0.4, metalness: 0.5 });
  const signTexture = texture(1024, 200, drawSign);
  put(root, rbox(4.4, 0.95, 0.12, 0.06), charcoal, 0.4, 3.85, -6.25);
  put(root, geo("signPlane", () => new PlaneGeometry(4.2, 0.82)), flat(0xffffff, { map: signTexture, toneMapped: false, opacity: 0.999 }), 0.4, 3.86, -6.17, {
    noCast: true
  });
  for (const x of [-1.4, 2.2]) put(root, cyl(0.03, 0.03, 0.5, 8), steelDark, x, 3.45, -6.25);
  glowSign.push(0.4, 3.86, -6.0);

  const menuTexture = texture(512, 360, drawMenuBoard);
  put(root, rbox(2.0, 1.45, 0.1, 0.05), lit(PALETTE.woodDark), -4.6, 2.35, -6.12);
  put(root, geo("menuPlane", () => new PlaneGeometry(1.82, 1.28)), flat(0xffffff, { map: menuTexture }), -4.6, 2.35, -6.06, { noCast: true });

  // ชั้นวางขวด/โหลบนผนังข้าง
  const shelfWood = lit(PALETTE.wood);
  const bottleColors = [0x3f8f5f, 0xb5562f, 0xe8c07a, 0x7a3b2e, 0x4a7fa8];
  for (const shelfY of [1.55, 2.2]) {
    put(root, rbox(0.34, 0.06, 2.4, 0.02), shelfWood, -7.28, shelfY, -3.4);
    for (let index = 0; index < 6; index++) {
      const color = bottleColors[(index + (shelfY > 2 ? 2 : 0)) % bottleColors.length];
      const tall = index % 2 === 0;
      put(root, cyl(0.07, 0.08, tall ? 0.36 : 0.22, 12), lit(color, { roughness: 0.3 }), -7.26, shelfY + (tall ? 0.21 : 0.14), -4.4 + index * 0.4);
      if (tall) put(root, cyl(0.03, 0.03, 0.1, 8), lit(PALETTE.woodDark), -7.26, shelfY + 0.44, -4.4 + index * 0.4);
    }
  }

  // ============================================================
  // counter (checkout)
  // ============================================================
  const counter = new Group();
  counter.position.set(-4.6, 0, -3.2);
  root.add(counter);
  put(counter, rbox(3.4, 1.0, 1.1, 0.08), lit(PALETTE.cream, { roughness: 0.6 }), 0, 0.55, 0);
  put(counter, rbox(3.44, 0.2, 1.14, 0.05), lit(PALETTE.woodDark), 0, 0.1, 0, { noCast: true });
  put(counter, rbox(3.46, 0.08, 1.16, 0.03), lit(PALETTE.jadeDeep, { roughness: 0.5 }), 0, 0.82, 0);
  for (let slat = 0; slat < 7; slat++) {
    put(counter, rbox(0.05, 0.5, 0.04, 0.02), lit(PALETTE.wood), -1.35 + slat * 0.45, 0.5, 0.56);
  }
  put(counter, rbox(3.7, 0.1, 1.34, 0.04), lit(PALETTE.wood, { roughness: 0.55 }), 0, 1.1, 0);

  put(counter, rbox(0.4, 0.07, 0.32, 0.03), charcoal, -0.4, 1.19, 0.05);
  put(counter, cyl(0.035, 0.035, 0.36, 10), charcoal, -0.4, 1.4, 0.02);
  const bezel = put(counter, rbox(1.12, 0.74, 0.07, 0.035), charcoal, -0.4, 1.74, 0.02, { rotation: [-0.22, 0, 0] });
  const posScreenTexture = texture(512, 320, drawPosScreen);
  put(bezel, geo("posScreen", () => new PlaneGeometry(1.02, 0.64)), flat(0xffffff, { map: posScreenTexture, toneMapped: false }), 0, 0, 0.037, {
    noCast: true
  });
  glowLarge.push(-4.95, 1.78, -3.0);

  // ใส่มาร์คแอปลงป้ายนีออน + หน้าจอ POS เมื่อรูปโหลดเสร็จ (ฉากแสดงผลได้ก่อนโดยไม่ต้องรอรูป)
  const redraw = (target: CanvasTexture, draw: Draw) => {
    const canvas = target.image as HTMLCanvasElement;
    const context = canvas.getContext("2d");
    if (!context) return;
    draw(context, canvas.width, canvas.height);
    target.needsUpdate = true;
  };
  void loadBrandMark(256).then((mark) => {
    if (!mark) return;
    redraw(signTexture, (context, width, height) => drawSign(context, width, height, mark));
    redraw(posScreenTexture, (context, width, height) => drawPosScreen(context, width, height, mark));
  });


  const creamSatin = lit(PALETTE.cream, { roughness: 0.5 });
  put(counter, rbox(0.44, 0.26, 0.42, 0.07), creamSatin, 0.62, 1.28, 0.08);
  put(counter, rbox(0.3, 0.03, 0.06, 0.01), charcoal, 0.62, 1.415, 0.18, { noCast: true });
  put(
    counter,
    geo("bell", () => new SphereGeometry(0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)),
    lit(PALETTE.brass, { roughness: 0.3, metalness: 0.7 }),
    1.3,
    1.15,
    0.3
  );
  put(counter, cyl(0.13, 0.13, 0.02, 16), charcoal, 1.3, 1.16, 0.3);
  put(counter, cyl(0.16, 0.12, 0.22, 14), lit(PALETTE.terracotta, { roughness: 0.85 }), -1.5, 1.26, 0.1);
  put(counter, geo("counterPlant", () => new IcosahedronGeometry(0.2, 1)), lit(PALETTE.leafLight, { roughness: 0.8 }), -1.5, 1.5, 0.1);

  // ใบเสร็จที่พิมพ์ออกมา — ยืดความสูงด้วย scale.y แล้วตัดทิ้งเป็นรอบ ๆ
  const receiptPivot = new Group();
  receiptPivot.position.set(0.62, 1.42, 0.2);
  counter.add(receiptPivot);
  const receiptGeometry = new PlaneGeometry(0.26, 1);
  receiptGeometry.translate(0, 0.5, 0);
  const receipt = live(receiptPivot, receiptGeometry, flat(0xfbf7f0, { side: DoubleSide }));
  receipt.rotation.x = -0.35;
  receipt.scale.y = 0.05;

  // สตูลหน้าเคาน์เตอร์
  const steel = lit(PALETTE.steel, { roughness: 0.3, metalness: 0.6 });
  for (const x of [-1.0, 0.4]) {
    put(counter, cyl(0.26, 0.24, 0.09, 20), lit(PALETTE.wood), x, 0.76, 1.15);
    put(counter, cyl(0.035, 0.035, 0.7, 10), steel, x, 0.38, 1.15);
    put(counter, torus(0.17, 0.018, 6, 24), steel, x, 0.3, 1.15, { rotation: [Math.PI / 2, 0, 0] });
    put(counter, cyl(0.2, 0.22, 0.04, 20), steel, x, 0.02, 1.15, { noCast: true });
  }
  hotspots.push(makeHotspot("counter", new Vector3(-4.6, 1.1, -2.9), [4.0, 2.4, 2.8], new Vector3(-4.9, 2.7, -3.2), 2.3));

  // ============================================================
  // kitchen
  // ============================================================
  const kitchen = new Group();
  kitchen.position.set(4.2, 0, -3.6);
  root.add(kitchen);
  put(kitchen, rbox(2.5, 0.9, 1.0, 0.06), steel, -0.5, 0.45, -1.0);
  put(kitchen, rbox(2.5, 0.05, 1.0, 0.02), charcoal, -0.5, 0.92, -1.0, { noCast: true });
  put(kitchen, rbox(1.2, 0.9, 1.0, 0.06), steel, 1.4, 0.45, -1.0);
  put(kitchen, rbox(0.9, 0.05, 0.6, 0.02), lit(PALETTE.woodLight, { roughness: 0.5 }), 1.4, 0.93, -1.0, { noCast: true });
  [0x49a86b, 0xef4444, 0xf5a524].forEach((color, index) =>
    put(kitchen, sphere(0.07, 12, 8), lit(color, { roughness: 0.5 }), 1.2 + index * 0.18, 1.0, -0.95)
  );

  for (const x of [-1.1, 0.1]) put(kitchen, torus(0.2, 0.03, 6, 24), charcoal, x, 0.95, -1.0, { rotation: [Math.PI / 2, 0, 0], noCast: true });
  // กระทะ: lathe รูปชามตื้น + ด้ามจับ
  const wokProfile = [new Vector2(0.0, 0), new Vector2(0.18, 0.02), new Vector2(0.3, 0.1), new Vector2(0.34, 0.16)];
  put(kitchen, geo("wok", () => new LatheGeometry(wokProfile, 24)), lit(0x2f2d33, { roughness: 0.35, metalness: 0.6 }), -1.1, 0.98, -1.0);
  put(kitchen, cyl(0.025, 0.025, 0.4, 8), lit(PALETTE.woodDark), -1.1, 1.12, -0.6, { rotation: [Math.PI / 2 - 0.2, 0, 0] });
  put(kitchen, cyl(0.28, 0.26, 0.36, 24), steel, 0.1, 1.15, -1.0);
  put(kitchen, cyl(0.29, 0.29, 0.03, 24), steelDark, 0.1, 1.345, -1.0);
  put(kitchen, sphere(0.04, 10, 6), charcoal, 0.1, 1.38, -1.0);
  put(kitchen, rbox(2.8, 0.4, 0.95, 0.08), steel, -0.5, 2.55, -1.1);
  put(kitchen, rbox(0.8, 0.9, 0.5, 0.05), steelDark, -0.5, 3.2, -1.25);

  put(kitchen, rbox(3.9, 0.98, 0.8, 0.07), lit(PALETTE.cream, { roughness: 0.6 }), 0.2, 0.49, 0.9);
  put(kitchen, rbox(4.0, 0.06, 0.92, 0.02), steel, 0.2, 1.01, 0.9);
  put(kitchen, rbox(4.0, 0.12, 0.84, 0.04), lit(PALETTE.woodDark), 0.2, 0.06, 0.9, { noCast: true });
  put(kitchen, rbox(3.8, 0.07, 0.1, 0.03), steel, 0.2, 2.0, 0.9);
  for (const x of [-1.6, 2.0]) put(kitchen, cyl(0.03, 0.03, 0.96, 8), steel, x, 1.5, 0.9);
  put(kitchen, rbox(0.44, 0.26, 0.42, 0.07), creamSatin, 1.55, 1.17, 0.95);
  const plateMaterial = lit(PALETTE.plate, { roughness: 0.3 });
  // จานที่ทำเสร็จรอเสิร์ฟบนช่องส่งอาหาร
  for (const [x, food] of [[-0.9, 0xf5a524], [-0.4, 0x49a86b]] as Array<[number, number]>) {
    put(kitchen, cyl(0.19, 0.15, 0.03, 24), plateMaterial, x, 1.05, 0.9);
    put(kitchen, sphere(0.12, 14, 8), lit(food, { roughness: 0.6 }), x, 1.07, 0.9, { scale: [1, 0.45, 1] });
  }
  glowLarge.push(4.4, 1.95, -2.7);

  const flameMaterial = flat(0xff8a3d, { opacity: 0.9, additive: true });
  const flameGeometry = new ConeGeometry(0.2, 0.2, 12);
  const flames = [-1.1, 0.1].map((x) => live(kitchen, flameGeometry, flameMaterial, x, 0.99, -1.0));

  // รางแขวนใบสั่งอาหาร — ใบที่บินมาจากโต๊ะจะมาเกาะที่นี่
  const ticketTexture = texture(128, 128, (context, width) => drawTicket(context, width));
  const ticketGeometry = new PlaneGeometry(0.32, 0.36);
  const ticketMaterial = flat(0xffffff, { map: ticketTexture, side: DoubleSide });
  const railTickets: Mesh[] = [];
  for (let index = 0; index < 5; index++) {
    const ticket = live(kitchen, ticketGeometry, ticketMaterial, -1.2 + index * 0.55, 1.78, 0.96);
    ticket.visible = index < 3;
    railTickets.push(ticket);
  }
  hotspots.push(makeHotspot("print", new Vector3(4.2, 1.5, -3.4), [4.6, 3.2, 3.4], new Vector3(4.2, 3.0, -3.0), 2.6));

  // ไอน้ำจากหม้อ — Points ก้อนเดียว แทน sprite แยกทีละตัว
  const steamCount = 10;
  const steamPositions = new Float32BufferAttribute(new Float32Array(steamCount * 3), 3);
  steamPositions.setUsage(DynamicDrawUsage);
  const steamGeometry = new BufferGeometry();
  steamGeometry.setAttribute("position", steamPositions);
  const steamMaterial = new PointsMaterial({ map: glowTexture, color: 0xfff1dc, size: 1.4, transparent: true, opacity: 0.16, depthWrite: false });
  const steam = new Points(steamGeometry, steamMaterial);
  steam.frustumCulled = false;
  root.add(steam);

  // ============================================================
  // dining tables
  // ============================================================
  const tableLayout: Array<{ x: number; z: number; seats: number; guests: number; status: TableStatus }> = [
    { x: -3.2, z: 1.2, seats: 4, guests: 2, status: "ordered" },
    { x: 0.2, z: 0.2, seats: 4, guests: 0, status: "free" },
    { x: 3.4, z: 1.4, seats: 4, guests: 3, status: "alert" },
    { x: -1.6, z: 4.4, seats: 2, guests: 2, status: "ordered" },
    { x: 2.2, z: 4.6, seats: 2, guests: 0, status: "free" }
  ];
  const shirts = [0xe0794a, 0x4f9d8a, 0xd8a24a, 0x9b5a86, 0x5a7fb5, 0xc9544b];
  const skins = [PALETTE.skinA, PALETTE.skinB, PALETTE.skinC];
  const hairs = [PALETTE.hairA, PALETTE.hairB];
  const foods = [0xf5a524, 0xd9572e, 0x49a86b, 0xe8c07a];
  const random = seededRandom(19);

  const tableTop = lit(PALETTE.woodLight, { roughness: 0.5 });
  const tableEdge = lit(PALETTE.wood, { roughness: 0.55 });
  const woodDark = lit(PALETTE.woodDark);
  const chairWood = lit(PALETTE.wood);
  const pants = lit(0x2f2a36);
  const qrTexture = texture(256, 256, (context, width) => drawQr(context, width));
  const qrMaterial = flat(0xffffff, { map: qrTexture });
  const shadeMaterial = lit(PALETTE.jadeDeep, { roughness: 0.5, metalness: 0.2 });
  const shadeInside = flat(0xffe0a8, { side: DoubleSide });
  const bulbMaterial = flat(PALETTE.bulb, { toneMapped: false });
  const cordMaterial = lit(0x1a1412);
  const shadeProfile = [new Vector2(0.05, 0.3), new Vector2(0.12, 0.26), new Vector2(0.26, 0.1), new Vector2(0.34, 0)];

  const addGuest = (chair: Object3D, index: number) => {
    const shirt = lit(shirts[index % shirts.length], { roughness: 0.8 });
    const skin = lit(skins[index % skins.length], { roughness: 0.7 });
    const hair = lit(hairs[index % hairs.length], { roughness: 0.9 });
    put(chair, capsule(0.19, 0.24), shirt, 0, 0.84, -0.04);
    put(chair, capsule(0.075, 0.2), pants, -0.1, 0.55, 0.14, { rotation: [Math.PI / 2, 0, 0] });
    put(chair, capsule(0.075, 0.2), pants, 0.1, 0.55, 0.14, { rotation: [Math.PI / 2, 0, 0] });
    put(chair, capsule(0.058, 0.24), shirt, -0.22, 0.9, 0.12, { rotation: [1.15, 0, 0.12] });
    put(chair, capsule(0.058, 0.24), shirt, 0.22, 0.9, 0.12, { rotation: [1.15, 0, -0.12] });
    put(chair, sphere(0.155, 20, 14), skin, 0, 1.29, -0.02);
    put(chair, sphere(0.162, 20, 14), hair, 0, 1.33, -0.05, { scale: [1, 0.78, 1] });
  };

  interface TableRig {
    status: TableStatus;
    position: Vector3;
    pulse: number;
  }
  const tables: TableRig[] = [];

  tableLayout.forEach((layout, tableIndex) => {
    const table = new Group();
    table.position.set(layout.x, 0, layout.z);
    root.add(table);

    // เงาปลอมใต้โต๊ะ — ถูกกว่า shadow map และให้ความรู้สึก "วางบนพื้น" ได้ทุก tier
    put(table, geo("contact", () => new CircleGeometry(1.45, 32)), flat(0x000000, { opacity: 0.32 }), 0, 0.012, 0, {
      rotation: [-Math.PI / 2, 0, 0],
      noCast: true
    });
    // แสงโคมตกบนพื้นรอบโต๊ะ (ของปลอมแบบ additive — ถูกกว่าไฟจริงหนึ่งดวงต่อโต๊ะมาก)
    put(table, geo("floorPool", () => new PlaneGeometry(3.6, 3.6)), flat(0xffb45c, { map: radialTexture, opacity: 0.22, additive: true }), 0, 0.02, 0, {
      rotation: [-Math.PI / 2, 0, 0],
      noCast: true
    });

    put(table, cyl(0.84, 0.84, 0.06, 48), tableTop, 0, 0.8, 0);
    put(table, torus(0.84, 0.035, 8, 64), tableEdge, 0, 0.8, 0, { rotation: [Math.PI / 2, 0, 0] });
    put(table, cyl(0.07, 0.09, 0.76, 14), woodDark, 0, 0.39, 0);
    put(table, cyl(0.34, 0.4, 0.05, 24), charcoal, 0, 0.025, 0, { noCast: true });
    put(table, geo("tablePool", () => new CircleGeometry(0.8, 32)), flat(0xffc27a, { map: radialTexture, opacity: 0.32, additive: true }), 0, 0.834, 0, {
      rotation: [-Math.PI / 2, 0, 0],
      noCast: true
    });

    for (let seat = 0; seat < layout.seats; seat++) {
      const angle = (seat / layout.seats) * Math.PI * 2 + (layout.seats === 2 ? Math.PI / 2 : Math.PI / 4);
      const chairX = Math.cos(angle) * 1.08;
      const chairZ = Math.sin(angle) * 1.08;
      const chair = new Group();
      chair.position.set(chairX, 0, chairZ);
      // ด้าน +Z ของเก้าอี้ (ด้านที่นั่ง) หันเข้าหากลางโต๊ะ
      chair.rotation.y = Math.atan2(-chairX, -chairZ);
      table.add(chair);

      put(chair, rbox(0.48, 0.07, 0.46, 0.03), chairWood, 0, 0.47, 0);
      for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]] as Array<[number, number]>) {
        const back = lz < 0;
        put(chair, cyl(0.022, 0.025, back ? 0.98 : 0.46, 8), woodDark, lx, back ? 0.49 : 0.23, lz);
      }
      put(chair, rbox(0.46, 0.12, 0.04, 0.02), chairWood, 0, 0.78, -0.19);
      put(chair, rbox(0.46, 0.12, 0.04, 0.02), chairWood, 0, 0.95, -0.19);

      const plateX = Math.cos(angle) * 0.52;
      const plateZ = Math.sin(angle) * 0.52;
      put(table, cyl(0.17, 0.13, 0.025, 24), plateMaterial, plateX, 0.842, plateZ);
      if (seat < layout.guests) {
        addGuest(chair, tableIndex * 3 + seat);
        put(table, sphere(0.1, 14, 8), lit(foods[(tableIndex + seat) % foods.length], { roughness: 0.6 }), plateX, 0.86, plateZ, {
          scale: [1, 0.42, 1]
        });
        const glassX = Math.cos(angle + 0.5) * 0.5;
        const glassZ = Math.sin(angle + 0.5) * 0.5;
        put(table, cyl(0.05, 0.043, 0.15, 14), lit(random() > 0.5 ? 0xe9a13b : 0x7a3b2e, { roughness: 0.2 }), glassX, 0.905, glassZ);
      }
    }

    // ป้าย QR แบบตั้งโต๊ะ — จุดเริ่มของการสั่งเอง
    const tent = put(table, rbox(0.24, 0.3, 0.05, 0.02), charcoal, 0.12, 0.98, 0.1, { rotation: [0, -0.4, 0] });
    put(tent, geo("qrPlane", () => new PlaneGeometry(0.19, 0.19)), qrMaterial, 0, 0.02, 0.027, { noCast: true });
    put(table, cyl(0.045, 0.055, 0.14, 12), lit(0xd8c7b0, { roughness: 0.3 }), -0.14, 0.9, -0.12);
    put(table, sphere(0.06, 10, 8), lit(0xe86a8a, { roughness: 0.7 }), -0.14, 1.02, -0.12);

    // โคมไฟแขวนเหนือโต๊ะ
    put(table, cyl(0.012, 0.012, 1.9, 6), cordMaterial, 0, 4.35, 0, { noCast: true });
    put(table, geo("shade", () => new LatheGeometry(shadeProfile, 28)), shadeMaterial, 0, 3.12, 0, { noCast: true });
    put(table, geo("shadeInside", () => new CircleGeometry(0.33, 28)), shadeInside, 0, 3.125, 0, { rotation: [Math.PI / 2, 0, 0], noCast: true });
    put(table, sphere(0.08, 12, 8), bulbMaterial, 0, 3.1, 0, { noCast: true });
    glowLarge.push(layout.x, 3.05, layout.z);

    tables.push({ status: layout.status, position: new Vector3(layout.x, 0, layout.z), pulse: 0 });
    hotspots.push(makeHotspot("tables", new Vector3(layout.x, 0.8, layout.z), [2.9, 1.8, 2.9], new Vector3(layout.x, 2.75, layout.z), 1.55, tableIndex));
  });

  // วงสถานะโต๊ะบนพื้น + หมุดลอย — InstancedMesh ชนิดละ 1 draw call สีต่อโต๊ะผ่าน instanceColor
  const ringGeometry = new RingGeometry(1.32, 1.46, 64);
  ringGeometry.rotateX(-Math.PI / 2);
  const ringMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
  const statusRings = new InstancedMesh(ringGeometry, ringMaterial, tables.length);
  const pinHead = new SphereGeometry(0.12, 18, 12);
  pinHead.translate(0, 0.14, 0);
  const pinTip = new ConeGeometry(0.085, 0.22, 18);
  pinTip.rotateX(Math.PI);
  pinTip.translate(0, -0.02, 0);
  const pinGeometry = mergeGeometries([pinHead, pinTip]) ?? new SphereGeometry(0.12, 18, 12);
  pinHead.dispose();
  pinTip.dispose();
  const pins = new InstancedMesh(pinGeometry, new MeshBasicMaterial({ toneMapped: false }), tables.length);
  statusRings.frustumCulled = false;
  pins.frustumCulled = false;
  root.add(statusRings, pins);

  const pinGlowPositions = new Float32BufferAttribute(new Float32Array(tables.length * 3), 3);
  pinGlowPositions.setUsage(DynamicDrawUsage);
  const pinGlowColors = new Float32BufferAttribute(new Float32Array(tables.length * 3), 3);
  const pinGlowGeometry = new BufferGeometry();
  pinGlowGeometry.setAttribute("position", pinGlowPositions);
  pinGlowGeometry.setAttribute("color", pinGlowColors);
  const pinGlow = new Points(
    pinGlowGeometry,
    new PointsMaterial({
      map: glowTexture,
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    })
  );
  pinGlow.frustumCulled = false;
  root.add(pinGlow);

  const scratchColor = new Color();
  const paintTable = (index: number) => {
    scratchColor.setHex(TABLE_STATUS_COLORS[tables[index].status]);
    statusRings.setColorAt(index, scratchColor);
    pins.setColorAt(index, scratchColor);
    pinGlowColors.setXYZ(index, scratchColor.r, scratchColor.g, scratchColor.b);
    if (statusRings.instanceColor) statusRings.instanceColor.needsUpdate = true;
    if (pins.instanceColor) pins.instanceColor.needsUpdate = true;
    pinGlowColors.needsUpdate = true;
  };
  tables.forEach((_, index) => paintTable(index));

  // ============================================================
  // QR phone (ลอยข้างโต๊ะที่ 3)
  // ============================================================
  const phone = new Group();
  const phoneHome = new Vector3(4.55, 1.95, 2.55);
  phone.position.copy(phoneHome);
  phone.rotation.set(-0.12, -0.62, 0.06);
  root.add(phone);
  live(phone, rbox(0.64, 1.26, 0.07, 0.08, 3), charcoal);
  const phoneTexture = texture(256, 512, drawPhoneMenu);
  live(phone, geo("phoneScreen", () => new PlaneGeometry(0.56, 1.14)), flat(0xffffff, { map: phoneTexture, toneMapped: false }), 0, 0, 0.037);
  const phoneHotspot = makeHotspot("qr", new Vector3(0, 0, 0), [0.9, 1.5, 0.5], new Vector3(4.55, 2.9, 2.55), 0.9);
  phone.add(phoneHotspot.proxy);
  phoneHotspot.center.set(4.55, 0, 2.55);
  hotspots.push(phoneHotspot);

  // ============================================================
  // sales hologram (reports)
  // ============================================================
  const hologram = new Group();
  hologram.position.set(0.4, 0, -4.6);
  root.add(hologram);
  put(hologram, cyl(0.62, 0.72, 0.2, 32), charcoal, 0, 0.1, 0);
  put(hologram, torus(0.55, 0.03, 6, 48), flat(PALETTE.jade, { toneMapped: false }), 0, 0.21, 0, { rotation: [Math.PI / 2, 0, 0], noCast: true });
  put(hologram, rbox(3.1, 2.1, 0.06, 0.05), lit(0x0f2622, { roughness: 0.3, emissive: 0x0b3a2c, emissiveIntensity: 0.6 }), 0, 1.45, -0.32, {
    noCast: true
  });
  const chartTexture = texture(512, 340, drawChartGrid);
  put(hologram, geo("chartGrid", () => new PlaneGeometry(3.0, 2.0)), flat(0xffffff, { map: chartTexture, opacity: 0.999, toneMapped: false }), 0, 1.45, -0.28, {
    noCast: true
  });
  const frameSource = new BoxGeometry(3.1, 2.1, 0.06);
  const frame = new LineSegments(new EdgesGeometry(frameSource), new LineBasicMaterial({ color: PALETTE.jade, transparent: true, opacity: 0.7 }));
  frameSource.dispose();
  frame.position.set(0, 1.45, -0.32);
  hologram.add(frame);

  const barHeights = [0.45, 0.75, 0.6, 1.05, 0.85, 1.3];
  const barGeometry = new BoxGeometry(0.28, 1, 0.14);
  barGeometry.translate(0, 0.5, 0);
  const bars = new InstancedMesh(barGeometry, new MeshBasicMaterial({ toneMapped: false }), barHeights.length);
  barHeights.forEach((_, index) => {
    scratchColor.setHex(index === barHeights.length - 1 ? PALETTE.mint : PALETTE.jade);
    bars.setColorAt(index, scratchColor);
  });
  bars.frustumCulled = false;
  hologram.add(bars);
  const barCurrent = barHeights.map((height) => height * 0.4);
  const trendPositions = new Float32BufferAttribute(
    barHeights.flatMap((_, index) => [-1.05 + index * 0.42, 0, -0.2]),
    3
  );
  trendPositions.setUsage(DynamicDrawUsage);
  const trendGeometry = new BufferGeometry();
  trendGeometry.setAttribute("position", trendPositions);
  const trend = new Line(trendGeometry, new LineBasicMaterial({ color: 0xffe2a8 }));
  trend.frustumCulled = false;
  hologram.add(trend);
  hotspots.push(makeHotspot("reports", new Vector3(0.4, 1.4, -4.8), [3.4, 2.8, 1.2], new Vector3(0.4, 2.85, -4.6), 1.9));

  // ============================================================
  // string lights + poles
  // ============================================================
  const poleMaterial = lit(0x2a1c1a);
  const poles: Array<[number, number]> = [[-8.2, 5.6], [-7.6, -5.8], [7.8, -5.8], [8.4, 5.2]];
  const wirePoints: number[] = [];
  for (const [x, z] of poles) {
    put(root, cyl(0.07, 0.09, 5.5, 10), poleMaterial, x, 2.75, z);
    put(root, sphere(0.1, 10, 8), poleMaterial, x, 5.52, z);
  }
  const stringBulb = flat(PALETTE.bulb, { toneMapped: false });
  for (let index = 0; index < poles.length; index++) {
    const [ax, az] = poles[index];
    const [bx, bz] = poles[(index + 1) % poles.length];
    const count = 18;
    let previous: Vector3 | null = null;
    for (let step = 0; step <= count; step++) {
      const t = step / count;
      const point = new Vector3(ax + (bx - ax) * t, 5.35 - Math.sin(t * Math.PI) * 0.8, az + (bz - az) * t);
      if (previous) wirePoints.push(previous.x, previous.y, previous.z, point.x, point.y, point.z);
      previous = point;
      if (step > 0 && step < count && step % 2 === 0) {
        put(root, sphere(0.085, 10, 8), stringBulb, point.x, point.y - 0.11, point.z, { noCast: true });
        glowSmall.push(point.x, point.y - 0.11, point.z);
      }
    }
  }
  const wireGeometry = new BufferGeometry();
  wireGeometry.setAttribute("position", new Float32BufferAttribute(wirePoints, 3));
  root.add(new LineSegments(wireGeometry, new LineBasicMaterial({ color: 0x140d0a })));

  // ============================================================
  // plants (พุ่มกลมจาก icosahedron ผิวเรียบ)
  // ============================================================
  const potMaterial = lit(PALETTE.terracotta, { roughness: 0.85 });
  const leafDark = lit(PALETTE.leaf, { roughness: 0.8 });
  const leafLight = lit(PALETTE.leafLight, { roughness: 0.8 });
  const leafGeometry = geo("leafBlob", () => new IcosahedronGeometry(1, 2));
  const plantRandom = seededRandom(11);
  for (const [x, z, size] of [[-6.6, 3.8, 1], [6.9, 3.0, 1.15], [-6.5, -0.4, 0.9], [6.9, -1.2, 1]] as Array<[number, number, number]>) {
    put(root, cyl(0.36 * size, 0.27 * size, 0.55 * size, 18), potMaterial, x, 0.275 * size, z);
    put(root, torus(0.36 * size, 0.04 * size, 6, 24), potMaterial, x, 0.55 * size, z, { rotation: [Math.PI / 2, 0, 0] });
    for (let leafIndex = 0; leafIndex < 7; leafIndex++) {
      const radius = (0.22 + plantRandom() * 0.16) * size;
      const angle = plantRandom() * Math.PI * 2;
      const spread = plantRandom() * 0.28 * size;
      put(root, leafGeometry, leafIndex % 2 ? leafDark : leafLight, x + Math.cos(angle) * spread, (0.8 + plantRandom() * 0.7) * size, z + Math.sin(angle) * spread, {
        scale: [radius, radius * 1.1, radius]
      });
    }
  }

  // ============================================================
  // waiter (เดินวนระหว่างโต๊ะ ถือถาด)
  // ============================================================
  const waiter = new Group();
  root.add(waiter);
  const waiterBody = new Group();
  waiter.add(waiterBody);
  const whiteShirt = lit(0xf4efe6, { roughness: 0.8 });
  // ชิ้นส่วนลำตัวไม่ขยับเทียบกับลำตัว — รวมเป็น mesh เดียว (ตามผิววัสดุ) แล้วขยับทั้งก้อน
  put(waiterBody, capsule(0.19, 0.42), whiteShirt, 0, 1.02, 0);
  put(waiterBody, rbox(0.36, 0.5, 0.06, 0.03), lit(PALETTE.jadeDeep, { roughness: 0.7 }), 0, 0.88, 0.17);
  put(waiterBody, sphere(0.155, 20, 14), lit(PALETTE.skinB, { roughness: 0.7 }), 0, 1.5, 0);
  put(waiterBody, sphere(0.162, 20, 14), lit(PALETTE.hairA, { roughness: 0.9 }), 0, 1.55, -0.03, { scale: [1, 0.78, 1] });
  put(waiterBody, capsule(0.058, 0.3), whiteShirt, 0.24, 1.18, 0.12, { rotation: [-0.9, 0, -0.35] });
  put(waiterBody, cyl(0.28, 0.28, 0.025, 28), steel, 0.32, 1.33, 0.26);
  put(waiterBody, cyl(0.12, 0.09, 0.08, 18), plateMaterial, 0.28, 1.38, 0.24);
  put(waiterBody, sphere(0.09, 12, 8), lit(PALETTE.saffron, { roughness: 0.6 }), 0.28, 1.42, 0.24, { scale: [1, 0.5, 1] });
  // ขาหมุนรอบสะโพก (pivot) ไม่ใช่รอบกลางขา — ไม่งั้นเท้าลอยเหนือพื้น
  const makeLeg = (x: number) => {
    const hip = new Group();
    hip.position.set(x, 0.62, 0);
    waiter.add(hip);
    live(hip, capsule(0.075, 0.42), pants, 0, -0.29, 0);
    return hip;
  };
  const legLeft = makeLeg(-0.09);
  const legRight = makeLeg(0.09);
  const waiterPath = new CatmullRomCurve3(
    [
      new Vector3(2.6, 0, -2.2),
      new Vector3(1.8, 0, -0.6),
      new Vector3(1.8, 0, 2.8),
      new Vector3(0.3, 0, 2.7),
      new Vector3(-1.4, 0, 2.4),
      new Vector3(-1.6, 0, -0.8),
      new Vector3(-0.2, 0, -2.0)
    ],
    true,
    "catmullrom",
    0.5
  );
  const waiterLength = waiterPath.getLength();
  const waiterPoint = new Vector3();
  const waiterTangent = new Vector3();

  // ============================================================
  // hover selection ring
  // ============================================================
  const selectionGeometry = new RingGeometry(0.94, 1, 72);
  selectionGeometry.rotateX(-Math.PI / 2);
  const selectionMaterial = new MeshBasicMaterial({
    color: PALETTE.mint,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const selection = new Mesh(selectionGeometry, selectionMaterial);
  selection.frustumCulled = false;
  selection.visible = false;
  root.add(selection);

  // ============================================================
  // static glow sprites
  // ============================================================
  const makeGlow = (positions: number[], size: number, color: number, opacity: number) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    const points = new Points(
      geometry,
      new PointsMaterial({ map: glowTexture, color, size, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, toneMapped: false })
    );
    root.add(points);
    return points;
  };
  const stringGlow = makeGlow(glowSmall, 1.5, 0xffc46b, 0.9);
  makeGlow(glowLarge, 3.4, 0xffb35c, 0.55);
  makeGlow(glowSign, 6, 0x34d399, 0.35);

  // กล่อง raycast ต้องอยู่ใน scene graph เพื่อให้ matrixWorld ถูกคำนวณ
  hotspots.forEach((hotspot) => {
    if (!hotspot.proxy.parent) root.add(hotspot.proxy);
  });

  // ============================================================
  // merge static geometry
  // ============================================================
  // ต้องรวมลำตัวพนักงานก่อน root — mesh ที่รวมแล้วไม่มีป้าย static จึงไม่ถูกดูดเข้าก้อนของ root อีกรอบ
  mergeStaticMeshes(waiterBody, false);
  mergeStaticMeshes(root, shadows);
  // geometry ต้นแบบในแคชถูกคัดลอกไปรวมแล้ว — ทิ้งตัวที่ไม่มี mesh ไหนใช้ต่อ
  const usedGeometries = new Set<BufferGeometry>();
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (mesh.geometry) usedGeometries.add(mesh.geometry);
  });
  geometryCache.forEach((geometry) => {
    if (!usedGeometries.has(geometry)) geometry.dispose();
  });
  // วัสดุสีล้วนที่ถูกแทนด้วยวัสดุ vertex color ร่วม — ทิ้งตัวที่ไม่เหลือ mesh ไหนใช้
  const usedMaterials = new Set<Material>();
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (mesh.material && !Array.isArray(mesh.material)) usedMaterials.add(mesh.material);
  });
  litCache.forEach((material) => {
    if (!usedMaterials.has(material)) material.dispose();
  });

  // ============================================================
  // flying order tickets (table → kitchen)
  // ============================================================
  const flights: Array<{ mesh: Mesh; from: Vector3; progress: number }> = [];
  const railTarget = new Vector3(4.4, 1.8, -2.6);
  const launchTicket = (from: Vector3) => {
    const flying = live(root, ticketGeometry, ticketMaterial);
    flying.position.copy(from);
    flights.push({ mesh: flying, from: from.clone().setY(1.3), progress: 0 });
  };
  // ลำดับช่องบนรางจากเก่าไปใหม่ — รางเต็มเมื่อไหร่ ใบเก่าสุดถือว่าทำเสร็จแล้ว เอาช่องนั้นมาใช้ใหม่
  const railQueue: number[] = [0, 1, 2];
  const pinTicketOnRail = () => {
    let slot = railTickets.findIndex((ticket) => !ticket.visible);
    if (slot < 0) slot = railQueue.shift() ?? 0;
    railTickets[slot].visible = true;
    railQueue.push(slot);
  };

  const setTableStatus = (index: number, status: TableStatus) => {
    const table = tables[index];
    if (!table) return;
    const previous = table.status;
    table.status = status;
    table.pulse = 1;
    paintTable(index);
    if (status === "ordered" && previous !== "ordered") launchTicket(table.position);
  };

  const cycleTable = (index: number) => {
    const table = tables[index];
    if (!table) return "free";
    const next = NEXT_TABLE_STATUS[table.status];
    setTableStatus(index, next);
    return next;
  };

  const matrix = new Matrix4();
  const identity = new Quaternion();
  const scratch = new Vector3();
  const scratchScale = new Vector3();
  let autoOrderTimer = 2.5;
  let receiptTimer = 0;
  let autoTableCursor = 0;
  let waiterDistance = 0;
  let selectionFade = 0;
  let lastHovered: RestaurantHotspot | null = null;

  const animate = ({ deltaSeconds, time, weights, hovered }: RestaurantFrame) => {
    // ลูกค้าสั่งอาหารเองเป็นระยะ — ร้านเคลื่อนไหวอยู่เสมอแม้ผู้ใช้จะไม่แตะอะไร
    autoOrderTimer -= deltaSeconds;
    if (autoOrderTimer <= 0) {
      autoOrderTimer = 4.5 - weights.qr * 2 - weights.tables;
      autoTableCursor = (autoTableCursor + 2) % tables.length;
      const table = tables[autoTableCursor];
      setTableStatus(autoTableCursor, table.status === "ordered" ? "free" : "ordered");
    }

    tables.forEach((table, index) => {
      table.pulse = Math.max(0, table.pulse - deltaSeconds * 1.6);
      const alert = table.status === "alert" ? 0.35 + Math.abs(Math.sin(time * 5)) * 0.65 : 1;
      const ringScale = 1 + table.pulse * 0.25 + Math.sin(time * 2 + index) * 0.015;
      matrix.makeScale(ringScale, 1, ringScale).setPosition(table.position.x, 0.03, table.position.z);
      statusRings.setMatrixAt(index, matrix);

      const pinY = 2.35 + Math.sin(time * 2 + index) * 0.06 + table.pulse * 0.2;
      const pinScale = (1 + table.pulse * 0.4) * (hovered?.tableIndex === index ? 1.2 : 1) * (0.6 + alert * 0.4);
      scratch.set(table.position.x, pinY, table.position.z);
      scratchScale.setScalar(pinScale);
      matrix.compose(scratch, identity, scratchScale);
      pins.setMatrixAt(index, matrix);
      pinGlowPositions.setXYZ(index, table.position.x, pinY + 0.14, table.position.z);
    });
    statusRings.instanceMatrix.needsUpdate = true;
    pins.instanceMatrix.needsUpdate = true;
    pinGlowPositions.needsUpdate = true;
    ringMaterial.opacity = 0.55 + weights.tables * 0.35;

    flights.forEach((flight) => {
      flight.progress += deltaSeconds / 1.6;
      const t = Math.min(1, flight.progress);
      scratch.lerpVectors(flight.from, railTarget, t);
      scratch.y += Math.sin(t * Math.PI) * 2.4;
      flight.mesh.position.copy(scratch);
      flight.mesh.rotation.set(Math.sin(t * 6) * 0.4, t * Math.PI * 4, 0);
    });
    for (let index = flights.length - 1; index >= 0; index--) {
      if (flights[index].progress < 1) continue;
      root.remove(flights[index].mesh);
      flights.splice(index, 1);
      pinTicketOnRail();
    }

    railTickets.forEach((ticket, index) => {
      ticket.rotation.z = Math.sin(time * 1.6 + index) * 0.08;
    });

    flames.forEach((flame, index) => {
      const flicker = 0.85 + Math.sin(time * 18 + index * 2) * 0.1 + Math.sin(time * 7.3 + index) * 0.08;
      flame.scale.set(flicker, 0.8 + flicker * 0.6, flicker);
    });
    for (let index = 0; index < steamCount; index++) {
      const cycle = (time * 0.32 + index / steamCount) % 1;
      const potX = index % 2 ? -1.1 : 0.1;
      steamPositions.setXYZ(index, 4.2 + potX + Math.sin(cycle * 6 + index) * 0.12, 1.3 + cycle * 1.3, -4.6);
    }
    steamPositions.needsUpdate = true;
    steamMaterial.opacity = 0.12 + weights.print * 0.12;

    // ใบเสร็จค่อย ๆ ยาวออกจากเครื่องพิมพ์ แล้วเริ่มใหม่ — เร็วขึ้นเมื่อกล้องอยู่ที่เคาน์เตอร์
    receiptTimer += deltaSeconds * (0.35 + weights.counter * 0.9);
    const receiptCycle = receiptTimer % 1.6;
    receipt.scale.y = receiptCycle < 1 ? 0.05 + receiptCycle * 0.55 : 0.6;
    receipt.visible = receiptCycle < 1.45;

    phone.position.set(phoneHome.x, phoneHome.y + Math.sin(time * 1.3) * 0.1 + weights.qr * 0.3, phoneHome.z);
    phone.rotation.y = -0.62 + Math.sin(time * 0.7) * 0.15 + weights.qr * 0.3;

    // กราฟรายงาน "โต" ขึ้นเมื่อมาถึงจุดรายงาน — กลับไปเตี้ยเมื่อกล้องไปที่อื่น
    const growth = 0.35 + weights.reports * 0.65;
    const barEase = 1 - Math.exp(-5 * deltaSeconds);
    barHeights.forEach((height, index) => {
      const target = height * growth * (1 + Math.sin(time * 1.8 + index * 0.7) * 0.04);
      barCurrent[index] += (target - barCurrent[index]) * barEase;
      scratch.set(-1.05 + index * 0.42, 0.55, -0.22);
      scratchScale.set(1, barCurrent[index], 1);
      matrix.compose(scratch, identity, scratchScale);
      bars.setMatrixAt(index, matrix);
      trendPositions.setY(index, 0.55 + barCurrent[index] + 0.16);
    });
    bars.instanceMatrix.needsUpdate = true;
    trendPositions.needsUpdate = true;

    // พนักงานเสิร์ฟ: เดินตามเส้นทางปิด ขาแกว่งรอบสะโพก ตัวกระเพื่อมตามจังหวะก้าว
    waiterDistance = (waiterDistance + deltaSeconds * 0.62) % waiterLength;
    const u = waiterDistance / waiterLength;
    waiterPath.getPointAt(u, waiterPoint);
    waiterPath.getTangentAt(u, waiterTangent);
    waiter.position.copy(waiterPoint);
    waiter.rotation.y = Math.atan2(waiterTangent.x, waiterTangent.z);
    const stride = time * 7.5;
    legLeft.rotation.x = Math.sin(stride) * 0.45;
    legRight.rotation.x = -Math.sin(stride) * 0.45;
    waiterBody.position.y = Math.abs(Math.cos(stride)) * 0.035;

    (stringGlow.material as PointsMaterial).opacity = 0.8 + Math.sin(time * 2.1) * 0.1;

    // วงแหวนไฮไลต์ใต้วัตถุที่เมาส์ชี้ — จางเข้า/ออกแทนการกระโดด
    if (hovered) lastHovered = hovered;
    selectionFade += ((hovered ? 1 : 0) - selectionFade) * (1 - Math.exp(-10 * deltaSeconds));
    if (lastHovered && selectionFade > 0.01) {
      selection.visible = true;
      selection.position.set(lastHovered.center.x, 0.035, lastHovered.center.z);
      selection.scale.setScalar(lastHovered.radius * (1 + Math.sin(time * 4) * 0.03));
      selectionMaterial.opacity = selectionFade * 0.9;
    } else {
      selection.visible = false;
    }
  };

  return { root, hotspots, cycleTable, animate };
}

/** กล่อง raycast ล่องหน — visible=false ไม่ถูกวาด แต่ Raycaster ยังชนได้ */
function makeHotspot(
  stop: LandingTourFeatureStop,
  position: Vector3,
  size: [number, number, number],
  anchor: Vector3,
  radius: number,
  tableIndex?: number
): RestaurantHotspot {
  const proxy = new Mesh(new BoxGeometry(...size), new MeshBasicMaterial());
  proxy.position.copy(position);
  proxy.visible = false;
  return { stop, anchor, proxy, center: new Vector3(position.x, 0, position.z), radius, tableIndex };
}

/** วัสดุทึบสีล้วน (ไม่มี texture/แสงเรือง) — ย้ายสีไปไว้ที่ vertex color ได้ แล้วใช้วัสดุร่วมกันตามผิว (roughness/metalness) */
function paintableMaterial(material: Material): LitMaterial | null {
  if (!(material instanceof MeshStandardMaterial) && !(material instanceof MeshLambertMaterial)) return null;
  if (material.map || material.transparent || material.emissive.getHex() !== 0) return null;
  return material;
}

/**
 * รวม mesh ที่ไม่ขยับทั้งหมดเป็นก้อนเดียวต่อวัสดุ (+ ต่อสถานะการสร้างเงา)
 * วัสดุสีล้วนถูกรวมข้ามสีด้วย vertex color — เสื้อ 6 สี ผิว 3 สี ขวด 5 สี ฯลฯ กลายเป็น draw call เดียวต่อผิววัสดุ
 * ต้องแปลงเป็น non-indexed ทั้งหมดก่อน เพราะ mergeGeometries รวม indexed กับ non-indexed ไม่ได้
 */
function mergeStaticMeshes(root: Group, shadows: boolean) {
  // ใช้ matrix เทียบกับ root เสมอ (ไม่ใช่ world) — root ย่อย เช่นลำตัวพนักงาน ต้องได้ geometry ในพิกัดของตัวเอง
  root.updateMatrixWorld(true);
  const rootInverse = root.matrixWorld.clone().invert();
  const relative = new Matrix4();
  const buckets = new Map<string, { material: Material; cast: boolean; geometries: BufferGeometry[] }>();
  const merged: Mesh[] = [];

  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || !mesh.userData.static || Array.isArray(mesh.material)) return;
    const material = mesh.material as Material;
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "uv") geometry.deleteAttribute(name);
    }
    if (!geometry.getAttribute("uv")) {
      geometry.setAttribute("uv", new Float32BufferAttribute(new Float32Array(geometry.getAttribute("position").count * 2), 2));
    }
    if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
    geometry.applyMatrix4(relative.multiplyMatrices(rootInverse, mesh.matrixWorld));
    const cast = shadows && !mesh.userData.noCast && !material.transparent;

    const paintable = paintableMaterial(material);
    let key = `${material.uuid}:${cast}`;
    let bucketMaterial: Material = material;
    if (paintable) {
      const count = geometry.getAttribute("position").count;
      const colors = new Float32Array(count * 3);
      for (let index = 0; index < count; index++) {
        colors[index * 3] = paintable.color.r;
        colors[index * 3 + 1] = paintable.color.g;
        colors[index * 3 + 2] = paintable.color.b;
      }
      geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
      // ปัดผิววัสดุเป็นไม่กี่ระดับ (ด้าน/กึ่งเงา/เงา × โลหะหรือไม่) — ต่างกันเล็กน้อยตาแทบไม่เห็น แต่รวม draw call ได้มาก
      const finish =
        paintable instanceof MeshStandardMaterial
          ? `${Math.round(paintable.roughness * 4) / 4}:${paintable.metalness >= 0.4 ? "metal" : "matte"}`
          : "lambert";
      key = `paint:${finish}:${cast}`;
      const existing = buckets.get(key);
      if (existing) {
        bucketMaterial = existing.material;
      } else {
        const shared = paintable.clone();
        shared.color.setHex(0xffffff);
        shared.vertexColors = true;
        if (shared instanceof MeshStandardMaterial) {
          shared.roughness = Math.round(paintable instanceof MeshStandardMaterial ? paintable.roughness * 4 : 3) / 4;
          shared.metalness = paintable instanceof MeshStandardMaterial && paintable.metalness >= 0.4 ? 0.6 : 0;
        }
        bucketMaterial = shared;
      }
    }

    const bucket = buckets.get(key) ?? { material: bucketMaterial, cast, geometries: [] };
    bucket.geometries.push(geometry);
    buckets.set(key, bucket);
    merged.push(mesh);
  });

  merged.forEach((mesh) => mesh.removeFromParent());
  // ลบ Group ว่างที่เหลือ (โต๊ะ/เก้าอี้ ที่ลูกทั้งหมดถูกรวมไปแล้ว)
  const pruneEmpty = (node: Object3D) => {
    [...node.children].forEach(pruneEmpty);
    if (node !== root && node.type === "Group" && node.children.length === 0) node.removeFromParent();
  };
  pruneEmpty(root);

  buckets.forEach(({ material, cast, geometries }) => {
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach((item) => item.dispose());
    if (!geometry) return;
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = shadows && !material.transparent;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    root.add(mesh);
  });
}

/** เก็บ geometry/material/texture ทั้งหมดใต้ object เพื่อ dispose ครั้งเดียว */
export function collectDisposables(object: Object3D) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  object.traverse((child: Object3D) => {
    const resource = child as Object3D & { geometry?: BufferGeometry; material?: Material | Material[] };
    if (resource.geometry) geometries.add(resource.geometry);
    const list = Array.isArray(resource.material) ? resource.material : resource.material ? [resource.material] : [];
    list.forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => {
        if (value && typeof value === "object" && (value as Texture).isTexture) textures.add(value as Texture);
      });
    });
  });
  return { geometries, materials, textures };
}
