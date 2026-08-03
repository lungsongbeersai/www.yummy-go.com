# Redesign `/pos` — Yummy Go Menu "Nightfall"

วันที่: 2026-08-03 · branch: `feature-32`

ที่มา: Claude Design project `Yummy Go QR menu redesign`
(`06193a47-3aa0-41e4-a085-3c8368ac52aa`) ไฟล์ `Yummy Go Menu - Nightfall.dc.html`

## เป้าหมาย

เปลี่ยนหน้าสั่งอาหารสาธารณะ `/pos?t=` จากธีมเขียว-ขาวปัจจุบัน มาเป็นภาษาออกแบบ
Nightfall — พื้นอุ่นเข้ม, เส้นขอบบาง, การ์ดกระจก, หัวข้อเป็น serif ลาว, ตัวเลขเป็น
serif ละติน — โดย**ไม่ลดฟังก์ชันใด ๆ ที่มีอยู่**

`/pos` เป็น consumer เดียวของ `src/features/public-pos/` (ยืนยันด้วย grep) จึงไม่มี
route อื่นได้รับผลกระทบ

> หมายเหตุเอกสาร: `CLAUDE.md` ระบุ route `/q/[token]` แต่ `src/app/q` ไม่มีอยู่จริง
> แล้ว — เป็นข้อมูลค้าง ไม่แก้ในงานนี้

## ข้อตัดสินที่ผู้ใช้เลือก

| หัวข้อ | เลือก |
|---|---|
| ธีม | Nightfall (dark) + Daylight (light) คู่กัน คงปุ่ม toggle เดิม |
| Hero 3D | ใช้ CSS/SVG แทน three.js — ไม่เพิ่ม dependency |
| Accent | ทำเป็น token สลับได้ทั้ง gold / emerald / rose |
| ขอบเขต | ทั้งหน้า รวม sheet/dialog ทุกตัว |

## สถาปัตยกรรม token

ไฟล์ใหม่ `src/features/public-pos/order/nightfall.css` `@import` เข้า
`src/app/globals.css` (บรรทัดถัดจาก `@import "tailwindcss"`) เพื่อให้ Tailwind v4
เห็น `@theme` block — ถ้าไม่ import เข้า entry เดียวกัน Tailwind จะไม่ generate utility ให้

### สโคป

ทุก token อยู่ใต้ `[data-yg-menu]` เท่านั้น ไม่รั่วออกนอก `/pos`

### เกาะไปกับ toggle เดิมโดยไม่ใช้ JS

```css
[data-yg-menu]            { /* Daylight */ }
:where(.dark) [data-yg-menu] { /* Nightfall */ }
```

`.dark` ถูกใส่ที่ `<html>` โดย theme-bootstrap script + `app-store` อยู่แล้ว
วิธีนี้ปุ่มสลับธีมเดิมทำงานต่อได้ทันที ไม่ต้องเดินสาย state ใหม่

### token surface

`--yg-bg` `--yg-bg2` `--yg-panel` `--yg-panel2` `--yg-panel-hover`
`--yg-line` `--yg-line2` `--yg-ink` `--yg-muted` `--yg-faint`
`--yg-media-a` `--yg-media-b` `--yg-glow1` `--yg-glow2` `--yg-shell` `--yg-scrim`

### token accent

`--yg-accent` `--yg-accent-strong` `--yg-accent-soft` `--yg-accent-line` `--yg-on-accent`

สลับด้วย `[data-yg-accent="gold|emerald|rose"]` ค่า default มาจากค่าคงที่
`PUBLIC_POS_ACCENT` ใน `constants.ts` (ตั้งต้น `emerald` ให้ตรงแบรนด์เดิม
และตรง `data-props` default ของไฟล์ดีไซน์) — เปลี่ยนทั้งหน้าได้ที่จุดเดียว
ไม่สร้าง UI ให้ลูกค้ากดเอง เพราะไม่มีใครขอ

### จุดสำคัญ: light mode ต้องเปลี่ยนค่า accent ไม่ใช่แค่พลิกพื้นหลัง

ดีไซน์ใช้ `--gold-strong` (`#F2CE93`) เป็น**สีตัวอักษร**ของราคาและหัวข้อ
ถ้าเอาค่าเดิมไปวางบนพื้นสว่างจะได้ contrast ราว 1.4:1 — อ่านไม่ออก
Daylight จึงมีชุด accent ของตัวเอง เช่น emerald: `--yg-accent:#127A4B`,
`--yg-accent-strong:#0B6A3F`, `--yg-on-accent:#F2FFF8` และตรวจ contrast จริง
ตอน implement (เป้าหมาย ≥ 4.5:1 สำหรับ text, ≥ 3:1 สำหรับ UI/ขอบ)

### mapping เข้า Tailwind

`@theme inline` map `--yg-*` → `--color-yg-*` เพื่อให้เขียนเป็น utility ปกติ
(`bg-yg-panel`, `text-yg-ink`, `border-yg-line`, `text-yg-accent-strong`)
ตามแนวเดียวกับที่ `globals.css` ทำกับ `--color-background` อยู่แล้ว —
ไม่ใช้ inline `style=` แบบไฟล์ดีไซน์ เพราะขัดคอนเวนชันโปรเจกต์

## ฟอนต์

โหลดผ่าน `next/font/google` ใน `src/app/pos/page.tsx` (route-scoped) แล้วส่ง
`className` ตัวแปรฟอนต์ลงมา — ไม่แตะ root layout จึงไม่เพิ่มน้ำหนักให้หน้าอื่น
ตามแพตเทิร์นเดียวกับ `src/app/home/page.tsx`

| บทบาท | ฟอนต์ | น้ำหนัก |
|---|---|---|
| หัวข้อลาว | Noto Serif Lao | 500/600/700 |
| ตัวเลข ราคา ชื่อโต๊ะ | Cormorant Garamond | 500/600/700 |
| body / ปุ่ม | Manrope (variable) | 400–800 |
| label ตัวเล็ก | system mono stack | — |

**เบี่ยงจากดีไซน์ 1 จุด:** ดีไซน์ระบุ JetBrains Mono แต่ถูกใช้แค่ label ขนาด
8.5–11px กับตัวเลขจำนวน ผมใช้ `ui-monospace` system stack แทน — ประหยัด
~20KB + 1 connection บนหน้าที่ลูกค้าเปิดผ่านเน็ตร้าน โดยแทบแยกไม่ออกที่ขนาดนั้น
Noto Sans Lao ยังมาจาก root layout ตามเดิม ใช้เป็น fallback ของ Manrope

## แผนที่ component

| ไฟล์ | งาน |
|---|---|
| `public-pos-client.tsx` | shell: `data-yg-menu`, พื้น gradient, glow orb 2 ตัว (CSS), container 1120px |
| `public-header.tsx` | monogram YG, eyebrow + ชื่อโต๊ะ serif + จุดสถานะ, กลุ่มปุ่มกระจก |
| `public-menu-hero.tsx` **(ใหม่)** | badge, headline serif, subcopy, ช่องค้นหา + ปุ่ม, ambience CSS/SVG |
| `product-browse-content.tsx` | category rail เป็น pill มีจุดนำ (active = accent ทึบ), sticky bar |
| `public-status-rail-section.tsx` | eyebrow "Featured" + h2 serif + ปุ่ม "ທັງໝົດ", rail scroll-snap |
| `public-product-card.tsx` | การ์ดตามดีไซน์ ทั้ง 4 variant (grid/rail/railGrid/list) |
| `public-product-media.tsx` | media plate gradient + accent radial, badge PROMO, overlay หมดแล้ว |
| `public-product-category-section.tsx` | หัว section + จำนวนรายการเป็น mono |
| `public-bottom-nav.tsx` | nav ลอยกระจก, แถบ marker + glow ของตัว active |
| `product-order-sheet-content.tsx` | modal รายละเอียดตามดีไซน์ + คง topping/note/promo |
| `cart-sheet-content.tsx`, `cart-sheet-items.tsx`, `cart-note-dialog.tsx` | retoken |
| `public-search-sheet.tsx`, `public-qr-dialog.tsx` | retoken |
| `public-pos-skeletons.tsx` | skeleton เป็น panel/line |
| `scroll-jump-controls.tsx`, `horizontal-scroll-arrows.tsx` | retoken |
| `cart-fly-animation-layer.tsx` | เปลี่ยนสีเป็น accent |

## สิ่งที่ดีไซน์ไม่ครอบคลุม → จัดการยังไง

ไฟล์ดีไซน์เป็น mock ข้อมูลนิ่ง ครอบคลุมราว 60% ของหน้าจริง ส่วนที่เหลือ**คงไว้ครบ**
และ restyle ให้เข้าชุด: search sheet, ปุ่มสลับ grid/list, section ย่อ-ขยายได้,
rail โปรโมชั่น/เซ็ต, scroll jump, QR dialog, cart sheet + note dialog,
cart fly animation, สถานะ loading/error/empty

**การประสานที่ต้องตัดสิน:** ดีไซน์มีช่องค้นหาใน hero แต่ของจริงมี search bar แบบ
sticky อยู่แล้ว → hero ถือช่องค้นหาหลัก (กดแล้วเปิด search sheet เดิม) ส่วน sticky
bar เหลือช่องค้นหาแบบกระชับ + ปุ่มสลับ layout ตอนเลื่อนพ้น hero

## แก้จากดีไซน์เพื่อ accessibility

ดีไซน์เป็น mock จึงมีจุดที่ไม่ผ่านเกณฑ์ ผมแก้ตอน implement และถือเป็นส่วนหนึ่งของงาน:

1. **touch target** — ดีไซน์ใช้ปุ่ม 38px ที่ header และ stepper ในโมดัล
   ยกเป็น 44px (`h-11`) ตามมาตรฐานที่โปรเจกต์ใช้อยู่
2. **`--faint` เล็กเกินเกณฑ์** — `#7E7568` บน `#141110` ได้ ~4.0:1 ต่ำกว่า 4.5
   ยกเป็นราว `#8F8676` สำหรับข้อความขนาด body คงค่าจางไว้เฉพาะงานตกแต่ง
3. **ปุ่ม disabled `opacity:.4`** — ที่ bottom nav รวมกับสี muted แล้วตก
   ยกเป็น ≥ .55
4. **ไม่มี focus ring เลยทั้งไฟล์** — เพิ่ม `focus-visible` ring สี accent
   ให้ทุก element ที่กดได้
5. **reduced motion** — คง `animation:none` ของดีไซน์ และปิด glow pulse
   กับ hero ambience ด้วย

## นอกขอบเขต

- ไม่แตะ service / store / hook — งานนี้เป็น presentation ล้วน
- ไม่แตะ `/pos/order`, `/pos/tables` (หลัง auth) และหน้า back-office
- ไม่เพิ่ม dependency ใหม่
- ไม่เปลี่ยน URL `?t=` (ตรึงไว้บน QR จริง)
- ไม่สร้าง UI ให้ลูกค้าเลือก accent เอง

## การตรวจงาน

- `npm run typecheck` และ `npm run lint` ต้องผ่าน
- `npm test` ต้องผ่าน (logic เดิมไม่ถูกแตะ — ใช้ยืนยันว่าไม่มี regression)
- ตรวจด้วยตาทั้ง Nightfall และ Daylight, ทั้ง 3 accent, ที่ความกว้าง
  360 / 768 / 1280
- ตรวจ contrast ของคู่สีที่ใช้เป็นข้อความจริงทุกคู่
