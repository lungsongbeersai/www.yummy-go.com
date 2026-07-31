# หน้า `/home` → หน้าแนะนำผลิตภัณฑ์ Yummy-go

วันที่: 2026-07-31
สถานะ: อนุมัติดีไซน์แล้ว รอทำ implementation plan

## ปัญหา

หน้า `/home` ปัจจุบันเป็น landing ของบริษัทซอฟต์แวร์ (เดิมชื่อ PLC Lao Developer) ที่มี
Yummy-go เป็นหนึ่งใน *ผลงาน* หลังเปลี่ยนชื่อบริษัทเป็น "Yummy-go" เนื้อหาจึงขัดกันเอง —
section Projects ลิสต์ `yummy-go` เป็นผลงานของ Yummy-go เอง, About บรรยายบริการรับจ้าง
พัฒนาซอฟต์แวร์, Technology ลิสต์ stack แบบ agency

เป้าหมาย: เปลี่ยนหน้านี้ให้เป็นหน้าแนะนำ **ผลิตภัณฑ์** Yummy-go (ระบบ POS ร้านอาหาร)
โดยเป้าหมายหลักคือให้ผู้เข้าชม **ขอทดลองใช้**

## ขอบเขต

**อยู่ในขอบเขต** — รื้อเนื้อหาและโครง section ของ `src/features/landing/`

**อยู่นอกขอบเขต / ไม่แตะ:**

| ไฟล์ | เหตุผล |
|---|---|
| `landing.module.css` (53KB) | สไตล์ทั้งหมดใช้ต่อได้ แก้เฉพาะที่ชื่อ class ตายไปกับ component ที่ลบ |
| `scene3d.ts`, `use-landing-scene.ts`, `use-landing-effects.ts` | ฉาก WebGL + เอฟเฟกต์ ไม่เกี่ยวกับเนื้อหา |
| `scene-*.ts`, `landing-particles.ts` + เทสต์ทั้งหมด | ตรรกะบริสุทธิ์ที่มีเทสต์คุมอยู่ |
| `landing-pricing.tsx` | ดึงแพ็กเกจสดจาก API อยู่แล้ว เป็นเนื้อหาโปรดักต์ตั้งแต่แรก |
| `landing-quality-switch.tsx`, `landing-lang-switch.tsx` | ตัวควบคุม ไม่ใช่เนื้อหา |

**ข้อจำกัดที่ยืนยันจากโค้ดแล้ว** — ระบบยังไม่มี flow สมัครร้านใหม่แบบ self-serve:

- ไม่มี route `/register` หรือ `/signup` ใน `src/app/`
- `/api/v1/register/create` (`src/services/user.ts:49`) เรียกผ่าน `apiRequest` ซึ่งต้อง auth
  และสร้าง *พนักงานในร้านที่มีอยู่แล้ว* (ต้องส่ง `branch_uuid_fk`, `roles_id_fk`)
- ไม่มี service ใดสร้าง store/tenant ใหม่แบบ public

การสมัครทดลองใช้เองต้องรอ backend ทำ endpoint ที่สร้าง store + branch + admin user +
ผูกแพ็กเกจทดลอง ในครั้งเดียว **spec นี้จึงส่งฟอร์มออกช่องทางติดต่อแทน** และออกแบบให้
เปลี่ยนปลายทางเป็น POST ได้ภายหลังโดยไม่ต้องแก้ UI

## โครง section

| # | เดิม | ใหม่ | anchor |
|---|---|---|---|
| 1 | Hero | Hero | `#top` |
| 2 | About | About | `#about` |
| 3 | Services (8 บริการ agency) | **Features** (10 ฟีเจอร์) | `#features` |
| 4 | Pricing | Pricing *(ไม่แตะ)* | `#pricing` |
| 5 | Projects (portfolio 2 รายการ) | **Showcase** | `#showcase` |
| 6 | Tutorials | Tutorials | `#tutorials` |
| 7 | Why choose us | Why | `#why` |
| 8 | Technology (stack agency) | **Platforms** | `#platforms` |
| 9 | Contact | **Trial + Contact** | `#trial` |
| 10 | Footer | Footer | — |

`#services` → `#features`, `#projects` → `#showcase`, `#technology` → `#platforms`,
`#contact` → `#trial` ต้องแก้ทุกจุดที่อ้างถึง (nav, ปุ่ม hero, ปุ่ม pricing, ลิงก์ footer)

## เนื้อหา

หลักการ: **ทุกฟีเจอร์ที่เขียนต้องมี route หรือโค้ดรองรับจริง** ห้ามเคลมเกิน

### `landingCompany`

```ts
export const landingCompany = {
  name: "Yummy-go",
  logo: "/brand/icon.png",
  tagline: {
    en: "The Restaurant POS That Runs Your Whole Shop",
    la: "ລະບົບ POS ຮ້ານອາຫານ ທີ່ຄຸມທັງຮ້ານໄດ້ໃນບ່ອນດຽວ"
  },
  description: {
    en: "Yummy-go handles orders, tables, QR self-ordering, receipts, stock, and reports — on web, Windows, and Android.",
    la: "Yummy-go ຄຸມອໍເດີ, ໂຕະ, ການສັ່ງເອງຜ່ານ QR, ການພິມບິນ, ສະຕັອກ ແລະ ລາຍງານ — ໃຊ້ໄດ້ທັງເວັບ, Windows ແລະ Android."
  },
  about: {
    en: "Yummy-go is a complete point-of-sale system for restaurants and cafés. Take orders at the counter or at the table, let customers order for themselves by scanning a QR code, print receipts to your kitchen and counter printers, track stock, and see today's sales the moment they happen. One account covers every branch.",
    la: "Yummy-go ເປັນລະບົບຂາຍໜ້າຮ້ານຄົບຊຸດ ສຳລັບຮ້ານອາຫານ ແລະ ຄາເຟ່. ຮັບອໍເດີໜ້າເຄົາເຕີ ຫຼື ທີ່ໂຕະ, ໃຫ້ລູກຄ້າສະແກນ QR ສັ່ງເອງ, ພິມບິນອອກເຄື່ອງພິມຄົວ ແລະ ເຄົາເຕີ, ຕິດຕາມສະຕັອກ ແລະ ເບິ່ງຍອດຂາຍມື້ນີ້ໄດ້ທັນທີ. ບັນຊີດຽວຄຸມໄດ້ທຸກສາຂາ."
  }
} as const;
```

**ลบ `foundedYear: 2002` ทิ้ง** — เป็นประวัติบริษัท ไม่ใช่ของผลิตภัณฑ์ ถ้าคงไว้จะกลายเป็น
เคลมเท็จว่า Yummy-go มีมา 24 ปี ต้องลบ field และทุกจุดที่ใช้ (`landing-hero.tsx:50`)

**ลบ `contactEmail`, `phone`, `address`** ออกจาก `landingCompany` → ย้ายไป `landingContact`

### `landingFeatures` (10 รายการ)

`icon` เป็นข้อความสั้นที่เรนเดอร์ตรงๆ (`landing-services.tsx:24`) ไม่ใช่ icon font

| id | icon | หลักฐานในโค้ด |
|---|---|---|
| `counter` | `pos` | `/pos/order` |
| `tables` | `tbl` | `/pos/tables` + Socket.IO `table_alert` (`src/lib/socket.ts`) |
| `qr` | `qr` | `/pos?t=`, `/q/[token]` + `public-pos` service/store |
| `menu` | `mnu` | `/products` + `/settings/{category,size,topping,unit,color,group}` |
| `reports` | `rpt` | `/report/*` (5 หน้า) |
| `stock` | `stk` | `/stock` + `nav.low_stock_alerts` |
| `print` | `prn` | `/printers` + `src/services/printer/` (agent + Android TCP) |
| `branches` | `brc` | `/settings/branch`, `/settings/user`, `src/services/permissions/` |
| `currency` | `cur` | `/settings/currency`, `/settings/exchange` |
| `cancel` | `cnl` | `/sales/cancel-sale`, `/sales/cancel-history` |

ข้อความ (en / la):

- **counter** — "Counter Checkout" / "ຄິດໄລ່ເງິນໜ້າເຄົາເຕີ"
  "Ring up orders and take payment at the counter in a few taps." /
  "ຮັບອໍເດີ ແລະ ຮັບຊຳລະໜ້າເຄົາເຕີ ດ້ວຍການແຕະບໍ່ເທົ່າໃດເທື່ອ."
- **tables** — "Table Plan & Live Alerts" / "ຜັງໂຕະ ແລະ ແຈ້ງເຕືອນສົດ"
  "See which tables are free or busy, and get alerted the moment one needs attention." /
  "ເບິ່ງໄດ້ວ່າໂຕະໃດວ່າງ ຫຼື ບໍ່ວ່າງ ແລະ ຖືກແຈ້ງເຕືອນທັນທີເມື່ອມີໂຕະຕ້ອງການບໍລິການ."
- **qr** — "QR Self-Ordering" / "ລູກຄ້າສະແກນ QR ສັ່ງເອງ"
  "Customers scan the QR code on their table and order straight from their phone." /
  "ລູກຄ້າສະແກນ QR ເທິງໂຕະ ແລ້ວສັ່ງຈາກມືຖືໄດ້ເລີຍ."
- **menu** — "Menu & Product Management" / "ຈັດການເມນູ ແລະ ສິນຄ້າ"
  "Categories, sizes, toppings, units, and groups — set up your menu the way your shop works." /
  "ໝວດໝູ່, ຂະໜາດ, ທ໋ອບປິ້ງ, ຫົວໜ່ວຍ ແລະ ກຸ່ມ — ຕັ້ງເມນູໃຫ້ຕົງກັບວິທີເຮັດວຽກຂອງຮ້ານ."
- **reports** — "Sales Reports" / "ລາຍງານຍອດຂາຍ"
  "Daily sales, daily closing, best sellers, sales by category, and payment methods." /
  "ຂາຍປະຈຳວັນ, ປິດຮ້ານປະຈຳວັນ, ສິນຄ້າຂາຍດີ, ຍອດຂາຍຕາມໝວດໝູ່ ແລະ ວິທີຊຳລະ."
- **stock** — "Stock & Low-Stock Alerts" / "ສະຕັອກ ແລະ ແຈ້ງເຕືອນສະຕັອກຕ່ຳ"
  "Track what you have left and get warned before an item runs out." /
  "ຕິດຕາມຈຳນວນທີ່ເຫຼືອ ແລະ ຖືກເຕືອນກ່ອນສິນຄ້າຈະໝົດ."
- **print** — "Receipt Printing" / "ພິມບິນ"
  "Print to counter and kitchen printers from the browser, desktop, or an Android device." /
  "ພິມອອກເຄື່ອງພິມເຄົາເຕີ ແລະ ຄົວ ຈາກເບຣົາເຊີ, ເດັສທັອບ ຫຼື ອຸປະກອນ Android."
- **branches** — "Multiple Branches & User Roles" / "ຫຼາຍສາຂາ ແລະ ສິດທິຜູ້ໃຊ້"
  "Run every branch from one account, and control what each staff member can see." /
  "ຄຸມທຸກສາຂາຈາກບັນຊີດຽວ ແລະ ກຳນົດໄດ້ວ່າພະນັກງານແຕ່ລະຄົນເຫັນຫຍັງໄດ້ແດ່."
- **currency** — "Multi-Currency & Exchange Rates" / "ຫຼາຍສະກຸນເງິນ ແລະ ອັດຕາແລກປ່ຽນ"
  "Accept more than one currency and set your own exchange rate." /
  "ຮັບໄດ້ຫຼາຍກວ່າໜຶ່ງສະກຸນເງິນ ແລະ ຕັ້ງອັດຕາແລກປ່ຽນເອງໄດ້."
- **cancel** — "Bill Cancellation & History" / "ຍົກເລີກບິນ ແລະ ປະຫວັດ"
  "Cancel a bill when you need to — every cancellation stays on record." /
  "ຍົກເລີກບິນໄດ້ເມື່ອຈຳເປັນ — ທຸກການຍົກເລີກຖືກບັນທຶກໄວ້."

### `landingHighlights` (การ์ดข้าง About, 5 รายการ)

| id | icon | en / la |
|---|---|---|
| `allinone` | `all` | "Everything in one system" / "ທຸກຢ່າງໃນລະບົບດຽວ" |
| `anydevice` | `dev` | "Works on any device" / "ໃຊ້ໄດ້ທຸກອຸປະກອນ" |
| `bilingual` | `lang` | "Lao and English" / "ພາສາລາວ ແລະ ອັງກິດ" |
| `livedata` | `live` | "Live sales data" / "ຂໍ້ມູນຍອດຂາຍສົດ" |
| `multibranch` | `brc` | "Built for multiple branches" / "ຮອງຮັບຫຼາຍສາຂາ" |

### `landingShowcase` (แทน `landingProjects`)

banner เดียวเต็มความกว้าง + จุดเด่น 4 ข้อ (มีรูปจริงแค่ `banner_project_yummy-go.webp`)

```ts
export const landingShowcase = {
  image: "/landing/banner_project_yummy-go.webp",
  alt: "Yummy Go restaurant POS and ordering system on laptop and mobile devices",
  points: [ /* 4 LocalizedText */ ]
} as const;
```

จุดเด่น 4 ข้อ (en / la):

1. "Order at the counter or at the table" / "ຮັບອໍເດີໜ້າເຄົາເຕີ ຫຼື ທີ່ໂຕະ"
2. "Customers order from their own phone" / "ລູກຄ້າສັ່ງຈາກມືຖືຕົນເອງ"
3. "Receipts print straight to the kitchen" / "ບິນພິມອອກຄົວໄດ້ທັນທີ"
4. "Today's sales, updated live" / "ຍອດຂາຍມື້ນີ້ ອັບເດດສົດ"

ปุ่มในการ์ด: "เข้าสู่ระบบ" (`loginHref`) + "ขอทดลองใช้" (`#trial`)
ลบ logic `isYummyGo` และ placeholder shimmer ทิ้ง — เหลือรูปเดียวจึงไม่ต้องแยกเคส

### `landingPlatforms` (แทน `landingTechnologies`)

เรนเดอร์เป็น pill (`landing-why-tech.tsx:38-48`) โครงสร้างเดิมมีแค่ `{ id, name }` —
เพิ่ม `label: LocalizedText` เพื่อให้แปลได้

| id | en / la | หลักฐาน |
|---|---|---|
| `web` | "Web browser" / "ເບຣົາເຊີເວັບ" | Next.js app |
| `windows` | "Windows desktop" / "Windows ເດັສທັອບ" | `electron/main.ts` + `electron:pack` (NSIS) |
| `android` | "Android" / "Android" | `capacitor.config.ts` + `android/` |
| `display` | "Customer display" / "ຈໍລູກຄ້າ" | `/customer-display` (หน้าต่างที่สองใน Electron) |

### `landingWhyChooseUs` (7 รายการ)

| id | icon | en / la |
|---|---|---|
| `fast` | `fst` | "Fast at the counter" / "ໄວໜ້າເຄົາເຕີ" |
| `offline` | `dsk` | "Runs as a desktop app" / "ໃຊ້ເປັນແອັບເດັສທັອບໄດ້" |
| `lao` | `lao` | "Built for Lao restaurants" / "ສ້າງມາເພື່ອຮ້ານອາຫານລາວ" |
| `easy` | `esy` | "Staff learn it quickly" / "ພະນັກງານຮຽນຮູ້ໄດ້ໄວ" |
| `qr` | `qr` | "QR ordering included" / "ມີການສັ່ງຜ່ານ QR ໃຫ້ພ້ອມ" |
| `report` | `rpt` | "Reports you actually use" / "ລາຍງານທີ່ໃຊ້ໄດ້ຈິງ" |
| `support` | `sla` | "Setup help and updates" / "ຊ່ວຍຕິດຕັ້ງ ແລະ ອັບເດດ" |

### `landingVideos` (คง placeholder)

คง 4 การ์ด `duration: "--:--"` เปลี่ยนเป็นหัวข้อของ Yummy-go ทั้งหมด
**ลบ field `projectId`** และลบแถบ filter ตาม project (`landing-tutorials.tsx:15-41`) —
เหลือผลิตภัณฑ์เดียวจึงไม่มีอะไรให้กรอง ใช้ `category` เป็นตัวจัดกลุ่มแทน

| id | category | en / la |
|---|---|---|
| `tv1` | Basics | "Setting up your shop" / "ຕັ້ງຄ່າຮ້ານຂອງທ່ານ" |
| `tv2` | Menu | "Building your menu" / "ສ້າງເມນູຂອງທ່ານ" |
| `tv3` | POS | "Taking orders and payment" / "ຮັບອໍເດີ ແລະ ຮັບຊຳລະ" |
| `tv4` | Reports | "Reading your sales reports" / "ອ່ານລາຍງານຍອດຂາຍ" |

### Hero stats

นับจาก array จริง ไม่ hardcode และไม่ใช้ `foundedYear` อีก

```ts
const stats = [
  { value: landingFeatures.length, label: text("statFeatures") },   // 10
  { value: landingPlatforms.length, label: text("statPlatforms") }, // 4
  { value: REPORT_COUNT, label: text("statReports") }               // 5
];
```

`REPORT_COUNT = 5` เป็นค่าคงที่พร้อมคอมเมนต์อ้าง `/report/*` (นับ route ตอน build ไม่ได้)

label: `statFeatures` "Features" / "ຟີເຈີ", `statPlatforms` "Platforms" / "ແພລດຟອມ",
`statReports` "Report types" / "ຊະນິດລາຍງານ"

ลบ `statYears`, `statSystems`, `statServices` ออกจาก `landingUi`

### `landingUi` — คีย์ที่เปลี่ยน

**เปลี่ยนชื่อคีย์** (ค่าใหม่ตามคอลัมน์ขวา):

| เดิม | ใหม่ | en / la |
|---|---|---|
| `servicesKicker` | `featuresKicker` | "Features" / "ຟີເຈີ" |
| `servicesTitle` | `featuresTitle` | "Everything your shop needs" / "ທຸກຢ່າງທີ່ຮ້ານຂອງທ່ານຕ້ອງການ" |
| `projectsKicker` | `showcaseKicker` | "See it working" / "ເບິ່ງການໃຊ້ງານຈິງ" |
| `projectsTitle` | `showcaseTitle` | "One system, counter to kitchen" / "ລະບົບດຽວ ຈາກເຄົາເຕີເຖິງຄົວ" |
| `techKicker` | `platformsKicker` | "Platforms" / "ແພລດຟອມ" |
| `techTitle` | `platformsTitle` | "Use it wherever you work" / "ໃຊ້ໄດ້ທຸກບ່ອນທີ່ທ່ານເຮັດວຽກ" |
| `contactKicker` | `trialKicker` | "Free trial" / "ທົດລອງໃຊ້ຟຣີ" |
| `contactTitle` | `trialTitle` | "Try Yummy-go at your shop" / "ລອງໃຊ້ Yummy-go ທີ່ຮ້ານຂອງທ່ານ" |
| `contactSubtitle` | `trialSubtitle` | "Tell us about your shop and we'll set you up." / "ບອກພວກເຮົາກ່ຽວກັບຮ້ານຂອງທ່ານ ແລ້ວພວກເຮົາຈະຕັ້ງໃຫ້." |
| `btnExplore` | `btnTrial` | "Get a Free Trial" / "ຂໍທົດລອງໃຊ້ຟຣີ" |
| `btnTutorials` | `btnFeatures` | "See Features" / "ເບິ່ງຟີເຈີ" |
| `btnViewProject` | `btnLoginNow` | "Sign In" / "ເຂົ້າສູ່ລະບົບ" |
| `btnRequestDemo` | `btnAskTrial` | "Ask for a trial" / "ຂໍທົດລອງໃຊ້" |
| `footerProjects` | `footerFeatures` | "Features" / "ຟີເຈີ" |
| `footerServices` | `footerPlatforms` | "Platforms" / "ແພລດຟອມ" |
| `footerContact` | `footerTrial` | "Free trial" / "ທົດລອງໃຊ້ຟຣີ" |

**เปลี่ยนค่า คีย์เดิม:**

| คีย์ | en / la ใหม่ |
|---|---|
| `navCta` | "Get a Free Trial" / "ຂໍທົດລອງໃຊ້ຟຣີ" |
| `heroBadge` | "Restaurant POS · Works on every device" / "ລະບົບ POS ຮ້ານອາຫານ · ໃຊ້ໄດ້ທຸກອຸປະກອນ" |
| `btnContact` | "Talk to us" / "ລົມກັບພວກເຮົາ" |
| `aboutKicker` | "About Yummy-go" / "ກ່ຽວກັບ Yummy-go" |
| `aboutTitle` | "Made for how restaurants actually run" / "ສ້າງມາໃຫ້ຕົງກັບວິທີດຳເນີນງານຂອງຮ້ານອາຫານຈິງ" |
| `whyTitle` | "Why shops choose Yummy-go" / "ເປັນຫຍັງຮ້ານຈຶ່ງເລືອກ Yummy-go" |
| `pricingHelp` | "Not sure which plan? Ask for a trial first." / "ຍັງບໍ່ແນ່ໃຈວ່າແພັກເກັດໃດ? ຂໍທົດລອງໃຊ້ກ່ອນໄດ້." |
| `pricingHelpCta` | "Ask for a trial" / "ຂໍທົດລອງໃຊ້" |
| `tutorialsSubtitle` | "Learn how to run your shop on Yummy-go, step by step." / "ຮຽນຮູ້ວິທີດຳເນີນຮ້ານດ້ວຍ Yummy-go ເທື່ອລະຂັ້ນຕອນ." |
| `footerDesc` | "A complete POS for restaurants — counter, tables, QR ordering, and reports." / "ລະບົບ POS ຄົບຊຸດສຳລັບຮ້ານອາຫານ — ເຄົາເຕີ, ໂຕະ, ສັ່ງຜ່ານ QR ແລະ ລາຍງານ." |
| `formSent` | "Thanks — we'll get back to you shortly." / "ຂອບໃຈ — ພວກເຮົາຈະຕິດຕໍ່ກັບໄປໄວໆນີ້." |

**คีย์ใหม่:** `statFeatures`, `statPlatforms`, `statReports` (ค่าตามหัวข้อ Hero stats),
`fieldShopName` "Shop name" / "ຊື່ຮ້ານ", `fieldContactName` "Your name" / "ຊື່ຜູ້ຕິດຕໍ່",
`fieldPhone` "Phone" / "ເບີໂທ", `fieldShopType` "Shop type" / "ປະເພດຮ້ານ",
`fieldBranchCount` "Number of branches" / "ຈຳນວນສາຂາ",
`btnRequestTrial` "Send request" / "ສົ່ງຄຳຂໍ",
`trialUnavailable` "Opening soon" / "ກຳລັງເປີດຮັບໄວໆນີ້",
`fieldRequired` "Required" / "ຕ້ອງໃສ່",
`shopTypeRestaurant` "Restaurant" / "ຮ້ານອາຫານ", `shopTypeCafe` "Café" / "ຄາເຟ່",
`shopTypeDrinks` "Drinks shop" / "ຮ້ານເຄື່ອງດື່ມ", `shopTypeOther` "Other" / "ອື່ນໆ",
`trialCardTitle` "Contact us directly" / "ຕິດຕໍ່ພວກເຮົາໂດຍກົງ"

**ลบ:** `btnWatchTutorial`, `filterAll`, `contactCardTitle`, `placeholderTba`,
`fieldName`, `fieldEmail`, `fieldMessage`, `btnSend`, `btnCustom`,
`statYears`, `statSystems`, `statServices`

### `landingNavigation`

| id | href | en / la |
|---|---|---|
| `about` | `#about` | "About" / "ກ່ຽວກັບ" |
| `features` | `#features` | "Features" / "ຟີເຈີ" |
| `pricing` | `#pricing` | "Pricing" / "ລາຄາ" |
| `showcase` | `#showcase` | "See it working" / "ເບິ່ງການໃຊ້ງານຈິງ" |
| `tutorials` | `#tutorials` | "Tutorials" / "ວິດີໂອສອນ" |
| `platforms` | `#platforms` | "Platforms" / "ແພລດຟອມ" |
| `trial` | `#trial` | "Free trial" / "ທົດລອງໃຊ້ຟຣີ" |

### Footer

3 คอลัมน์ลิงก์เปลี่ยนแหล่งข้อมูล — เดิมวนจาก `landingProjects` และ `landingServices`
(`landing-footer.tsx:38-50`) ซึ่ง `landingProjects` ถูกลบไปแล้ว:

- คอลัมน์ 1 `footerFeatures` → วน `landingFeatures.slice(0, 5)` ลิงก์ `#features`
- คอลัมน์ 2 `footerPlatforms` → วน `landingPlatforms` ลิงก์ `#platforms`
- คอลัมน์ 3 `footerTrial` → ลิงก์เดียวไป `#trial`

## ฟอร์มขอทดลองใช้

section `#trial` แทน `#contact` เดิม — ฟอร์มซ้าย การ์ดข้อมูลติดต่อขวา (คงเลย์เอาต์ `contactGrid`)

**ฟิลด์:** ชื่อร้าน\* · ชื่อผู้ติดต่อ\* · เบอร์โทร\* · ประเภทร้าน (select) · จำนวนสาขา (number, ค่าเริ่มต้น 1)

ประเภทร้าน: ร้านอาหาร / ร้านกาแฟ-คาเฟ่ / ร้านเครื่องดื่ม / อื่นๆ

**พฤติกรรมเมื่อกดส่ง:**

1. validate ฟิลด์ที่จำเป็น (ไม่ว่าง) — ถ้าไม่ผ่านแสดงข้อความใต้ฟิลด์
2. ประกอบข้อความสรุปเป็น plain text หลายบรรทัด
3. เปิดช่องทางแรกที่มีค่าใน config ตามลำดับ **`line` → `whatsapp` → `email`**
   - `line`: `https://line.me/R/oaMessage/{id}/?{encoded}`
   - `whatsapp`: `https://wa.me/{number}?text={encoded}`
   - `email`: `mailto:{email}?subject=...&body={encoded}`
   - เปิดด้วย `window.open(url, "_blank", "noopener")`
4. แสดงข้อความยืนยันใต้ฟอร์ม

**เมื่อ config ว่างทั้งหมด:** ปุ่มส่ง `disabled` + แสดงข้อความ `ກຳລັງເປີດຮັບໄວໆນີ້` /
"Opening soon" — ทำให้เห็นชัดว่าต้องกรอก config ก่อน deploy แทนที่จะเงียบหาย

### `landingContact` (config)

```ts
// ต้องกรอกอย่างน้อยหนึ่งช่องทาง (line / whatsapp / email) ก่อน deploy
// ไม่งั้นปุ่มขอทดลองใช้จะถูก disable
export const landingContact = {
  email: "",
  phone: "",
  line: "",      // LINE Official Account ID เช่น @yummygo
  whatsapp: "",  // เบอร์รูปแบบสากลไม่มีเครื่องหมาย เช่น 8562012345678
  facebook: "",  // URL เต็ม
  address: ""
} as const;
```

การ์ดข้อมูลติดต่อ **ซ่อน slot ที่ค่าว่างอัตโนมัติ** (ปัจจุบันแสดง "ຈະເພີ່ມພາຍຫຼັງ" 4 ช่อง
ทำให้ดูเหมือนเว็บยังไม่เสร็จ) ถ้าว่างหมด ซ่อนทั้งการ์ด เหลือแต่ฟอร์มเต็มความกว้าง

แถว social 4 กล่องเปล่า (`landing-contact.tsx:70-75`) แสดงเฉพาะเมื่อมี `facebook`

**เส้นทางอัปเกรดภายหลัง:** เมื่อ backend มี endpoint รับ lead หรือสร้างร้านทดลอง
เปลี่ยนเฉพาะ handler ตอน submit เป็นเรียก service ใหม่ — ฟิลด์ validation และ layout ใช้ต่อได้ทั้งหมด

## โครงไฟล์

`landing-data.ts` ปัจจุบัน 354 บรรทัด โดย `landingUi` กินไป ~95 บรรทัด แยกเป็นสองไฟล์
ตามเส้นแบ่ง "เนื้อหาสินค้า" กับ "ข้อความ UI":

```
src/features/landing/
  landing-data.ts   ← types, pickText, landingCompany, landingFeatures,
                       landingHighlights, landingShowcase, landingPlatforms,
                       landingWhyChooseUs, landingVideos, landingNavigation
  landing-ui.ts     ← landingUi, landingContact   (ใหม่)
```

ทิศทาง import เป็นทางเดียว: `landing-ui.ts` → `landing-data.ts` (ดึง type `LocalizedText`)
และ `landing-data.ts` ต้องไม่ import จาก `landing-ui.ts` component ที่ใช้ทั้งสองไฟล์ import แยกกัน

### เปลี่ยนชื่อไฟล์/สัญลักษณ์

| เดิม | ใหม่ |
|---|---|
| `sections/landing-services.tsx` · `LandingServices` | `sections/landing-features.tsx` · `LandingFeatures` |
| `sections/landing-projects.tsx` · `LandingProjects` | `sections/landing-showcase.tsx` · `LandingShowcase` |
| `LandingTechnology` (ใน `landing-why-tech.tsx`) | `LandingPlatforms` (ไฟล์เดิม) |
| `landingServices` | `landingFeatures` |
| `landingProjects` | `landingShowcase` (เปลี่ยนรูปทรงเป็น object) |
| `landingTechnologies` | `landingPlatforms` |
| `LandingProject`, `LandingService`, `LandingTech` (types) | `LandingFeature`, `LandingPlatform`, ลบ `LandingProject` |

`LandingShowcase` ยังรับ prop `loginHref` ต่อ เพราะมีปุ่มเข้าสู่ระบบในการ์ด

### CSS

ไม่แก้ `landing.module.css` class ที่ใช้อยู่ทั้งหมดใช้ต่อได้ (`serviceCard` → การ์ดฟีเจอร์,
`projectCard` → การ์ด showcase, `techPill` → pill แพลตฟอร์ม) — ชื่อ class ยังสื่อความหมายพอใช้
และการ rename class ทั่วไฟล์ 53KB มีความเสี่ยงสูงกว่าประโยชน์

ยกเว้น: ถ้ามี class ที่ตายไปกับ `shimmerWrap`/`projectShotLabel` (placeholder ของโปรเจกต์ที่ไม่มีรูป)
ให้ลบเฉพาะ block นั้น

## Metadata (`src/app/home/page.tsx`)

```ts
title: "Yummy-go — ລະບົບ POS ຮ້ານອາຫານ | Restaurant POS System"
description: "ລະບົບ POS ຮ້ານອາຫານຄົບຊຸດ — ອໍເດີ, ໂຕະ, ສັ່ງຜ່ານ QR, ພິມບິນ, ສະຕັອກ ແລະ ລາຍງານ. ໃຊ້ໄດ້ທັງເວັບ, Windows ແລະ Android."
icons: { icon: "/brand/icon.png" }
```

## การทดสอบ

โปรเจกต์นี้เทสต์เฉพาะตรรกะบริสุทธิ์ ไม่เทสต์ component (ตาม `CLAUDE.md`)
งานนี้เกือบทั้งหมดเป็นข้อมูลกับ JSX จึงมีของที่ควรมีเทสต์อยู่จุดเดียว:

**`landing-contact.test.ts`** — ตรรกะเลือกช่องทางและประกอบลิงก์ แยกเป็นฟังก์ชันบริสุทธิ์:

```ts
export function buildTrialLink(contact: LandingContact, message: string): string | null
```

เคสที่ต้องคุม:
- มี `line` อย่างเดียว → คืนลิงก์ LINE
- มีทั้ง `line` และ `whatsapp` → เลือก `line` (ลำดับความสำคัญ)
- มีแต่ `email` → คืน `mailto:`
- ว่างทั้งหมด → คืน `null` (ปุ่มถูก disable)
- ข้อความถูก encode ถูกต้อง (เว้นวรรค ขึ้นบรรทัดใหม่ อักษรลาว)

**ตรวจด้วยตัวเอง:** `npm run typecheck`, `npm run lint`, `npm test`
สองภาษา (ลาว/อังกฤษ) และดูว่าไม่มี anchor ตายหลังเปลี่ยนชื่อ

## สิ่งที่ต้องทำก่อน deploy

1. กรอก `landingContact` อย่างน้อยหนึ่งช่องทาง — ไม่งั้นปุ่มขอทดลองใช้ถูก disable
2. ลบไฟล์ `public/landing/plc-logo.png` (616KB) และ `plc-logo-96.webp` เมื่อยืนยันว่าไม่มีอะไรอ้างถึงแล้ว
3. `src/icon.png` ซ้ำกับ `public/brand/icon.png` แบบ byte-identical — ลบตัวใดตัวหนึ่งได้

## สิ่งที่ยังไม่ทำในรอบนี้

- endpoint สมัครร้านทดลองใช้จริง (ฝั่ง backend)
- วิดีโอสอนของจริง (การ์ดยังเป็น placeholder)
- ภาพหน้าจอรายฟีเจอร์ (ใช้ banner เดียว)
