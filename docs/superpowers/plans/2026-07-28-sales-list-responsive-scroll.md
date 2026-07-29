# Sales List Responsive Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้ผู้ใช้เลื่อนรายการบิลจากบริเวณตัวรายการได้บน tablet/mobile โดยคง internal list scrolling และ pagination ที่ผูกกับแผงรายการบน desktop

**Architecture:** ใช้ scroll container ตาม breakpoint: page container เป็น vertical scroller เพียงตัวเดียวเมื่อหน้าจอต่ำกว่า `xl`; list container รับ `overflow-y-auto` และ `overscroll-contain` เฉพาะ `xl` ขึ้นไปซึ่ง split panel มีความสูงจำกัด การเปลี่ยนแปลงอยู่ที่ presentation class ของรายการบิลเพียงจุดเดียวและไม่แตะ pagination/data flow

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui-style local components

## Global Constraints

- Pagination ต้องอยู่ใน footer ของแผงรายการบิล ไม่ย้ายไปใต้ทั้ง list และ detail panel
- Tablet/mobile ต้องใช้ page container เป็น vertical scroller เพียงตัวเดียว
- Desktop (`xl` ขึ้นไป) ต้องคง fixed-height split panel และ internal list scrolling
- ไม่เปลี่ยน `AppPagination`, pagination logic, API, Zustand store, URL state, dependency หรือ locale key
- คง touch target, keyboard focus, light mode และ dark mode เดิม
- Tests ใน repository ครอบคลุม pure logic เท่านั้น; regression test ของ CSS layout ใช้ browser reproduction/verification และไม่เพิ่ม component test

## File Structure

- Modify: `src/features/sales/sales-list/sales-bill-list.tsx` — กำหนด overflow behavior ของ list container ตาม breakpoint
- Reference only: `src/features/sales/sales-list/sales-list-page.tsx` — page scroller เดิมที่รับผิดชอบ tablet/mobile
- Reference only: `src/components/common/app-pagination.tsx` — pagination เดิมที่ต้องไม่เปลี่ยน

---

### Task 1: จำกัด Internal List Scrolling ไว้ที่ Desktop

**Files:**
- Modify: `src/features/sales/sales-list/sales-bill-list.tsx:64`
- Test: browser regression ที่ `/sales/sales-list`

**Interfaces:**
- Consumes: page scroller class `h-full min-h-0 overflow-y-auto xl:overflow-hidden` จาก `SalesListPage`
- Produces: list container ที่ใช้ page scrolling ต่ำกว่า `xl` และ internal scrolling ตั้งแต่ `xl` ขึ้นไป

- [ ] **Step 1: บันทึก failing browser reproduction ก่อนแก้**

เปิด `/sales/sales-list` ด้วยข้อมูลอย่างน้อย 20 บิล ที่ viewport `1024×768` แล้วตรวจใน DevTools Console:

```js
const outer = document.querySelector("main#app-main-content > div");
const list = document.querySelector(
  "button.touch-manipulation[aria-pressed]",
)?.parentElement;

console.table({
  outerClientHeight: outer?.clientHeight,
  outerScrollHeight: outer?.scrollHeight,
  outerScrollTop: outer?.scrollTop,
  listClientHeight: list?.clientHeight,
  listScrollHeight: list?.scrollHeight,
  listScrollTop: list?.scrollTop,
  listOverflowY: list ? getComputedStyle(list).overflowY : null,
  listOverscrollY: list ? getComputedStyle(list).overscrollBehaviorY : null,
});
```

Expected before fix:

- `outerScrollHeight > outerClientHeight`
- `listScrollHeight === listClientHeight`
- `listOverflowY === "auto"`
- `listOverscrollY === "contain"`
- ปัดบนรายการแล้ว `outerScrollTop` และ `listScrollTop` ไม่เปลี่ยน

- [ ] **Step 2: ทำ minimal responsive class change**

เปลี่ยน list container ใน `SalesBillListPanel` จาก:

```tsx
<div className="flex min-h-0 flex-1 flex-col divide-y divide-border overflow-y-auto overscroll-contain">
```

เป็น:

```tsx
<div className="flex min-h-0 flex-1 flex-col divide-y divide-border xl:overflow-y-auto xl:overscroll-contain">
```

ห้ามเปลี่ยน wrapper ของ pagination หรือ `AppPagination`

- [ ] **Step 3: ตรวจ TypeScript**

Run:

```powershell
npm run typecheck
```

Expected: exit code `0`

- [ ] **Step 4: ตรวจ ESLint**

Run:

```powershell
npm run lint
```

Expected: exit code `0`

- [ ] **Step 5: ยืนยัน browser regression บน tablet และ mobile**

ตรวจที่ `1024×768` และ `390×844` ด้วย Console snippet จาก Step 1

Expected after fix:

- `outerScrollHeight > outerClientHeight`
- `listScrollHeight === listClientHeight`
- `listOverflowY === "visible"`
- `listOverscrollY === "auto"`
- ปัดบนตัวรายการแล้ว `outerScrollTop` เพิ่มขึ้น
- เลื่อนได้จนเห็น pagination ซึ่งกว้างเต็ม card/content
- ไม่มี horizontal overflow

- [ ] **Step 6: ยืนยัน desktop split-panel behavior**

ตรวจที่ viewport อย่างน้อย `1280×800`

Expected:

- `listScrollHeight > listClientHeight`
- `listOverflowY === "auto"`
- `listOverscrollY === "contain"`
- ปัดบนตัวรายการแล้ว `listScrollTop` เพิ่มขึ้น
- pagination ยังอยู่ด้านล่างและกว้างเท่าแผงรายการด้านซ้าย
- detail panel และ pagination behavior ไม่เปลี่ยน

- [ ] **Step 7: Commit implementation**

```powershell
git add -- 'src/features/sales/sales-list/sales-bill-list.tsx'
git commit -m "fix(sales): restore responsive invoice scrolling"
```
