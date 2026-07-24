# รวม Pagination ให้เป็นดีไซน์เดียวทั้งโปรเจกต์

วันที่อนุมัติแนวทาง: 2026-07-24

## 1. บทสรุป

โปรเจกต์มี pagination อยู่ 3 รูปแบบที่ไม่ตรงกัน และมี bug จริง 1 จุดที่ทำให้ label ช่วงข้อมูล ("แสดง 1-2 / 2") หลุดหายจาก footer ของหน้า settings ทั้งหมด งานนี้จะรวมเป็น component เดียวคือ `AppPagination` (ขยายให้รับ `rangeLabel`) ใช้ทุกหน้าที่มี pagination ในโปรเจกต์ ลบ `ReportPagination` และ label ช่วงข้อมูลที่ลอยซ้ำอยู่คนละที่ออก

งานนี้เข้าเงื่อนไขข้อยกเว้นที่ระบุไว้ใน [`2026-07-19-nextjs-16-project-refactor-design.md`](2026-07-19-nextjs-16-project-refactor-design.md) หัวข้อ "สิ่งที่ไม่ทำ": ปกติไม่ทำ visual redesign คู่กับ structural refactor เว้นแต่ยืนยันแล้วว่าเป็น design-system inconsistency จริง — กรณีนี้ยืนยันแล้วด้วยหลักฐานโค้ด (ดูหัวข้อ 2)

## 2. หลักฐาน (ตรวจเมื่อ 2026-07-24)

**Bug:** `SettingsPaginationFooter` ([settings-shell.tsx:493-518](../../../src/features/settings/shared/settings-shell.tsx#L493-L518)) ประกาศรับ `pageStart`, `pageEnd`, `total`, `canGoBack`, `canGoNext`, `onBack`, `onNext` ใน type แต่ function ไม่ destructure ออกมาใช้เลย ทุกหน้า settings ที่เรียก component นี้ส่ง props เหล่านี้เข้ามาแล้วโดนทิ้งเงียบๆ

**3 รูปแบบที่ใช้อยู่จริง:**

1. **Settings pages** (user, table, store-branch, customer, exchange, category, location, option-settings-page ที่เป็น generic template) — label ช่วงข้อมูลอยู่ที่ header บนสุดของหน้า ต่อ string รวมกับ "หน้า A จาก B" เป็นข้อความเดียว (เช่น [user-list.tsx:73](../../../src/features/settings/user/user-list.tsx#L73)) ส่วนปุ่มเลื่อนหน้าจริงอยู่ footer ล่างสุดแบบไม่มี label กำกับ (เพราะ bug ข้างต้น) — ข้อมูลหน้าปัจจุบันถูกพูดซ้ำ 2 จุดคนละตำแหน่งของหน้าจอ
2. **Product page** ([product-page.tsx:210-217](../../../src/features/product/list/product-page.tsx#L210-L217)) — label โชว์เฉพาะ mobile และแทรกอยู่กลางตาราง ไม่อยู่ในแถบ pagination
3. **Report pages** ([report-pagination.tsx](../../../src/features/report/shared/report-pagination.tsx)) — label กับปุ่มอยู่แถวเดียวกันแล้ว (ถูกต้องตามโครงสร้างที่ต้องการ) แต่ปุ่มเป็นสไตล์กะทัดรัด: กล่องตัวเลข "หน้า / ทั้งหมด" เดียว ไม่มี dropdown เลือกหน้าและไม่มีปุ่มเลขหน้าแบบ settings/product

**ดีไซน์เป้าหมาย (จากภาพที่ผู้ใช้ส่งมา)** = โครงสร้างแถวเดียวแบบ report pages (label ซ้าย + ปุ่มขวา) **รวมกับ** สไตล์ปุ่มแบบ settings/product (dropdown เลือกหน้า + "จาก N" + ปุ่ม first/prev/เลขหน้า/next/last) — ปัจจุบันไม่มีหน้าไหนตรงแบบนี้ทั้งหมด `AppPagination` มีปุ่มขวาที่ตรงกับภาพอยู่แล้ว ขาดแค่ label ฝั่งซ้าย

## 3. เป้าหมาย

1. มี pagination component เดียว (`AppPagination`) ที่ทุกหน้าที่มี pagination ในโปรเจกต์เรียกใช้ ไม่มี component คู่ขนาน
2. label ช่วงข้อมูลกับปุ่มเลื่อนหน้าอยู่แถวเดียวกันเสมอ ไม่มีการพูดซ้ำคนละตำแหน่งของหน้าจอ
3. แก้ bug `SettingsPaginationFooter` ที่ทิ้ง props เงียบๆ
4. พฤติกรรม pagination เดิม (จำนวนหน้า, การ jump หน้า, disabled state ตอนโหลด) ต้องเหมือนเดิมทุกหน้า — เปลี่ยนแค่ตำแหน่ง/รูปแบบการแสดงผล ไม่เปลี่ยน logic การคำนวณหน้า
5. รองรับ light/dark mode และ touch target ตาม convention เดิมของ `AppPagination` (ปุ่ม 44px บน mobile)

## 4. สิ่งที่ไม่ทำ

- ไม่เปลี่ยน logic คำนวณ `pageStart`/`pageEnd`/`totalPages` ที่มีอยู่แล้วในแต่ละ hook/workflow (`use-product-list-workflow.ts`, `use-standard-report-workflow.ts`, `optionPageRange`, ฯลฯ) — งานนี้แค่เปลี่ยนจุดที่ "แสดงผล" ไม่แตะการคำนวณ
- ไม่แตะ `printer-page.tsx` ในรอบแรกถ้าพบว่าแก้ไฟล์เดียวกับที่อีก session กำลังทำงานอยู่พร้อมกัน (P4.2 ของแผน dedup) — ถ้าชนกันจริงให้ทำเป็น batch แยกทีหลัง
- ไม่เปลี่ยน locale keys ที่มีอยู่แล้ว (`common.showingRange`, `common.page`, `common.pageLabel`, `common.of` ฯลฯ) ใช้ของเดิมที่มีอยู่
- ไม่ทำ pagination แบบ "Load more" หรือ infinite scroll — คงรูปแบบ page-based เดิม

## 5. แนวทางที่เลือก

### 5.1 ขยาย `AppPagination` ให้รับ `rangeLabel` (แนะนำ) ✅

เพิ่ม prop `rangeLabel?: string` ใน `AppPaginationProps` วางไว้ฝั่งซ้ายสุดของแถว ก่อน dropdown เลือกหน้า ใช้เทคนิค wrap เดียวกับที่ `ReportPagination` ใช้อยู่แล้ว (`flex-wrap` + `max-sm:basis-full` ให้ label ตกลงบรรทัดใหม่เองบนจอแคบแทนการบีบ) จากนั้น:

- ลบ `report-pagination.tsx` ทิ้ง เปลี่ยน 4 หน้า report ให้เรียก `AppPagination` แทน (prop mapping ตรงๆ: `page`, `totalPages`, `rangeLabel`, `onPageChange` — `canGoBack`/`canGoNext`/`onBack`/`onNext` ไม่ต้องส่งอีกเพราะ `AppPagination` คำนวณเองอยู่แล้วภายใน)
- แก้ `SettingsPaginationFooter` ให้รับ `rangeLabel` ที่ประกอบมาจาก `common.showingRange` แล้วส่งต่อให้ `AppPagination` ตรงๆ ลบ props ที่ไม่ได้ใช้จริงออกจาก type signature
- ลบข้อความ label ช่วงข้อมูลที่ลอยอยู่ใน header/mobile row ของแต่ละหน้า settings และ product-page ออก (ย้ายไปโผล่ที่ footer เดียวแทน)
- `stock-page.tsx`, `sales-list-page.tsx`/`sales-bill-list.tsx`, `cancel-sale-page.tsx`/`cancel-sale-controls.tsx`, `cancel-history-page.tsx` ปรับ prop ให้ส่ง `rangeLabel` เข้า `AppPagination` แทนที่จะ render label แยกเอง

**ข้อดี:** component เดียวจริง ไม่มีของคู่ขนาน, งานส่วนใหญ่เป็น mechanical prop-wiring ความเสี่ยง regression ต่ำ, ใช้ของที่มีอยู่แล้ว 90% ไม่ต้องออกแบบ UI ใหม่

**Trade-off:** ต้องแก้ไฟล์เยอะ (~20 ไฟล์) แต่ทุกไฟล์เป็น pattern เดียวกันซ้ำๆ ทำเป็น batch คู่ขนานได้

### 5.2 ทางเลือกที่ไม่ใช้

- **คงสอง component ไว้แต่ทำหน้าตาให้เหมือนกัน:** ยังมี logic ปุ่มซ้ำกัน 2 ที่ ผิด convention "reuse before creating" ของ `CLAUDE.md` และแก้ bug ในอนาคตต้องแก้ 2 จุด
- **สร้าง component ใหม่ทั้งหมดแทนทั้งสองตัวเดิม:** เสียเวลาออกแบบ UI ใหม่ทั้งที่ `AppPagination` มีโครงที่ตรงกับภาพเป้าหมายอยู่แล้วเกือบทั้งหมด ความเสี่ยง regression สูงกว่าโดยไม่ได้อะไรเพิ่ม

## 6. ขอบเขตไฟล์ที่แตะ

| กลุ่ม | ไฟล์ |
|---|---|
| Shared component | `src/components/common/app-pagination.tsx`, `src/features/settings/shared/settings-shell.tsx` |
| Settings (8 หน้า) | `user-list.tsx`/`user-page.tsx`, `table-list.tsx`/`table-page.tsx`, `store-branch-list.tsx`/`store-branch-settings-page.tsx`, `customer-page.tsx`, `exchange-page.tsx`, `category-list.tsx`/`category-page.tsx`, `location-list.tsx`/`location-settings-page.tsx`, `option-settings-page.tsx` (generic template ครอบคลุม currency ฯลฯ) |
| Product / Stock | `product-page.tsx`, `stock-page.tsx` |
| Sales | `sales-list-page.tsx`, `sales-bill-list.tsx`, `cancel-sale-page.tsx`, `cancel-sale-controls.tsx`, `cancel-history-page.tsx` |
| Report (4 หน้า + component) | `daily-sales-report-page.tsx`, `best-selling-products-report-page.tsx`, `payment-methods-report-page.tsx`, `category-sales-report-page.tsx`, ลบ `report-pagination.tsx` |
| Printer | `printer-page.tsx` — ทำหลังสุด เช็ค conflict กับ session อื่นก่อน |

## 7. การทดสอบ

- `npm run typecheck`, `npm run lint`, `npm test` ต้องผ่านหลังทุก batch
- ตรวจด้วยตาบนเบราว์เซอร์ (dev server ที่รันอยู่บน `localhost:3000` ของ checkout หลัก): settings 1 หน้า, product, report 1 หน้า ทั้ง light/dark mode และ mobile width — ยืนยันว่า label ไม่ซ้ำ ปุ่มกดได้ และ wrap ไม่แตกบนจอแคบ
- ไม่มี unit test ใหม่ที่ต้องเพิ่ม เพราะเป็นการเปลี่ยน presentation ล้วนๆ ไม่เปลี่ยน pure logic ที่ test ครอบคลุมอยู่ (`url-pagination.test.ts` ฯลฯ ไม่กระทบ)
