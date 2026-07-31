// ============================================================
// Yummy-go — เนื้อหาหน้าแนะนำผลิตภัณฑ์ (landing page)
// เป็น single source of truth ของหน้านี้ ภายหลังสามารถย้ายไป
// ดึงจาก API/CMS ได้โดย UI ไม่ต้องแก้ (อ่านจากโครงสร้างนี้เท่านั้น)
//
// ทุกฟีเจอร์ที่เขียนไว้ต้องมี route หรือโค้ดรองรับจริง — ห้ามเคลมเกิน
// ข้อความ UI (ปุ่ม/หัวข้อ/ป้ายกำกับ) อยู่ที่ landing-ui.ts
// ============================================================

import type { Language } from "@/lib/language";

export interface LocalizedText {
  la: string;
  en: string;
}

export interface LandingNavItem {
  id: string;
  href: string;
  label: LocalizedText;
}

export interface LandingHighlight {
  id: string;
  icon: string;
  title: LocalizedText;
}

export interface LandingFeature {
  id: string;
  icon: string;
  title: LocalizedText;
  description: LocalizedText;
}

export interface LandingShowcase {
  image: string;
  alt: string;
}

export interface LandingVideo {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  duration: string;
  category: string;
}

export interface LandingPlatform {
  id: string;
  label: LocalizedText;
}

export function pickText(text: LocalizedText, language: Language): string {
  return text[language];
}

export const landingCompany = {
  name: "Yummy-go",
  // ไอคอนแบรนด์ตัวเดียวกับ root layout / login / app-shell เพื่อให้เอกลักษณ์ตรงกันทั้งแอป
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

export const landingNavigation: LandingNavItem[] = [
  { id: "about", href: "#about", label: { en: "About", la: "ກ່ຽວກັບ" } },
  { id: "features", href: "#features", label: { en: "Features", la: "ຟີເຈີ" } },
  { id: "pricing", href: "#pricing", label: { en: "Pricing", la: "ລາຄາ" } },
  { id: "showcase", href: "#showcase", label: { en: "See it working", la: "ເບິ່ງການໃຊ້ງານຈິງ" } },
  { id: "tutorials", href: "#tutorials", label: { en: "Tutorials", la: "ວິດີໂອສອນ" } },
  { id: "platforms", href: "#platforms", label: { en: "Platforms", la: "ແພລດຟອມ" } },
  { id: "trial", href: "#trial", label: { en: "Free trial", la: "ທົດລອງໃຊ້ຟຣີ" } }
];

// รวมจุดขายไว้ที่เดียว — 3 ข้อท้ายย้ายมาจาก section "Why choose us" ที่ถูกยุบ
// เพราะอีก 4 ข้อของ section นั้นซ้ำกับ landingFeatures และ landingPlatforms
export const landingHighlights: LandingHighlight[] = [
  { id: "allinone", icon: "all", title: { en: "Everything in one system", la: "ທຸກຢ່າງໃນລະບົບດຽວ" } },
  { id: "anydevice", icon: "dev", title: { en: "Works on any device", la: "ໃຊ້ໄດ້ທຸກອຸປະກອນ" } },
  { id: "bilingual", icon: "lang", title: { en: "Lao and English", la: "ພາສາລາວ ແລະ ອັງກິດ" } },
  { id: "livedata", icon: "live", title: { en: "Live sales data", la: "ຂໍ້ມູນຍອດຂາຍສົດ" } },
  { id: "multibranch", icon: "brc", title: { en: "Built for multiple branches", la: "ຮອງຮັບຫຼາຍສາຂາ" } },
  { id: "lao", icon: "lao", title: { en: "Built for Lao restaurants", la: "ສ້າງມາເພື່ອຮ້ານອາຫານລາວ" } },
  { id: "easy", icon: "esy", title: { en: "Staff learn it quickly", la: "ພະນັກງານຮຽນຮູ້ໄດ້ໄວ" } },
  { id: "support", icon: "sla", title: { en: "Setup help and updates", la: "ຊ່ວຍຕິດຕັ້ງ ແລະ ອັບເດດ" } }
];

// icon เป็นข้อความสั้นที่เรนเดอร์ตรง ๆ ไม่ใช่ icon font
export const landingFeatures: LandingFeature[] = [
  {
    id: "counter",
    icon: "pos",
    title: { en: "Counter Checkout", la: "ຄິດໄລ່ເງິນໜ້າເຄົາເຕີ" },
    description: {
      en: "Ring up orders and take payment at the counter in a few taps.",
      la: "ຮັບອໍເດີ ແລະ ຮັບຊຳລະໜ້າເຄົາເຕີ ດ້ວຍການແຕະບໍ່ເທົ່າໃດເທື່ອ."
    }
  },
  {
    id: "tables",
    icon: "tbl",
    title: { en: "Table Plan & Live Alerts", la: "ຜັງໂຕະ ແລະ ແຈ້ງເຕືອນສົດ" },
    description: {
      en: "See which tables are free or busy, and get alerted the moment one needs attention.",
      la: "ເບິ່ງໄດ້ວ່າໂຕະໃດວ່າງ ຫຼື ບໍ່ວ່າງ ແລະ ຖືກແຈ້ງເຕືອນທັນທີເມື່ອມີໂຕະຕ້ອງການບໍລິການ."
    }
  },
  {
    id: "qr",
    icon: "qr",
    title: { en: "QR Self-Ordering", la: "ລູກຄ້າສະແກນ QR ສັ່ງເອງ" },
    description: {
      en: "Customers scan the QR code on their table and order straight from their phone.",
      la: "ລູກຄ້າສະແກນ QR ເທິງໂຕະ ແລ້ວສັ່ງຈາກມືຖືໄດ້ເລີຍ."
    }
  },
  {
    id: "menu",
    icon: "mnu",
    title: { en: "Menu & Product Management", la: "ຈັດການເມນູ ແລະ ສິນຄ້າ" },
    description: {
      en: "Categories, sizes, toppings, units, and groups — set up your menu the way your shop works.",
      la: "ໝວດໝູ່, ຂະໜາດ, ທ໋ອບປິ້ງ, ຫົວໜ່ວຍ ແລະ ກຸ່ມ — ຕັ້ງເມນູໃຫ້ຕົງກັບວິທີເຮັດວຽກຂອງຮ້ານ."
    }
  },
  {
    id: "reports",
    icon: "rpt",
    title: { en: "Sales Reports", la: "ລາຍງານຍອດຂາຍ" },
    description: {
      en: "Daily sales, daily closing, best sellers, sales by category, and payment methods.",
      la: "ຂາຍປະຈຳວັນ, ປິດຮ້ານປະຈຳວັນ, ສິນຄ້າຂາຍດີ, ຍອດຂາຍຕາມໝວດໝູ່ ແລະ ວິທີຊຳລະ."
    }
  },
  {
    id: "stock",
    icon: "stk",
    title: { en: "Stock & Low-Stock Alerts", la: "ສະຕັອກ ແລະ ແຈ້ງເຕືອນສະຕັອກຕ່ຳ" },
    description: {
      en: "Track what you have left and get warned before an item runs out.",
      la: "ຕິດຕາມຈຳນວນທີ່ເຫຼືອ ແລະ ຖືກເຕືອນກ່ອນສິນຄ້າຈະໝົດ."
    }
  },
  {
    id: "print",
    icon: "prn",
    title: { en: "Receipt Printing", la: "ພິມບິນ" },
    description: {
      en: "Print to counter and kitchen printers from the browser, desktop, or an Android device.",
      la: "ພິມອອກເຄື່ອງພິມເຄົາເຕີ ແລະ ຄົວ ຈາກເບຣົາເຊີ, ເດັສທັອບ ຫຼື ອຸປະກອນ Android."
    }
  },
  {
    id: "branches",
    icon: "brc",
    title: { en: "Multiple Branches & User Roles", la: "ຫຼາຍສາຂາ ແລະ ສິດທິຜູ້ໃຊ້" },
    description: {
      en: "Run every branch from one account, and control what each staff member can see.",
      la: "ຄຸມທຸກສາຂາຈາກບັນຊີດຽວ ແລະ ກຳນົດໄດ້ວ່າພະນັກງານແຕ່ລະຄົນເຫັນຫຍັງໄດ້ແດ່."
    }
  },
  {
    id: "currency",
    icon: "cur",
    title: { en: "Multi-Currency & Exchange Rates", la: "ຫຼາຍສະກຸນເງິນ ແລະ ອັດຕາແລກປ່ຽນ" },
    description: {
      en: "Accept more than one currency and set your own exchange rate.",
      la: "ຮັບໄດ້ຫຼາຍກວ່າໜຶ່ງສະກຸນເງິນ ແລະ ຕັ້ງອັດຕາແລກປ່ຽນເອງໄດ້."
    }
  },
  {
    id: "cancel",
    icon: "cnl",
    title: { en: "Bill Cancellation & History", la: "ຍົກເລີກບິນ ແລະ ປະຫວັດ" },
    description: {
      en: "Cancel a bill when you need to — every cancellation stays on record.",
      la: "ຍົກເລີກບິນໄດ້ເມື່ອຈຳເປັນ — ທຸກການຍົກເລີກຖືກບັນທຶກໄວ້."
    }
  }
];

// เหลือแค่ภาพ — จุดเด่นแบบ chip ถูกตัดออกเพราะซ้ำกับ landingFeatures ทั้ง 4 ข้อ
export const landingShowcase: LandingShowcase = {
  image: "/landing/banner_project_yummy-go.webp",
  alt: "Yummy Go restaurant POS and ordering system on laptop and mobile devices"
};

export const landingVideos: LandingVideo[] = [
  {
    id: "tv1",
    title: { en: "Setting up your shop", la: "ຕັ້ງຄ່າຮ້ານຂອງທ່ານ" },
    description: {
      en: "Create your branch, tables, and staff accounts.",
      la: "ສ້າງສາຂາ, ໂຕະ ແລະ ບັນຊີພະນັກງານ."
    },
    duration: "--:--",
    category: "Basics"
  },
  {
    id: "tv2",
    title: { en: "Building your menu", la: "ສ້າງເມນູຂອງທ່ານ" },
    description: {
      en: "Add categories, products, sizes, and toppings.",
      la: "ເພີ່ມໝວດໝູ່, ສິນຄ້າ, ຂະໜາດ ແລະ ທ໋ອບປິ້ງ."
    },
    duration: "--:--",
    category: "Menu"
  },
  {
    id: "tv3",
    title: { en: "Taking orders and payment", la: "ຮັບອໍເດີ ແລະ ຮັບຊຳລະ" },
    description: {
      en: "Run the counter, open tables, and close bills.",
      la: "ໃຊ້ໜ້າເຄົາເຕີ, ເປີດໂຕະ ແລະ ປິດບິນ."
    },
    duration: "--:--",
    category: "POS"
  },
  {
    id: "tv4",
    title: { en: "Reading your sales reports", la: "ອ່ານລາຍງານຍອດຂາຍ" },
    description: {
      en: "Find out what sells and how the day closed.",
      la: "ເບິ່ງວ່າຫຍັງຂາຍດີ ແລະ ມື້ນີ້ປິດຮ້ານແນວໃດ."
    },
    duration: "--:--",
    category: "Reports"
  }
];

export const landingPlatforms: LandingPlatform[] = [
  { id: "web", label: { en: "Web browser", la: "ເບຣົາເຊີເວັບ" } },
  { id: "windows", label: { en: "Windows desktop", la: "Windows ເດັສທັອບ" } },
  { id: "android", label: { en: "Android", la: "Android" } },
  { id: "display", label: { en: "Customer display", la: "ຈໍລູກຄ້າ" } }
];

// จำนวนหน้ารายงานใต้ /report — นับ route ตอน build ไม่ได้ ต้องอัปเดตเมื่อเพิ่มรายงาน
export const REPORT_COUNT = 5;
