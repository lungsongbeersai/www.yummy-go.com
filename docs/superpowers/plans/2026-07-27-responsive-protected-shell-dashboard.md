# Mobile Protected Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Approved scope for `feature-28`; permission/routing hardening was completed on `feature-27`

**Goal:** ทำให้ protected layout บนจอเล็กเป็น mobile app ที่ใช้งานคล่อง มี navigation ตามสิทธิ์, feedback ทันทีเมื่อเปลี่ยนหน้า และทำงานถูกต้องกับ safe area, keyboard และ Android back โดยไม่ redesign Dashboard หรือเปลี่ยน desktop โดยไม่จำเป็น

**Architecture:** คง data flow `protected layout → AuthGuard → AppShell → feature` และใช้ permission-filtered menu tree ชุดเดียวกับ desktop. Desktop (`md+`) คง header/sidebar เดิม; mobile (`<md`) ใช้ top app bar, permission-aware bottom navigation และ `More` drawer. Route transition ใช้ state ชุดเดียวใน protected shell และ Capacitor ใช้ system-bar/back contract กลางหนึ่งจุด

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Zustand, local shadcn/ui primitives, i18next และ Capacitor 8

## ข้อสรุปต่อแผนเดิม

❌ แผนเดิมไม่ควรถูกนำไปทำต่อทั้งชุด เพราะยาว 1,035 บรรทัดและรวม Dashboard redesign, design-token overhaul, filter Drawer และการ refactor component ที่ไม่เกี่ยวกับเป้าหมาย navigation โดยตรง. Fixed-slot `shell-navigation.ts` ที่เคยสร้างไว้ไม่ตรงกับ permission-aware design และถูกถอดก่อนเปิด `feature-28`; คงเฉพาะ page-refresh registry ที่ใช้ร่วมได้

ปัญหาที่พบจากโค้ดปัจจุบันและต้องแก้ในขอบเขตนี้:

- Mobile header แสดง hamburger, back, title, theme, notification, language และ profile ในแถวเดียว และแสดง back แม้หน้า root
- Mobile sidebar ยังเป็น desktop menu ที่เปิดใน left Sheet
- `AppShell` ซ่อน shared header/sidebar ทั้งหมดบน protected POS และมี `<main>` ซ้อนกันสองชั้น
- ต้องสร้าง navigation model ขนาดเล็กจาก permission tree จริงบน `feature-28`; ห้ามคืน fixed `Dashboard/Tables/POS/Reports/More` model เดิม
- permission menu มี fail-open paths: API menu ว่าง/error แล้ว fallback ไป static menu, role ไม่ตรงแล้ว fallback ไป `roles[0]`, และ empty group อาจกลายเป็นลิงก์
- Protected routes จำนวนมาก render แบบ dynamic; ไม่มี pending feedback ระหว่างกดลิงก์กับ route commit และไม่มี middleware/proxy ที่อธิบาย delay
- Android target SDK 36 แต่ safe area/system bars มีหลาย owner และ legacy `StatusBar` options บางตัวไม่มีผลแล้ว
- ยังไม่มี Android hardware-back integration และ repo ไม่มี native `ios/` project

## Keep / Remove / Simplify

| การตัดสินใจ | รายการ |
| --- | --- |
| **Keep** | page-refresh registry ที่มีอยู่, permission API/cache, desktop header/sidebar, existing feature skeletons, typed routes, i18n และ local shadcn primitives |
| **Remove จากแผน** | Dashboard visual redesign, Quiet Service Ledger tokens, Dashboard filter/refresh reconciliation, Reports Sheet แยกอีกชุด, fixed `Dashboard/Tables/POS/Reports/More` model เดิม, blanket UI refactor และ test/commit steps ที่ละเอียดเกินงาน |
| **Simplify** | เพิ่ม mobile navigation component เดียว, `More` drawer เดียว, navigation-pending pattern เดียว, safe-area owner เดียว และ targeted pure tests/device checks เท่านั้น |

## Mobile navigation ที่แนะนำ

### Top app bar

- ซ้าย: back เฉพาะ non-root route ที่มี parent/history ที่มีความหมาย
- กลาง/พื้นที่หลัก: localized page title แบบ truncate ได้
- ขวา: refresh เฉพาะหน้าที่ register callback; ระหว่าง refresh ใช้ spinner ในปุ่มเดิม
- Theme, language, notification, profile และ logout ย้ายเข้า `More` บน mobile เพื่อลดความแน่นของ header
- Desktop header คง composition เดิม

### Bottom navigation

แสดง `More` และ primary destinations สูงสุดสี่รายการ โดยเลือกเฉพาะ leaf/group ที่มีสิทธิ์จาก runtime permission tree ตามลำดับความถี่นี้:

1. Dashboard — `/`
2. ขายหน้าร้าน — `/pos/tables`; ถือว่า active ต่อเนื่องบน `/pos/order`
3. รายการขาย — `/sales/sales-list`
4. สินค้า — `/products`
5. Stock — `/stock` เป็น fallback เมื่อรายการก่อนหน้าไม่มีสิทธิ์
6. Reports — ใช้ report child แรกที่ได้รับสิทธิ์เป็น fallback สุดท้าย และ active บน `/report/*`

หลักการคือ “สูงสุดสี่” ไม่ใช่บังคับให้ครบสี่: ห้ามแสดง disabled placeholder และห้ามเลื่อน route ที่ไม่มีสิทธิ์ขึ้นมาเติมช่อง. ลำดับนี้ทำให้ Sales Staff ได้ทางเข้าหน้าร้านเร็ว ขณะที่ Accounting/Warehouse สามารถได้ Reports/Stock เมื่อ operational routes ถูก permission tree ตัดออก โดยไม่ hard-code entitlement ตาม role

ไม่ใช้ `Tables` และ `POS` เป็นสอง tab เพราะทั้งคู่ลง `/pos/tables` เมื่อไม่มี current table และกินหนึ่งช่องสำหรับ workflow เดียวกัน. `/pos/order` เป็น focused child flow: แสดง contextual back ไป Tables และซ่อน bottom bar เพื่อลดการออกจากบิลโดยไม่ตั้งใจ

### More

- ใช้ bottom `Drawer` เดียว สูงไม่เกิน visible viewport และรองรับ swipe/Escape/back
- แสดง permission-filtered tree ที่เหลือแบบ grouped list โดยตัด primary destinations ออก
- `More` เป็น active section เมื่ออยู่บน secondary route
- ส่วนท้ายรวม account/preferences actions; ไม่สร้าง mobile sidebar หรือ Reports drawer ซ้ำ

### Back และ transition

- Root destination ที่แสดงใน bottom bar ไม่มี back
- Focused route ใช้ deterministic parent เช่น `/pos/order → /pos/tables`, `/products/form → /products`, `/printers/form → /printers`
- Secondary route ใช้ internal history ถ้ามี; direct deep link fallback ไป authorized primary ตัวแรก
- Android back ปิด Drawer/Dialog ก่อน, จากนั้นใช้กฎเดียวกับ header back; เมื่ออยู่ root จึง minimize app
- Header/bottom bar คงอยู่ระหว่าง navigation; หน้าปัจจุบันคง interactive จน destination commit แล้วใช้ mobile-only enter transition สั้น ๆ พร้อมเคารพ `prefers-reduced-motion`

### Loading feedback pattern เดียว

ใช้ thin progress line ใต้ app header เป็น route-transition indicator เพียงแบบเดียว:

- pressed/focus state เปลี่ยนภายในหนึ่ง frame
- progress ปรากฏเมื่อ transition เกินประมาณ 120ms เพื่อลด flash
- same-target tap ถูก ignore ขณะ pending; different target เปลี่ยน intent ได้
- คงหน้าปัจจุบันไว้และไม่ใช้ blocking overlay หรือเพิ่ม protected-route skeleton อีกชั้น
- offline ถูกตรวจทันที; timeout ประมาณ 10 วินาทีคืน control และแสดง localized Retry
- route/render failure ใช้ protected error boundary; feature API loading หลัง route commit ใช้ skeleton/error ของ feature เดิมและไม่ทำให้ route progress ค้าง
- คง `<Link>` default prefetch ก่อน และเพิ่ม targeted prefetch เฉพาะเมื่อ production trace พิสูจน์ว่าจำเป็น

แนวทางนี้ตรงกับ Next.js ที่ระบุว่า dynamic navigation อาจรอ server response และให้ใช้ pending feedback/prefetch อย่างเจาะจง: [Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating), [useLinkStatus](https://nextjs.org/docs/app/api-reference/functions/use-link-status)

## Global Constraints

- ห้าม redesign Dashboard หรือ management pages ในงานนี้
- ห้ามเพิ่ม UI kit, state manager หรือ navigation/loading dependency
- Runtime menu ต้อง fail closed; cache ใช้ได้เฉพาะ store/role/language key เดิม
- Menu visibility ไม่ใช่ security boundary; backend authorization ยังคงเป็นตัวบังคับสิทธิ์จริง
- Route files ใต้ `src/app/` ต้องบาง และ runtime paths ต้องผ่าน `internalRoute()`
- Mobile shell targets อย่างน้อย 44px; Capacitor Android อย่างน้อย 48px
- ใช้ Lao/English labels, light/dark mode, focus-visible และ reduced motion
- Public `/pos`, `/q/[token]`, `/login`, `/home`, `/customer-display` และ Electron customer display อยู่นอกขอบเขต
- เก็บ existing dirty-worktree changes และห้าม overwrite งานที่ไม่เกี่ยวข้อง

---

### Task 1: วัด navigation ก่อนแก้

**Files:** ไม่มี source change

- [ ] ใช้ fresh production build หรือ production deployment วัด cold/warm cache, Slow 3G และ offline แยกเวลา `tap → RSC request → route commit → feature API`
- [ ] ตรวจ primary link, More item, breadcrumb, POS table → order และ query-only pagination ว่าความช้ามาจาก `?_rsc`, JS chunk, legacy redirect หรือ backend API
- [ ] ยืนยันว่า `AuthGuard`/`AppShell` ไม่ remount และไม่มี middleware/proxy latency
- [ ] บันทึก baseline ใน task/PR notes; ห้ามเริ่ม refactor auth/data layer หาก trace ไม่ชี้ไปที่ส่วนนั้น

### Task 2: สร้าง permission-aware mobile navigation model

**Files:** สร้าง `src/components/layout/mobile-navigation-model.ts` และ focused test; อ่าน menu จาก `src/stores/permissions-sidebar-store.ts`

- [ ] ใช้ permission menu ที่ harden แล้วบน `feature-27`; ตัด empty groups และนับเฉพาะ navigable leaves
- [ ] หา report group จาก canonical `/report/*` ไม่ผูกกับ opaque `menu_id`
- [ ] เปลี่ยน destination model เป็น primary candidates สูงสุดสี่รายการ + remaining `More`, active section, root/focused mode และ deterministic back fallback

### Task 3: เชื่อม foundation ที่มีอยู่เข้ากับ AppShell

**Files:** `src/components/layout/app-shell.tsx`, `src/components/layout/mobile-navigation-model.ts`, `src/components/layout/page-refresh-context.tsx`, `src/components/ui/sidebar.tsx`

- [ ] ให้ `AppShell` ใช้ permission-aware model ใหม่โดยไม่สร้างสำเนา helper อีกชุด
- [ ] ครอบ protected content ด้วย existing `PageRefreshProvider`
- [ ] ทำให้มี `<main>` เพียงหนึ่งตัวโดยไม่เปลี่ยน desktop geometry
- [ ] คง desktop header/sidebar/collapse/POS immersive behavior; ปิด mobile sidebar trigger เพราะ `More` รับหน้าที่แทน

### Task 4: สร้าง mobile header, bottom navigation และ More drawer

**Files:** สร้าง `src/components/layout/mobile-shell-navigation.tsx`; แก้ `src/components/layout/app-shell.tsx`, `src/app/globals.css`, `public/locales/la/common.json`, `public/locales/en/common.json`

- [ ] สร้าง top app bar, conditional back/title/refresh และ bottom navigation ตาม model ใน Task 2
- [ ] สร้าง `More` drawer จาก menu tree ชุดเดียวกับ desktop โดยตัด primary items และรวม account/preferences actions
- [ ] รองรับ 320–767px, portrait/landscape, long Lao labels, light/dark, focus trap, keyboard navigation และ touch targets
- [ ] เพิ่ม content offsets เฉพาะเมื่อ bottom bar แสดง; focused route ไม่เหลือช่องว่างด้านล่าง

### Task 5: เพิ่ม route-transition feedback แบบเดียว

**Files:** สร้าง `src/components/layout/route-navigation-feedback.tsx`; แก้ `src/components/layout/app-shell.tsx`, `src/components/common/back-button.tsx`, `src/stores/toast-store.ts`, `src/app/(protected)/error.tsx`, `src/app/globals.css`

- [ ] ใช้ shared protected-navigation state สำหรับ shell links และ programmatic route buttons ที่อยู่ในขอบเขต
- [ ] เพิ่ม immediate pressed state, delayed progress line, same-target dedupe, last-intent-wins และ clear state เมื่อ pathname/search params commit
- [ ] เพิ่ม offline/timeout/failure message พร้อม Retry โดยไม่บังทั้งแอป
- [ ] รักษา default prefetch; แก้ redirect หรือเพิ่ม targeted prefetch เฉพาะ bottleneck ที่ Task 1 พิสูจน์

### Task 6: เชื่อม contextual refresh และ focused flows

**Files:** `src/features/dashboard/overview/dashboard-page.tsx`, `src/features/pos/table-selection/table-selection-page.tsx`, `src/features/pos/order-customer/order-customer-view.tsx`, `src/features/sales/sales-list/*`, `src/features/product/list/*`, `src/components/layout/page-refresh-context.tsx`

- [ ] Register callback ที่มีอยู่แล้วเฉพาะ frequent mobile screens; หน้าที่ไม่มี callback ไม่แสดง refresh
- [ ] ซ่อน mobile-local refresh/back controls ที่ซ้ำกับ app bar แต่คง desktop controls เดิม
- [ ] ให้ `/pos/order` ใช้ mobile app bar, back ไป Tables, ไม่มี bottom bar และไม่ให้ cart/payment CTA ถูก shell บัง
- [ ] ระหว่าง refresh คงข้อมูลเดิมและใช้ spinner ใน refresh action; ห้ามใช้ `router.refresh()` แทน feature store action

### Task 7: ทำ Capacitor mobile contract ให้มี owner เดียว

**Files:** `capacitor.config.ts`, `package.json`, `package-lock.json`, `src/app/providers.tsx`, `src/app/globals.css`, สร้าง `src/hooks/use-capacitor-back-navigation.ts`, `android/app/src/main/java/com/yummygo/app/MainActivity.java`, `android/app/src/main/AndroidManifest.xml`, `android/app/src/main/res/values/styles.xml`; อาจสร้าง minimal `capacitor-web/` fallback assets

- [ ] ใช้ Capacitor 8 `SystemBars` และ canonical `--safe-area-inset-{top,right,bottom,left}` variables; ลบ native padding, UA/pointer heuristic และ legacy `StatusBar` ownership ที่ซ้ำ
- [ ] Sync system-bar icon contrast กับ app theme; ตั้ง iOS `contentInset: "never"` และลบ invalid `iosScheme: "https"`
- [ ] เพิ่ม official `@capacitor/app` เพื่อใช้ hardware-back hierarchy; sync Android native project
- [ ] ใช้ `adjustResize` + `visualViewport` เป็น keyboard policy แรก: ซ่อน bottom bar เมื่อ IME เปิดและคง focused field/action ให้เห็น; เพิ่ม `@capacitor/keyboard` เฉพาะเมื่อ device test พิสูจน์ว่าจำเป็น
- [ ] ทำ `webDir/errorPath` ให้ clean `cap sync android` ใช้งานได้และแสดง local connection failure โดยไม่อ้างว่าแอปทำงาน offline

อ้างอิง: [Capacitor SystemBars](https://capacitorjs.com/docs/apis/system-bars), [Capacitor App/backButton](https://capacitorjs.com/docs/apis/app), [Capacitor config](https://capacitorjs.com/docs/config)

### Task 8: ตรวจรับแบบ targeted

**Automated:** `npm test`, `npm run typecheck`, `npm run lint`, focused permission/navigation/back tests, `npx cap sync android` และ Android debug build

- [ ] ทดสอบ permission roles 1–6, empty/error/cache states, primary selection, More filtering, active/root/focused routes และ deterministic back
- [ ] ทดสอบ repeated taps, changed intent, current-route no-op, cold/warm prefetch, offline, timeout, render failure และ feature API failure
- [ ] ตรวจ light/dark, reduced motion, keyboard-only, screen reader labels, no horizontal scroll และหนึ่ง `<main>`
- [ ] ทำ manual matrix ตาม acceptance criteria ด้านล่าง

## Main files expected to change

- Shell/model: `src/components/layout/app-shell.tsx`, `mobile-navigation-model.ts`, `mobile-shell-navigation.tsx`, `route-navigation-feedback.tsx`, `page-refresh-context.tsx`
- Permission: `src/services/permissions/sidebar.ts`, `src/stores/permissions-sidebar-store.ts` และ focused tests
- Shared UI: `src/components/common/back-button.tsx`, `src/components/ui/sidebar.tsx`, `src/stores/toast-store.ts`, `src/app/globals.css`
- Frequent flows: Dashboard, table selection, POS order, sales list และ product list files ที่ register existing refresh/navigation actions
- Native: `capacitor.config.ts`, package files, `src/app/providers.tsx`, Capacitor back hook, Android `MainActivity`, manifest และ theme
- Localization: `public/locales/la/common.json`, `public/locales/en/common.json`

## Acceptance criteria

### Desktop (`md+`)

- Header/sidebar/collapse/breadcrumb/POS immersive layout มีหน้าตาและพฤติกรรมเดิม ยกเว้น permission fail-closed และ route feedback ที่ใช้ร่วมกัน
- Permission API, same-key cache, active state และ disabled state ตรงกันระหว่าง rail กับ mobile model
- มี `<main>` หนึ่งตัว, keyboard/focus/dark mode ไม่ถดถอย และ navigation failure ไม่ทำให้ shell หาย

### Mobile browser

- ที่ 320, 375, 393, 430 และ 767px ไม่มี horizontal scroll; header/title/controls และ bottom bar ไม่ทับ content
- Root ไม่มี back; secondary/detail มี meaningful back; More แสดงเฉพาะ authorized secondary items และคืน focus เมื่อปิด
- Touch targets ≥44px, Lao/English ไม่ตัดจนแปลความผิด, light/dark/reduced-motion ผ่าน
- Tap มี pressed stateทันที; slow navigation แสดง progress pattern เดียว, same-target ไม่ยิงซ้ำ, offline/timeout มี Retry และหน้าเดิมยังใช้งานได้
- เมื่อ keyboard เปิด focused control ยังเห็นและ bottom bar ไม่ลอยเหนือ keyboard

### Android Capacitor

- `cap sync android` และ debug build ผ่านจาก clean checkout
- Android 14/15/16, gesture/three-button navigation, portrait/landscape/cutout และ phone/tablet มี inset เพียงครั้งเดียว
- System-bar contrast เปลี่ยนตาม light/dark; shell targets ≥48px
- Hardware back ปิด overlay ก่อน, `/pos/order` กลับ Tables, child route ใช้ parent/history และ root จึง minimize โดยไม่ double navigation
- IME ไม่บัง input/submit, ปิดแล้ว viewport คืนค่า, POS custom keypad ไม่เปิด system keyboard โดยไม่ตั้งใจ
- Cold/warm start และ slow/offline remote load ไม่มี blank white screen หรือ UI jump ที่ทำให้ใช้งานไม่ได้

### iOS Capacitor

- Web code/config ต้องรองรับ `env(safe-area-inset-*)`, notch/home indicator, keyboard และ UI back โดยไม่ double inset
- เมื่อมี native target ต้องทดสอบ iPhone จอเล็ก, notch/home indicator และ iPad ทั้งสอง orientation; ไม่มี hardware-back criterion บน iOS
- `contentInset` กับ CSS safe area ไม่ซ้ำ, status-bar contrast อ่านได้, Drawer/keyboard คืน viewport ถูกต้อง และ reduced motion ปิด transition
- **ข้อจำกัด:** repo ยังไม่มี `ios/`; จึงยัง claim ว่า iOS ผ่านไม่ได้จนกว่าจะเพิ่ม target และทำ `cap sync ios`/Xcode/device test บน macOS

## Risks and decisions requiring approval

1. **Primary navigation:** อนุมัติ adaptive “สูงสุด 4 + More” และตัด fixed POS tab/Reports drawer หรือไม่
2. **Focused POS:** อนุมัติให้ `/pos/order` ซ่อน bottom bar และกลับ Tables ก่อนออกจาก workflow หรือไม่
3. **Permission failure:** แนะนำ fail closed; fresh/offline session ที่ไม่มี same-key cache จะเห็น “โหลดเมนูไม่ได้ + Retry” แทน static menu
4. **Native dependencies:** เพิ่มเฉพาะ `@capacitor/app`; ยังไม่เพิ่ม `@capacitor/keyboard` จนกว่า `adjustResize`/`visualViewport` จะ fail บนอุปกรณ์จริง
5. **System bars:** อนุมัติให้ Capacitor 8 `SystemBars` เป็น owner เดียวและถอด legacy/manual Android ownership ที่ขัดกัน
6. **Remote WebView:** คง `server.url = https://yummy-go.com`; งานนี้ให้ offline feedback/local error page แต่ไม่ทำ offline-capable POS
7. **iOS:** เลือกว่าจะเพิ่ม `ios/` เป็น phase แยกบน macOS หรือรับรองเฉพาะ cross-platform web/config ใน phase นี้

หยุดหลังอนุมัติแผนนี้; ห้ามเริ่ม implementation ก่อนผู้ใช้ยืนยัน decisions ข้างต้น
