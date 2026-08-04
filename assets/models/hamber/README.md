# โมเดลเบอร์เกอร์ของ hero หน้า /pos

ไฟล์ในโฟลเดอร์นี้คือ **ต้นฉบับ** สร้างจาก Hyper3D Rodin (prompt: "A cheeseburger with
layered fillings") อยู่นอก `public/` โดยตั้งใจ เพราะทุกอย่างใน `public/` จะถูก rsync
ขึ้น VPS และเสิร์ฟออกเน็ตจริง — ต้นฉบับรวมกัน ~29 MB ไม่ควรขึ้นไปด้วย

ตัวที่ deploy จริงคือ `public/models/burger-hero.glb` (~375 KB) เท่านั้น

| ไฟล์ | ขนาด | หมายเหตุ |
|---|---|---|
| `base_basic_pbr.glb` | 17.12 MB | PBR 3 เท็กซ์เจอร์ ไม่ได้ใช้ |
| `base_basic_shaded.glb` | 11.19 MB | ต้นทางของตัวที่ใช้จริง — แสงอบมากับเท็กซ์เจอร์แล้ว |
| `shaded-1024.webp` | 152 KB | เท็กซ์เจอร์ที่ย่อแล้ว ใช้ในขั้นตอนที่ 1 |

## ทำไมถึงใช้ `shaded` ไม่ใช่ `pbr`

วัสดุของ `shaded` คือ `baseColorFactor: [0,0,0,1]` + `emissiveTexture` แปลว่า
**unlit ล้วน** แสงเงาถูกอบลงเท็กซ์เจอร์มาแล้ว ผลคือ:

- ไม่ต้องมีไฟในฉากเลย ฝั่ง runtime แทนวัสดุด้วย `MeshBasicMaterial` ตรง ๆ
- `NORMAL` กับ `TANGENT` ไม่ถูกใช้งานจริง ตัดทิ้งได้ (ประหยัด 3.7 MB)
- แต่สีจะคงที่ ไม่เปลี่ยนตาม accent (emerald / gold / rose) ที่เลือกใน Tweaks
  ซึ่งตกลงกันแล้วว่ายอมรับได้

## ขั้นตอนย่อขนาด

จุดสำคัญคือ **ต้องตัด `NORMAL`/`TANGENT` ก่อน** ไม่งั้น simplifier จะตันอยู่ราว
46k สามเหลี่ยมไม่ว่าจะตั้ง ratio ต่ำแค่ไหน เพราะจุดยอดถูกแยก (split vertices)
ตามรอยต่อ UV/normal จนยุบขอบไม่ได้ — ต้นฉบับมี 136,095 จุดยอดต่อ 120,000 สามเหลี่ยม

ขั้นตอนที่ 1 ต้องทำผ่านสคริปต์เพราะ `gltf-transform optimize --texture-compress webp`
พังบนเครื่อง Windows นี้ (libvips: `value "32" ... invalid for property 'space'`)
ทั้งที่ sharp เดี่ยว ๆ แปลงไฟล์เดียวกันได้ปกติ จึงเลี่ยงไปแปลงเท็กซ์เจอร์เองแล้วยัดกลับ

**1. ย่อเท็กซ์เจอร์** (sharp) — 2048px PNG 3.59 MB → 1024px WebP 152 KB

```js
sharp("shaded.png").resize(1024, 1024).webp({ quality: 82 }).toFile("shaded-1024.webp");
```

**2. ตัด attribute ที่ไม่ได้ใช้ + สลับเท็กซ์เจอร์** (`@gltf-transform/core`)

```js
for (const mesh of doc.getRoot().listMeshes())
  for (const prim of mesh.listPrimitives()) {
    prim.setAttribute("NORMAL", null);
    prim.setAttribute("TANGENT", null);
  }
for (const tex of doc.getRoot().listTextures())
  tex.setImage(webpBytes).setMimeType("image/webp");
doc.createExtension(EXTTextureWebP).setRequired(true);
```

**3. ย่อรูปทรง + บีบอัด** (`@gltf-transform/cli`)

```bash
npx @gltf-transform/cli optimize burger-prepped.glb public/models/burger-hero.glb \
  --compress meshopt --simplify true --simplify-ratio 0.20 --simplify-error 0.01 \
  --texture-compress false
```

## ผลลัพธ์

| | ต้นฉบับ | หลังย่อ |
|---|---|---|
| ขนาดไฟล์ | 11.19 MB | **375 KB** |
| สามเหลี่ยม | 120,000 | 23,994 |
| จุดยอด | 136,095 | 26,135 |
| เท็กซ์เจอร์ | PNG 2048 · 3.59 MB | WebP 1024 · 148 KB |

`--simplify-ratio` เลือก 0.20 ไว้เผื่อขอบผักกาดที่เป็นหยัก ถ้าอยากเล็กกว่านี้
0.10 ให้ 12,000 สามเหลี่ยม ~284 KB ซึ่งยังพอใช้ได้ที่ขนาดจริงบนจอ (~340px)
