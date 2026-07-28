# Feature 27 Production Hardening Design

**Status:** อนุมัติแนวทางแล้วเมื่อ 2026-07-28; รอ review เอกสารก่อนเขียน implementation plan

## เป้าหมาย

ทำให้โค้ดทั้งหมดบน `feature-27` พร้อมรวมเข้า `feature` โดยแก้ Product Import ที่เสี่ยงสร้างข้อมูลผิด, ปิด permission/routing gaps ที่พบระหว่าง audit และกัน local artifacts/secrets ไม่ให้ถูก `ship-feature` commit

## Non-goals

- ไม่ทำ mobile-native shell, bottom navigation หรือ Capacitor behavior; งานเหล่านี้เริ่มที่ `feature-28`
- ไม่สร้าง backend bulk-import endpoint หรือ transaction ข้าม API
- ไม่ redesign Dashboard, Product list หรือ Import modal เป็น wizard
- ไม่เพิ่ม dependency, UI kit หรือ state manager

## แนวทาง

ใช้ focused hardening บน architecture เดิม:

```text
Excel → parse/normalize → preflight → user review
  → create missing references → rebuild validated payloads
  → save products → per-row result → refresh stores
```

Pure parsing/preflight logic อยู่ใน feature utilities; side effects อยู่ใน Product Zustand store และ services ตาม layered data flow เดิม. Import modal ยังคงเป็น single-page review แต่แสดง `พร้อม`, `จะสร้าง`, `ขัดแย้ง` และผลลัพธ์หลังนำเข้าให้ตรงกับ state จริง

## Product Import Contract

### 1. Row boundaries และ normalization

- ใช้ key normalization ชุดเดียวทุกชั้น: collapse whitespace, `NFKC`, trim และ lowercase
- แถวที่มีค่าโดยตรงใน Product Code หรือ Product/Set Name เริ่ม product boundary ใหม่
- แถวที่ทั้ง code และ name ว่างเท่านั้นจึงเป็น detail continuation
- continuation สืบทอดเฉพาะ product-level fields: code, name, category, unit และ Set Price
- ห้ามสืบทอด Size/Option, Cost Price หรือ Normal Sale Price จาก detail ก่อนหน้า
- Product Code ที่ว่างถูกสร้างครั้งเดียวระหว่าง preflight และคงค่าเดิมตลอด preview/retry

### 2. Preflight

ก่อนเปิดปุ่ม Import ต้องโหลด products และ references ทั้งหมดของ store/branch แล้วจำแนกแต่ละ draft:

- `ready`: ใช้ references ที่มีอยู่และไม่มี duplicate/conflict
- `will-create`: valid แต่ต้องสร้าง Group, Category, Unit หรือ Size
- `conflict`: validation, duplicate หรือ reference ambiguity
- `succeeded` / `failed`: execution result หลังเริ่ม import

ตรวจ duplicate แบบ normalized ทั้งภายใน workbook และกับฐานข้อมูล:

- Product Code ซ้ำเป็น conflict
- ชื่อ Lao หรือ English ซ้ำเป็น conflict
- code ที่ generate ต้องข้าม code ที่มีอยู่และ code ที่จองไว้ใน workbook

สร้าง reference plan จาก drafts ที่ valid เท่านั้น; แถว invalid/conflict ห้ามสร้าง master data

### 3. Default Group และ reference matching

- Default Group ต้อง resolve ได้เป็นกลุ่มเดียว: exact unique match = reuse, no match = candidate create, multiple matches = conflict
- สร้าง Group เฉพาะเมื่อมี valid Category ที่ขาดและต้องใช้กลุ่มนั้น
- Category ชื่อเดียวกันใน Default Group = reuse
- **Category ชื่อเดียวกันที่อยู่ Group อื่น = conflict เฉพาะสินค้าที่ใช้ Category นั้น**; ห้าม reuse ข้าม Group และห้ามสร้างชื่อซ้ำ
- Unit และ Size ใช้ store-wide exact unique match; duplicate names ที่ resolve ไม่ได้เป็นหนึ่ง UUID = conflict
- Normal Size (`status_sort_fk=1`) และ Set Option (`status_sort_fk=2`) เป็นคนละ namespace
- ชื่อ English ที่ว่างใช้ค่าเดียวกับ Lao ตอนสร้าง reference

### 4. Execution และ retry

- สร้าง references ตาม dependency: Group ก่อน Category; Unit/Normal Size/Set Size สร้างจาก preflight plan
- หลังสร้าง reference ต้อง rebuild payload และ assert ว่า Category, Unit และ Size UUID ไม่ว่างก่อนเรียก Product API
- บันทึกสินค้าแบบ sequential เพื่อลด API burst และเก็บผลต่อรายการ
- รายการ `succeeded` ถูกถอดจาก retry set ทันทีและส่งซ้ำไม่ได้
- รายการ `failed` เก็บ execution error แยกจาก validation errors และ retry ได้เฉพาะรายการนั้น
- ผลผสมใช้ warning/partial-success copy; success tone ใช้เมื่อสำเร็จทั้งหมดเท่านั้น
- หลังมีการสร้าง reference หรือ product ให้ refresh Groups, Categories, Units, Sizes และ Products

ข้อจำกัดที่ยอมรับ: backend ไม่มี transaction ข้ามหลาย endpoint จึงอาจเหลือ reference ที่สร้างสำเร็จก่อน product failure; retry ต้อง idempotent และ reuse reference เดิม

## Production Blockers นอก Product Import

### Permission navigation

- `normalizeSidebarPermissionMenuResponse()` ต้องเลือก role ตรงเท่านั้น; ไม่ fallback ไป `roles[0]`
- AppShell ใช้ permission items หรือ same-key cache เท่านั้น; ห้าม fallback static menu หลัง login
- initial load ที่ไม่มี cache แสดง loading state; empty/error แสดง localized unavailable + Retry
- menu visibility ไม่ใช่ authorization boundary; backend ยังคงบังคับสิทธิ์ API

### Routing และ breadcrumb

- `internalRoute()` รับเฉพาะ internal path ที่ขึ้นต้นด้วย `/` ตัวเดียวและไม่มี backslash/control characters
- legacy route canonicalization เดิมคงไว้
- breadcrumb ปิดลิงก์เฉพาะ group paths ที่ไม่มี page จริง เช่น `/sale` และ `/report`
- `/settings` ยังเป็นลิงก์ได้เพราะมี index route จริง

### Branch cleanup

- ลบ `.superpowers/` ซึ่งมี session token/URL key และเพิ่ม `.superpowers/` ใน `.gitignore`
- ลบ local Tailwind docs snapshot, revert `docs-source.txt` และ ignore เฉพาะ generated `docs/` กับ `docs-index.tsx`
- ไม่ commit conversation output directory ใต้ `outputs/<session-id>/`
- revert Recharts version bump ที่ไม่มี requirement; คง chart size guard หาก verification ผ่านกับเวอร์ชันเดิม
- ลบ unintegrated fixed `Dashboard/Tables/POS/Reports/More` shell model/test ที่ขัดกับแผนใหม่; คง generic page-refresh foundation
- ทำเครื่องหมาย responsive shell design เก่าว่า superseded และปรับแผนใหม่ไม่ให้อ้าง foundation ที่ถูกลบ

## Error Handling

- Parse/preflight errors แสดงต่อแถวโดยไม่เรียก mutation API
- Reference creation failure หยุด execution ก่อนสร้าง product และคง preflight state สำหรับ Retry
- Product failure ไม่ยกเลิกผลสำเร็จของแถวก่อนหน้า แต่ห้ามส่งแถวสำเร็จซ้ำ
- Permission failure ไม่เปิดเมนูที่ไม่ได้รับสิทธิ์
- ห้าม log token, workbook content หรือ API payload ที่มีข้อมูลผู้ใช้

## Testing Strategy

ใช้ TDD สำหรับ behavior ใหม่:

- boundary/inheritance ของ Normal และ Set rows
- NFKC-equivalent matching
- duplicate code/name ใน workbook และ database
- Category same-name cross-group conflict
- reference plan ตัด invalid drafts และไม่สร้าง Group โดยไม่จำเป็น
- successful rows ไม่ถูก retry; failed rows retry ได้
- exact-role permission และ no-static-fallback states
- backslash/control-character route rejection
- `/settings` breadcrumb ยัง clickable

Verification ก่อน ship:

1. focused Vitest ระหว่างแต่ละ red/green cycle
2. `npm test`
3. `npm run typecheck`
4. `npm run lint`
5. `npm run build`
6. `npm run electron:build`
7. `npm run smoke:ssr`
8. ตรวจ `git diff --check` และ `git status --short` ว่าไม่มี secret/local artifact

## Acceptance Criteria

- Workbook ที่มี row boundary ผิด, duplicate หรือ cross-group Category ไม่สร้างข้อมูลส่วนนั้น
- Preview ตรงกับ reference/product mutations ที่จะเกิดจริง
- Partial import retry เฉพาะ failed rows และไม่สร้าง successful product ซ้ำ
- Product/reference dropdowns เห็นข้อมูลใหม่โดยไม่ reload browser
- ผู้ใช้ไม่เห็น static menu เมื่อ permission response ไม่ตรง role หรือโหลดล้มเหลวโดยไม่มี same-key cache
- internal route input ไม่สามารถเปลี่ยนเป็น external origin
- production build, Electron TypeScript build, SSR smoke, tests, typecheck และ lint ผ่าน
- final commit ไม่มี `.superpowers`, local Tailwind snapshot, session output หรือ secrets
- หลัง `ship-feature` สำเร็จ: `feature-27` ถูกรวมและลบ และ branch ปัจจุบันคือ `feature-28`
