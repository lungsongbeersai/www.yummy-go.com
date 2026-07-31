// ============================================================
// Yummy-go — เนื้อหาหน้าแนะนำบริษัท (landing page)
// เป็น single source of truth ของหน้านี้ ภายหลังสามารถย้ายไป
// ดึงจาก API/CMS ได้โดย UI ไม่ต้องแก้ (อ่านจากโครงสร้างนี้เท่านั้น)
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

export interface LandingService {
  id: string;
  icon: string;
  title: LocalizedText;
  description: LocalizedText;
}

export interface LandingProject {
  id: string;
  name: string;
  category: LocalizedText;
  description: LocalizedText;
  features: { la: string[]; en: string[] };
}

export interface LandingVideo {
  id: string;
  projectId: string;
  title: LocalizedText;
  description: LocalizedText;
  duration: string;
  category: string;
}

export interface LandingTech {
  id: string;
  name: string;
}

export function pickText(text: LocalizedText, language: Language): string {
  return text[language];
}

export const landingCompany = {
  name: "Yummy-go",
  foundedYear: 2002,
  // ใช้ไอคอนแบรนด์ตัวเดียวกับ root layout / login / app-shell เพื่อให้เอกลักษณ์ตรงกันทั้งแอป
  logo: "/brand/icon.png",
  tagline: {
    en: "We Build Modern Web Apps, Mobile Apps, and Business Systems",
    la: "ພວກເຮົາສ້າງເວັບແອັບ, ໂມບາຍແອັບ ແລະ ລະບົບທຸລະກິດທີ່ທັນສະໄໝ"
  },
  description: {
    en: "Founded in 2002, Yummy-go creates scalable digital solutions for restaurants, insurance businesses, and modern companies.",
    la: "ກໍ່ຕັ້ງໃນປີ 2002, Yummy-go ສ້າງໂຊລູຊັນດິຈິຕອນທີ່ຂະຫຍາຍໄດ້ ສຳລັບຮ້ານອາຫານ, ທຸລະກິດປະກັນໄພ ແລະ ບໍລິສັດສະໄໝໃໝ່."
  },
  about: {
    en: "Yummy-go develops web applications, mobile applications, business software, backend systems, dashboards, and digital platforms. We focus on building scalable, reliable, and easy-to-use systems for real business operations.",
    la: "Yummy-go ພັດທະນາເວັບແອັບພລິເຄຊັນ, ໂມບາຍແອັບພລິເຄຊັນ, ຊອບແວທຸລະກິດ, ລະບົບ backend, ແດັດບອດ ແລະ ແພລດຟອມດິຈິຕອນ. ພວກເຮົາເນັ້ນການສ້າງລະບົບທີ່ຂະຫຍາຍໄດ້, ເຊື່ອຖືໄດ້ ແລະ ໃຊ້ງ່າຍ ສຳລັບການດຳເນີນທຸລະກິດຕົວຈິງ."
  },
  contactEmail: "",
  phone: "",
  address: ""
} as const;

export const landingNavigation: LandingNavItem[] = [
  { id: "about", href: "#about", label: { en: "About", la: "ກ່ຽວກັບ" } },
  { id: "services", href: "#services", label: { en: "Services", la: "ບໍລິການ" } },
  { id: "pricing", href: "#pricing", label: { en: "Pricing", la: "ລາຄາ" } },
  { id: "projects", href: "#projects", label: { en: "Projects", la: "ໂປຣເຈັກ" } },
  { id: "tutorials", href: "#tutorials", label: { en: "Tutorials", la: "ວິດີໂອສອນ" } },
  { id: "technology", href: "#technology", label: { en: "Technology", la: "ເທັກໂນໂລຊີ" } },
  { id: "contact", href: "#contact", label: { en: "Contact", la: "ຕິດຕໍ່" } }
];

export const landingHighlights: LandingHighlight[] = [
  { id: "founded", icon: "est", title: { en: "Founded in 2002", la: "ກໍ່ຕັ້ງໃນປີ 2002" } },
  { id: "webapp", icon: "dev", title: { en: "Web & App Development", la: "ພັດທະນາເວັບ ແລະ ແອັບ" } },
  { id: "bizsoft", icon: "biz", title: { en: "Business Software", la: "ຊອບແວທຸລະກິດ" } },
  { id: "backend", icon: "api", title: { en: "Backend-ready Systems", la: "ລະບົບພ້ອມ Backend" } },
  { id: "support", icon: "sla", title: { en: "Long-term Support", la: "ການສະໜັບສະໜູນໄລຍະຍາວ" } }
];

export const landingServices: LandingService[] = [
  {
    id: "web",
    icon: "web",
    title: { en: "Web Application Development", la: "ພັດທະນາເວັບແອັບພລິເຄຊັນ" },
    description: {
      en: "Fast, scalable web apps built for real business workflows.",
      la: "ເວັບແອັບໄວ ແລະ ຂະຫຍາຍໄດ້ ສ້າງເພື່ອຂັ້ນຕອນທຸລະກິດຕົວຈິງ."
    }
  },
  {
    id: "mobile",
    icon: "app",
    title: { en: "Mobile Application Development", la: "ພັດທະນາໂມບາຍແອັບພລິເຄຊັນ" },
    description: {
      en: "Native-quality mobile apps for iOS and Android.",
      la: "ໂມບາຍແອັບຄຸນນະພາບສູງ ສຳລັບ iOS ແລະ Android."
    }
  },
  {
    id: "bms",
    icon: "biz",
    title: { en: "Business Management Systems", la: "ລະບົບບໍລິຫານທຸລະກິດ" },
    description: {
      en: "End-to-end systems that run daily business operations.",
      la: "ລະບົບຄົບວົງຈອນ ສຳລັບການດຳເນີນງານປະຈຳວັນ."
    }
  },
  {
    id: "pos",
    icon: "pos",
    title: { en: "POS Systems", la: "ລະບົບ POS" },
    description: {
      en: "Point-of-sale systems for retail and restaurants.",
      la: "ລະບົບຂາຍໜ້າຮ້ານ ສຳລັບຮ້ານຄ້າ ແລະ ຮ້ານອາຫານ."
    }
  },
  {
    id: "dash",
    icon: "rpt",
    title: { en: "Dashboard & Reporting Systems", la: "ລະບົບແດັດບອດ ແລະ ລາຍງານ" },
    description: {
      en: "Live dashboards and reports that drive decisions.",
      la: "ແດັດບອດສົດ ແລະ ລາຍງານ ເພື່ອການຕັດສິນໃຈ."
    }
  },
  {
    id: "api",
    icon: "api",
    title: { en: "Backend / API Development", la: "ພັດທະນາ Backend / API" },
    description: {
      en: "Secure, well-structured APIs and backend services.",
      la: "API ແລະ ບໍລິການ backend ທີ່ປອດໄພ ແລະ ມີໂຄງສ້າງດີ."
    }
  },
  {
    id: "uiux",
    icon: "ux",
    title: { en: "UI/UX Design", la: "ອອກແບບ UI/UX" },
    description: {
      en: "Clean, modern interfaces users understand instantly.",
      la: "ອິນເຕີເຟດສະອາດ ທັນສະໄໝ ໃຊ້ງ່າຍ."
    }
  },
  {
    id: "maint",
    icon: "ops",
    title: { en: "System Maintenance & Future Upgrades", la: "ບຳລຸງຮັກສາ ແລະ ອັບເກຣດລະບົບ" },
    description: {
      en: "Long-term maintenance, monitoring, and upgrades.",
      la: "ບຳລຸງຮັກສາ, ຕິດຕາມ ແລະ ອັບເກຣດໄລຍະຍາວ."
    }
  }
];

export const landingProjects: LandingProject[] = [
  {
    id: "yummy-go",
    name: "yummy-go",
    category: { en: "Restaurant System", la: "ລະບົບຮ້ານອາຫານ" },
    description: {
      en: "A restaurant management platform for POS, orders, sales, reports, and restaurant operations.",
      la: "ແພລດຟອມບໍລິຫານຮ້ານອາຫານ ສຳລັບ POS, ອໍເດີ, ຍອດຂາຍ, ລາຍງານ ແລະ ການດຳເນີນງານຮ້ານອາຫານ."
    },
    features: {
      en: ["POS management", "Order management", "Sales reports", "Restaurant operation tools", "User-friendly interface"],
      la: ["ບໍລິຫານ POS", "ຈັດການອໍເດີ", "ລາຍງານຍອດຂາຍ", "ເຄື່ອງມືດຳເນີນງານຮ້ານອາຫານ", "ອິນເຕີເຟດໃຊ້ງ່າຍ"]
    }
  },
  {
    id: "oac-instuce",
    name: "OAC InStuce",
    category: { en: "Insurance System", la: "ລະບົບປະກັນໄພ" },
    description: {
      en: "An insurance management platform for customers, policies, workflow tracking, reports, and insurance business operations.",
      la: "ແພລດຟອມບໍລິຫານປະກັນໄພ ສຳລັບລູກຄ້າ, ກົມທັນ, ຕິດຕາມຂັ້ນຕອນ, ລາຍງານ ແລະ ການດຳເນີນທຸລະກິດປະກັນໄພ."
    },
    features: {
      en: ["Customer management", "Policy management", "Insurance workflow", "Reports", "Business operation tools"],
      la: ["ຈັດການລູກຄ້າ", "ຈັດການກົມທັນ", "ຂັ້ນຕອນປະກັນໄພ", "ລາຍງານ", "ເຄື່ອງມືດຳເນີນທຸລະກິດ"]
    }
  }
];

export const landingVideos: LandingVideo[] = [
  {
    id: "tv1",
    projectId: "yummy-go",
    title: { en: "Getting Started with yummy-go", la: "ເລີ່ມຕົ້ນໃຊ້ yummy-go" },
    description: { en: "Set up your restaurant, menu, and staff accounts.", la: "ຕັ້ງຄ່າຮ້ານອາຫານ, ເມນູ ແລະ ບັນຊີພະນັກງານ." },
    duration: "--:--",
    category: "Basics"
  },
  {
    id: "tv2",
    projectId: "yummy-go",
    title: { en: "Using the POS & Orders", la: "ການໃຊ້ POS ແລະ ອໍເດີ" },
    description: { en: "Take orders, process payments, and manage tables.", la: "ຮັບອໍເດີ, ຊຳລະເງິນ ແລະ ຈັດການໂຕະ." },
    duration: "--:--",
    category: "POS"
  },
  {
    id: "tv3",
    projectId: "oac-instuce",
    title: { en: "OAC InStuce Overview", la: "ພາບລວມ OAC InStuce" },
    description: { en: "A full tour of the insurance management dashboard.", la: "ທົວລະບົບແດັດບອດບໍລິຫານປະກັນໄພ." },
    duration: "--:--",
    category: "Basics"
  },
  {
    id: "tv4",
    projectId: "oac-instuce",
    title: { en: "Managing Policies & Workflow", la: "ຈັດການກົມທັນ ແລະ ຂັ້ນຕອນ" },
    description: { en: "Create policies and track the insurance workflow.", la: "ສ້າງກົມທັນ ແລະ ຕິດຕາມຂັ້ນຕອນປະກັນໄພ." },
    duration: "--:--",
    category: "Workflow"
  }
];

export const landingWhyChooseUs: LandingHighlight[] = [
  { id: "tech", icon: "mod", title: { en: "Modern Technology", la: "ເທັກໂນໂລຊີທັນສະໄໝ" } },
  { id: "custom", icon: "cus", title: { en: "Custom Software Development", la: "ພັດທະນາຊອບແວຕາມຄວາມຕ້ອງການ" } },
  { id: "bizdesign", icon: "biz", title: { en: "Business-focused Design", la: "ອອກແບບເນັ້ນທຸລະກິດ" } },
  { id: "scale", icon: "scl", title: { en: "Scalable Backend", la: "Backend ຂະຫຍາຍໄດ້" } },
  { id: "future", icon: "fut", title: { en: "Future-ready Architecture", la: "ສະຖາປັດຕະຍະກຳພ້ອມອະນາຄົດ" } },
  { id: "ui", icon: "ux", title: { en: "Clean UI/UX", la: "UI/UX ສະອາດ" } },
  { id: "support", icon: "sla", title: { en: "Long-term Support", la: "ສະໜັບສະໜູນໄລຍະຍາວ" } }
];

export const landingTechnologies: LandingTech[] = [
  { id: "t1", name: "Frontend" },
  { id: "t2", name: "Backend" },
  { id: "t3", name: "Database" },
  { id: "t4", name: "Mobile" },
  { id: "t5", name: "Cloud" },
  { id: "t6", name: "API" },
  { id: "t7", name: "Security" },
  { id: "t8", name: "Reporting" }
];

// ข้อความ UI ทั้งหมดของหน้า landing (ปุ่ม/หัวข้อ/ป้ายกำกับ) — สองภาษา
export const landingUi = {
  navCta: { en: "Contact Us", la: "ຕິດຕໍ່ພວກເຮົາ" },
  btnLogin: { en: "Sign In", la: "ເຂົ້າສູ່ລະບົບ" },
  heroBadge: { en: "Software company · Since 2002", la: "ບໍລິສັດຊອບແວ · ຕັ້ງແຕ່ 2002" },
  btnExplore: { en: "Explore Projects", la: "ເບິ່ງໂປຣເຈັກ" },
  btnTutorials: { en: "Watch Tutorials", la: "ເບິ່ງວິດີໂອສອນ" },
  btnContact: { en: "Contact Us", la: "ຕິດຕໍ່ພວກເຮົາ" },
  aboutKicker: { en: "About the company", la: "ກ່ຽວກັບບໍລິສັດ" },
  aboutTitle: { en: "Building real systems for real businesses", la: "ສ້າງລະບົບຕົວຈິງ ສຳລັບທຸລະກິດຕົວຈິງ" },
  servicesKicker: { en: "Services", la: "ບໍລິການ" },
  servicesTitle: { en: "What we can build for you", la: "ສິ່ງທີ່ພວກເຮົາສ້າງໃຫ້ທ່ານໄດ້" },
  pricingKicker: { en: "Pricing", la: "ລາຄາ" },
  pricingTitle: {
    en: "Choose the plan that fits your shop",
    la: "ເລືອກແພັກເກັດທີ່ເໝາະກັບຮ້ານຂອງທ່ານ"
  },
  pricingSubtitle: {
    en: "Every plan includes setup support and free updates.",
    la: "ທຸກແພັກເກັດລວມການຕິດຕັ້ງ ແລະ ອັບເດດຟຣີ."
  },
  pricingSavings: { en: "save {value}%", la: "ປະຢັດ {value}%" },
  pricingCta: { en: "Get this plan", la: "ເອົາແພັກເກັດນີ້" },
  pricingHelp: {
    en: "Not sure which one? Talk to us.",
    la: "ຍັງບໍ່ແນ່ໃຈວ່າອັນໃດ? ລົມກັບພວກເຮົາໄດ້ເລີຍ."
  },
  pricingHelpCta: { en: "Contact us", la: "ຕິດຕໍ່ພວກເຮົາ" },
  projectsKicker: { en: "Projects", la: "ໂປຣເຈັກ" },
  projectsTitle: { en: "Systems in production", la: "ລະບົບທີ່ໃຊ້ງານຈິງ" },
  btnViewProject: { en: "View Project", la: "ເບິ່ງໂປຣເຈັກ" },
  btnWatchTutorial: { en: "Watch Tutorial", la: "ເບິ່ງວິດີໂອສອນ" },
  btnRequestDemo: { en: "Request Demo", la: "ຂໍເດໂມ" },
  tutorialsTitle: { en: "Tutorial Videos", la: "ວິດີໂອສອນ" },
  tutorialsSubtitle: {
    en: "Learn how to use our systems step by step.",
    la: "ຮຽນຮູ້ວິທີໃຊ້ລະບົບຂອງພວກເຮົາເທື່ອລະຂັ້ນຕອນ."
  },
  filterAll: { en: "All", la: "ທັງໝົດ" },
  whyKicker: { en: "Why choose us", la: "ເປັນຫຍັງຕ້ອງເລືອກພວກເຮົາ" },
  whyTitle: { en: "A partner for the long run", la: "ຄູ່ຮ່ວມງານໄລຍະຍາວ" },
  techKicker: { en: "Technology", la: "ເທັກໂນໂລຊີ" },
  techTitle: { en: "Capability across the full stack", la: "ຄວາມສາມາດຄົບທຸກຊັ້ນເທັກໂນໂລຊີ" },
  contactKicker: { en: "Contact", la: "ຕິດຕໍ່" },
  contactTitle: { en: "Let's build your system", la: "ມາສ້າງລະບົບຂອງທ່ານກັນ" },
  contactSubtitle: {
    en: "Tell us about your business and what you need.",
    la: "ບອກພວກເຮົາກ່ຽວກັບທຸລະກິດ ແລະ ສິ່ງທີ່ທ່ານຕ້ອງການ."
  },
  fieldName: { en: "Name", la: "ຊື່" },
  fieldEmail: { en: "Email or phone", la: "ອີເມວ ຫຼື ເບີໂທ" },
  fieldMessage: { en: "Message", la: "ຂໍ້ຄວາມ" },
  btnSend: { en: "Send Message", la: "ສົ່ງຂໍ້ຄວາມ" },
  btnCustom: { en: "Request a Custom System", la: "ຂໍລະບົບຕາມຄວາມຕ້ອງການ" },
  contactCardTitle: { en: "Company contact", la: "ຂໍ້ມູນຕິດຕໍ່ບໍລິສັດ" },
  contactEmailLabel: { en: "Email", la: "ອີເມວ" },
  contactPhoneLabel: { en: "Phone", la: "ເບີໂທ" },
  contactAddressLabel: { en: "Address", la: "ທີ່ຢູ່" },
  contactSocialLabel: { en: "Social media", la: "ໂຊຊຽວມີເດຍ" },
  placeholderTba: { en: "To be added", la: "ຈະເພີ່ມພາຍຫຼັງ" },
  footerProjects: { en: "Projects", la: "ໂປຣເຈັກ" },
  footerServices: { en: "Services", la: "ບໍລິການ" },
  footerContact: { en: "Contact", la: "ຕິດຕໍ່" },
  footerDesc: {
    en: "Web apps, mobile apps, and business systems — built to scale since 2002.",
    la: "ເວັບແອັບ, ໂມບາຍແອັບ ແລະ ລະບົບທຸລະກິດ — ສ້າງເພື່ອຂະຫຍາຍ ຕັ້ງແຕ່ 2002."
  },
  copyrightSuffix: { en: "All rights reserved.", la: "ສະຫງວນລິຂະສິດ." },
  formSent: {
    en: "Thank you — your message is ready to send once contact details are connected.",
    la: "ຂອບໃຈ — ຂໍ້ຄວາມຂອງທ່ານພ້ອມສົ່ງ ເມື່ອເຊື່ອມຕໍ່ຂໍ້ມູນຕິດຕໍ່ແລ້ວ."
  },
  scrollHint: { en: "Scroll to explore", la: "ເລື່ອນລົງເພື່ອສຳຫຼວດ" },
  interactHint: { en: "Click or drag the background", la: "ຄລິກ ຫຼື ລາກພື້ນຫຼັງ" },
  statYears: { en: "Years building software", la: "ປີແຫ່ງການສ້າງຊອບແວ" },
  statSystems: { en: "Systems in production", la: "ລະບົບທີ່ໃຊ້ງານຈິງ" },
  statServices: { en: "Service areas", la: "ຂອບເຂດການບໍລິການ" },
  backTop: { en: "Back to top", la: "ກັບຄືນເທິງສຸດ" },
  qualityTitle: { en: "Graphics quality", la: "ຄຸນນະພາບພາບກຣາຟິກ" },
  qualityAuto: { en: "Auto", la: "ອັດຕະໂນມັດ" },
  qualityAutoHint: { en: "Match this device", la: "ປັບຕາມເຄື່ອງນີ້" },
  qualityLow: { en: "Low", la: "ຕ່ຳ" },
  qualityLowHint: { en: "Saves battery", la: "ປະຢັດແບັດເຕີຣີ" },
  qualityMedium: { en: "Medium", la: "ປານກາງ" },
  qualityMediumHint: { en: "Balanced", la: "ສົມດຸນ" },
  qualityHigh: { en: "High", la: "ສູງ" },
  qualityHighHint: { en: "Sharp on retina screens", la: "ຄົມຊັດເທິງຈໍລະອຽດສູງ" },
  qualityUltra: { en: "Ultra", la: "ສູງສຸດ" },
  qualityUltraHint: { en: "Full resolution, needs a strong GPU", la: "ຄວາມລະອຽດເຕັມ ຕ້ອງການ GPU ແຮງ" },
  qualityFps: { en: "FPS", la: "FPS" },
  qualityStatsHint: { en: "Live frame rate and render scale", la: "ເຟຣມເຣດ ແລະ ຄວາມລະອຽດຈິງ" },
  qualityAdaptive: { en: "Auto-scaled to", la: "ປັບຄວາມລະອຽດເປັນ" },
  qualityOff: { en: "Scene paused", la: "ຢຸດສາກຊົ່ວຄາວ" }
} as const satisfies Record<string, LocalizedText>;

export type LandingUiKey = keyof typeof landingUi;
