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

export interface LandingPlatform {
  id: string;
  label: LocalizedText;
}

export interface LandingStep {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
}

export interface LandingTestimonial {
  id: string;
  quote: LocalizedText;
  name: string;
  shop: string;
}

export interface LandingFaqItem {
  id: string;
  question: LocalizedText;
  answer: LocalizedText;
}

export interface LandingVideo {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  duration: string;
  category: string;
  /** ลิงก์วิดีโอจริง — ว่างไว้ = การ์ดยังไม่พร้อม section จะซ่อนตัวเอง */
  url: string;
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

// เรียงตามลำดับ section จริง — showcase ไม่มีหัวข้อจึงไม่เป็นปลายทางของเมนู
export const landingNavigation: LandingNavItem[] = [
  { id: "about", href: "#about", label: { en: "About", la: "ກ່ຽວກັບ" } },
  { id: "features", href: "#features", label: { en: "Features", la: "ຟີເຈີ" } },
  { id: "platforms", href: "#platforms", label: { en: "Platforms", la: "ແພລດຟອມ" } },
  { id: "pricing", href: "#pricing", label: { en: "Pricing", la: "ລາຄາ" } },
  { id: "trial", href: "#trial", label: { en: "Free trial", la: "ທົດລອງໃຊ້ຟຣີ" } }
];

// เหลือเฉพาะข้อที่ไม่ซ้ำกับ section อื่น — "ใช้ได้ทุกอุปกรณ์" ไปอยู่ที่ Platforms,
// "ข้อมูลยอดขายสด" กับ "รองรับหลายสาขา" ไปอยู่ที่ Features แล้ว
export const landingHighlights: LandingHighlight[] = [
  { id: "allinone", icon: "all", title: { en: "Everything in one system", la: "ທຸກຢ່າງໃນລະບົບດຽວ" } },
  { id: "lao", icon: "lao", title: { en: "Built for Lao restaurants", la: "ສ້າງມາເພື່ອຮ້ານອາຫານລາວ" } },
  { id: "bilingual", icon: "lang", title: { en: "Lao and English", la: "ພາສາລາວ ແລະ ອັງກິດ" } },
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

// แบนเนอร์ 1672x941 (16:9) = 1.57x ของกล่องแสดงผล 1068px — คมพอบนจอ retina
// รูปนี้มีข้อความครบในตัว (แบรนด์ tagline ฟีเจอร์ ปุ่ม) section จึงไม่มีหัวข้อกำกับ
//
// ชื่อไฟล์มี hash ของเนื้อหาต่อท้าย เพราะเปลี่ยนรูปโดยใช้ชื่อเดิมแล้ว /_next/image
// กับ Cloudflare จะยังเสิร์ฟรูปเก่า — เปลี่ยนชื่อ = URL เปลี่ยน = cache หลุดทุกชั้น
// เปลี่ยนรูปใหม่: ต้องเป็น 16:9 (ไม่งั้น object-fit: cover เฉือนบน-ล่างทิ้ง)
// แล้วตั้งชื่อไฟล์ด้วย hash ใหม่ พร้อมแก้ path ตรงนี้
export const landingShowcase: LandingShowcase = {
  image: "/landing/banner-yummy-go.079d6e65.webp",
  alt: "Yummy-go restaurant management system on desktop, tablet and phone — table plan, menu ordering and billing"
};

export const landingPlatforms: LandingPlatform[] = [
  { id: "web", label: { en: "Web browser", la: "ເບຣົາເຊີເວັບ" } },
  { id: "windows", label: { en: "Windows desktop", la: "Windows ເດັສທັອບ" } },
  { id: "android", label: { en: "Android", la: "Android" } },
  { id: "display", label: { en: "Customer display", la: "ຈໍລູກຄ້າ" } }
];

// ขั้นตอนจริงตามลำดับการตั้งค่าในแอป (สาขา → เมนู → โต๊ะ/QR → เปิดขาย)
export const landingSteps: LandingStep[] = [
  {
    id: "signup",
    title: { en: "Ask for a trial", la: "ຂໍທົດລອງໃຊ້" },
    description: {
      en: "Tell us about your shop and we set up your store and branch for you.",
      la: "ບອກຂໍ້ມູນຮ້ານຂອງທ່ານ ແລ້ວພວກເຮົາຕັ້ງຄ່າຮ້ານ ແລະ ສາຂາໃຫ້."
    }
  },
  {
    id: "menu",
    title: { en: "Add your menu", la: "ເພີ່ມເມນູຂອງທ່ານ" },
    description: {
      en: "Create categories, products, sizes, and toppings the way your shop sells them.",
      la: "ສ້າງໝວດໝູ່, ສິນຄ້າ, ຂະໜາດ ແລະ ທ໋ອບປິ້ງ ຕາມທີ່ຮ້ານຂອງທ່ານຂາຍຈິງ."
    }
  },
  {
    id: "tables",
    title: { en: "Set up tables and QR", la: "ຕັ້ງໂຕະ ແລະ QR" },
    description: {
      en: "Lay out your zones and tables, then print the QR code for each table.",
      la: "ຈັດໂຊນ ແລະ ໂຕະ ຈາກນັ້ນພິມ QR ຕິດແຕ່ລະໂຕະ."
    }
  },
  {
    id: "open",
    title: { en: "Open your shop", la: "ເປີດຮ້ານ" },
    description: {
      en: "Take orders, print receipts, and watch today's sales come in live.",
      la: "ຮັບອໍເດີ, ພິມບິນ ແລະ ເບິ່ງຍອດຂາຍມື້ນີ້ເຂົ້າມາສົດໆ."
    }
  }
];

// ⚠️ ใส่รีวิวจากลูกค้าจริงเท่านั้น — ห้ามแต่งขึ้นเอง
// ว่างไว้ = section ซ่อนตัวเอง ไม่มีอะไรขึ้นเว็บจนกว่าจะมีของจริง
export const landingTestimonials: LandingTestimonial[] = [];

// ⚠️ คำตอบที่ยังว่าง = section จะข้ามข้อนั้นไป เติมได้ทีละข้อ
export const landingFaq: LandingFaqItem[] = [
  {
    id: "internet",
    question: { en: "Do I need an internet connection?", la: "ຕ້ອງມີອິນເຕີເນັດບໍ?" },
    answer: {
      en: "Yes. Yummy-go keeps your menu, orders, and reports on the server so every device and branch sees the same data.",
      la: "ຕ້ອງມີ. Yummy-go ເກັບເມນູ, ອໍເດີ ແລະ ລາຍງານໄວ້ເທິງເຊີບເວີ ເພື່ອໃຫ້ທຸກອຸປະກອນ ແລະ ທຸກສາຂາເຫັນຂໍ້ມູນຊຸດດຽວກັນ."
    }
  },
  {
    id: "printer",
    question: { en: "Which receipt printers work with it?", la: "ໃຊ້ໄດ້ກັບເຄື່ອງພິມແບບໃດ?" },
    answer: {
      en: "Printers connected through the local printer agent on Windows, and network printers over TCP on Android.",
      la: "ເຄື່ອງພິມທີ່ຕໍ່ຜ່ານໂປຣແກຣມຊ່ວຍພິມເທິງ Windows ແລະ ເຄື່ອງພິມເຄືອຂ່າຍຜ່ານ TCP ເທິງ Android."
    }
  },
  {
    id: "devices",
    question: { en: "What can I run it on?", la: "ໃຊ້ໄດ້ເທິງອຸປະກອນໃດແດ່?" },
    answer: {
      en: "A web browser on any computer, a Windows desktop app, an Android device, and a second screen for customers.",
      la: "ເບຣົາເຊີເທິງຄອມໃດກໍໄດ້, ແອັບເດັສທັອບ Windows, ອຸປະກອນ Android ແລະ ຈໍທີສອງສຳລັບລູກຄ້າ."
    }
  },
  {
    id: "branches",
    question: { en: "Can I manage more than one branch?", la: "ຄຸມຫຼາຍສາຂາໄດ້ບໍ?" },
    answer: {
      en: "Yes. One account covers every branch, and you control what each staff member can see.",
      la: "ໄດ້. ບັນຊີດຽວຄຸມໄດ້ທຸກສາຂາ ແລະ ກຳນົດໄດ້ວ່າພະນັກງານແຕ່ລະຄົນເຫັນຫຍັງໄດ້ແດ່."
    }
  },
  {
    id: "trial",
    question: { en: "How long is the free trial?", la: "ທົດລອງໃຊ້ຟຣີໄດ້ດົນປານໃດ?" },
    answer: { en: "", la: "" }
  },
  {
    id: "migrate",
    question: { en: "Can you move my existing menu over?", la: "ຍ້າຍເມນູເກົ່າມາໃຫ້ໄດ້ບໍ?" },
    answer: { en: "", la: "" }
  }
];

// ⚠️ ใส่ url ของวิดีโอจริงเมื่อพร้อม — ทุกข้อ url ว่าง = section ซ่อนตัวเอง
export const landingVideos: LandingVideo[] = [
  {
    id: "tv1",
    title: { en: "Setting up your shop", la: "ຕັ້ງຄ່າຮ້ານຂອງທ່ານ" },
    description: {
      en: "Create your branch, tables, and staff accounts.",
      la: "ສ້າງສາຂາ, ໂຕະ ແລະ ບັນຊີພະນັກງານ."
    },
    duration: "--:--",
    category: "Basics",
    url: ""
  },
  {
    id: "tv2",
    title: { en: "Building your menu", la: "ສ້າງເມນູຂອງທ່ານ" },
    description: {
      en: "Add categories, products, sizes, and toppings.",
      la: "ເພີ່ມໝວດໝູ່, ສິນຄ້າ, ຂະໜາດ ແລະ ທ໋ອບປິ້ງ."
    },
    duration: "--:--",
    category: "Menu",
    url: ""
  },
  {
    id: "tv3",
    title: { en: "Taking orders and payment", la: "ຮັບອໍເດີ ແລະ ຮັບຊຳລະ" },
    description: {
      en: "Run the counter, open tables, and close bills.",
      la: "ໃຊ້ໜ້າເຄົາເຕີ, ເປີດໂຕະ ແລະ ປິດບິນ."
    },
    duration: "--:--",
    category: "POS",
    url: ""
  },
  {
    id: "tv4",
    title: { en: "Reading your sales reports", la: "ອ່ານລາຍງານຍອດຂາຍ" },
    description: {
      en: "Find out what sells and how the day closed.",
      la: "ເບິ່ງວ່າຫຍັງຂາຍດີ ແລະ ມື້ນີ້ປິດຮ້ານແນວໃດ."
    },
    duration: "--:--",
    category: "Reports",
    url: ""
  }
];

// จำนวนหน้ารายงานใต้ /report — นับ route ตอน build ไม่ได้ ต้องอัปเดตเมื่อเพิ่มรายงาน
export const REPORT_COUNT = 5;
