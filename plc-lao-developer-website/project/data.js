// ============================================================
// PLC Lao Developer — site content
// This file is the single source of truth for all site content.
// Replace it later with an API/CMS fetch — the UI reads only
// from this structure, nothing is hard-coded in components.
// ============================================================

export const company = {
  name: "PLC Lao Developer",
  foundedYear: 2002,
  logo: "uploads/PLC.png",
  tagline_en: "We Build Modern Web Apps, Mobile Apps, and Business Systems",
  tagline_lo: "ພວກເຮົາສ້າງເວັບແອັບ, ໂມບາຍແອັບ ແລະ ລະບົບທຸລະກິດທີ່ທັນສະໄໝ",
  description_en:
    "Founded in 2002, PLC Lao Developer creates scalable digital solutions for restaurants, insurance businesses, and modern companies.",
  description_lo:
    "ກໍ່ຕັ້ງໃນປີ 2002, PLC Lao Developer ສ້າງໂຊລູຊັນດິຈິຕອນທີ່ຂະຫຍາຍໄດ້ ສຳລັບຮ້ານອາຫານ, ທຸລະກິດປະກັນໄພ ແລະ ບໍລິສັດສະໄໝໃໝ່.",
  about_en:
    "PLC Lao Developer develops web applications, mobile applications, business software, backend systems, dashboards, and digital platforms. We focus on building scalable, reliable, and easy-to-use systems for real business operations.",
  about_lo:
    "PLC Lao Developer ພັດທະນາເວັບແອັບພລິເຄຊັນ, ໂມບາຍແອັບພລິເຄຊັນ, ຊອບແວທຸລະກິດ, ລະບົບ backend, ແດັດບອດ ແລະ ແພລດຟອມດິຈິຕອນ. ພວກເຮົາເນັ້ນການສ້າງລະບົບທີ່ຂະຫຍາຍໄດ້, ເຊື່ອຖືໄດ້ ແລະ ໃຊ້ງ່າຍ ສຳລັບການດຳເນີນທຸລະກິດຕົວຈິງ.",
  primaryColor: "#3b82f6",
  contactEmail: "", // add later
  phone: "", // add later
  address: "", // add later
  socialLinks: [], // e.g. { id, label, url, icon }
};

export const navigation = [
  { id: "about", label_en: "About", label_lo: "ກ່ຽວກັບ", href: "#about" },
  { id: "services", label_en: "Services", label_lo: "ບໍລິການ", href: "#services" },
  { id: "projects", label_en: "Projects", label_lo: "ໂປຣເຈັກ", href: "#projects" },
  { id: "tutorials", label_en: "Tutorials", label_lo: "ວິດີໂອສອນ", href: "#tutorials" },
  { id: "technology", label_en: "Technology", label_lo: "ເທັກໂນໂລຊີ", href: "#technology" },
  { id: "contact", label_en: "Contact", label_lo: "ຕິດຕໍ່", href: "#contact" },
];

export const highlights = [
  { id: "founded", title_en: "Founded in 2002", title_lo: "ກໍ່ຕັ້ງໃນປີ 2002", icon: "est" },
  { id: "webapp", title_en: "Web & App Development", title_lo: "ພັດທະນາເວັບ ແລະ ແອັບ", icon: "dev" },
  { id: "bizsoft", title_en: "Business Software", title_lo: "ຊອບແວທຸລະກິດ", icon: "biz" },
  { id: "backend", title_en: "Backend-ready Systems", title_lo: "ລະບົບພ້ອມ Backend", icon: "api" },
  { id: "support", title_en: "Long-term Support", title_lo: "ການສະໜັບສະໜູນໄລຍະຍາວ", icon: "sla" },
];

export const services = [
  { id: "web", title_en: "Web Application Development", title_lo: "ພັດທະນາເວັບແອັບພລິເຄຊັນ", description_en: "Fast, scalable web apps built for real business workflows.", description_lo: "ເວັບແອັບໄວ ແລະ ຂະຫຍາຍໄດ້ ສ້າງເພື່ອຂັ້ນຕອນທຸລະກິດຕົວຈິງ.", icon: "web" },
  { id: "mobile", title_en: "Mobile Application Development", title_lo: "ພັດທະນາໂມບາຍແອັບພລິເຄຊັນ", description_en: "Native-quality mobile apps for iOS and Android.", description_lo: "ໂມບາຍແອັບຄຸນນະພາບສູງ ສຳລັບ iOS ແລະ Android.", icon: "app" },
  { id: "bms", title_en: "Business Management Systems", title_lo: "ລະບົບບໍລິຫານທຸລະກິດ", description_en: "End-to-end systems that run daily business operations.", description_lo: "ລະບົບຄົບວົງຈອນ ສຳລັບການດຳເນີນງານປະຈຳວັນ.", icon: "biz" },
  { id: "pos", title_en: "POS Systems", title_lo: "ລະບົບ POS", description_en: "Point-of-sale systems for retail and restaurants.", description_lo: "ລະບົບຂາຍໜ້າຮ້ານ ສຳລັບຮ້ານຄ້າ ແລະ ຮ້ານອາຫານ.", icon: "pos" },
  { id: "dash", title_en: "Dashboard & Reporting Systems", title_lo: "ລະບົບແດັດບອດ ແລະ ລາຍງານ", description_en: "Live dashboards and reports that drive decisions.", description_lo: "ແດັດບອດສົດ ແລະ ລາຍງານ ເພື່ອການຕັດສິນໃຈ.", icon: "rpt" },
  { id: "api", title_en: "Backend / API Development", title_lo: "ພັດທະນາ Backend / API", description_en: "Secure, well-structured APIs and backend services.", description_lo: "API ແລະ ບໍລິການ backend ທີ່ປອດໄພ ແລະ ມີໂຄງສ້າງດີ.", icon: "api" },
  { id: "uiux", title_en: "UI/UX Design", title_lo: "ອອກແບບ UI/UX", description_en: "Clean, modern interfaces users understand instantly.", description_lo: "ອິນເຕີເຟດສະອາດ ທັນສະໄໝ ໃຊ້ງ່າຍ.", icon: "ux" },
  { id: "maint", title_en: "System Maintenance & Future Upgrades", title_lo: "ບຳລຸງຮັກສາ ແລະ ອັບເກຣດລະບົບ", description_en: "Long-term maintenance, monitoring, and upgrades.", description_lo: "ບຳລຸງຮັກສາ, ຕິດຕາມ ແລະ ອັບເກຣດໄລຍະຍາວ.", icon: "ops" },
];

export const projects = [
  {
    id: "yummy-go",
    name: "yummy-go",
    slug: "yummy-go",
    category_en: "Restaurant System",
    category_lo: "ລະບົບຮ້ານອາຫານ",
    description_en: "A restaurant management platform for POS, orders, sales, reports, and restaurant operations.",
    description_lo: "ແພລດຟອມບໍລິຫານຮ້ານອາຫານ ສຳລັບ POS, ອໍເດີ, ຍອດຂາຍ, ລາຍງານ ແລະ ການດຳເນີນງານຮ້ານອາຫານ.",
    features_en: ["POS management", "Order management", "Sales reports", "Restaurant operation tools", "User-friendly interface"],
    features_lo: ["ບໍລິຫານ POS", "ຈັດການອໍເດີ", "ລາຍງານຍອດຂາຍ", "ເຄື່ອງມືດຳເນີນງານຮ້ານອາຫານ", "ອິນເຕີເຟດໃຊ້ງ່າຍ"],
    images: [], // add screenshot URLs later
    videos: [], // add video URLs later
    status: "active",
    websiteUrl: "",
    createdAt: "2024-01-01",
    updatedAt: "2026-07-01",
  },
  {
    id: "oac-instuce",
    name: "OAC InStuce",
    slug: "oac-instuce",
    category_en: "Insurance System",
    category_lo: "ລະບົບປະກັນໄພ",
    description_en: "An insurance management platform for customers, policies, workflow tracking, reports, and insurance business operations.",
    description_lo: "ແພລດຟອມບໍລິຫານປະກັນໄພ ສຳລັບລູກຄ້າ, ກົມທັນ, ຕິດຕາມຂັ້ນຕອນ, ລາຍງານ ແລະ ການດຳເນີນທຸລະກິດປະກັນໄພ.",
    features_en: ["Customer management", "Policy management", "Insurance workflow", "Reports", "Business operation tools"],
    features_lo: ["ຈັດການລູກຄ້າ", "ຈັດການກົມທັນ", "ຂັ້ນຕອນປະກັນໄພ", "ລາຍງານ", "ເຄື່ອງມືດຳເນີນທຸລະກິດ"],
    images: [],
    videos: [],
    status: "active",
    websiteUrl: "",
    createdAt: "2024-06-01",
    updatedAt: "2026-07-01",
  },
];

export const tutorialVideos = [
  { id: "tv1", projectId: "yummy-go", title_en: "Getting Started with yummy-go", title_lo: "ເລີ່ມຕົ້ນໃຊ້ yummy-go", description_en: "Set up your restaurant, menu, and staff accounts.", description_lo: "ຕັ້ງຄ່າຮ້ານອາຫານ, ເມນູ ແລະ ບັນຊີພະນັກງານ.", thumbnail: null, videoUrl: null, duration: "--:--", category: "Basics", createdAt: "", updatedAt: "" },
  { id: "tv2", projectId: "yummy-go", title_en: "Using the POS & Orders", title_lo: "ການໃຊ້ POS ແລະ ອໍເດີ", description_en: "Take orders, process payments, and manage tables.", description_lo: "ຮັບອໍເດີ, ຊຳລະເງິນ ແລະ ຈັດການໂຕະ.", thumbnail: null, videoUrl: null, duration: "--:--", category: "POS", createdAt: "", updatedAt: "" },
  { id: "tv3", projectId: "oac-instuce", title_en: "OAC InStuce Overview", title_lo: "ພາບລວມ OAC InStuce", description_en: "A full tour of the insurance management dashboard.", description_lo: "ທົວລະບົບແດັດບອດບໍລິຫານປະກັນໄພ.", thumbnail: null, videoUrl: null, duration: "--:--", category: "Basics", createdAt: "", updatedAt: "" },
  { id: "tv4", projectId: "oac-instuce", title_en: "Managing Policies & Workflow", title_lo: "ຈັດການກົມທັນ ແລະ ຂັ້ນຕອນ", description_en: "Create policies and track the insurance workflow.", description_lo: "ສ້າງກົມທັນ ແລະ ຕິດຕາມຂັ້ນຕອນປະກັນໄພ.", thumbnail: null, videoUrl: null, duration: "--:--", category: "Workflow", createdAt: "", updatedAt: "" },
];

export const whyChooseUs = [
  { id: "tech", title_en: "Modern Technology", title_lo: "ເທັກໂນໂລຊີທັນສະໄໝ", icon: "mod" },
  { id: "custom", title_en: "Custom Software Development", title_lo: "ພັດທະນາຊອບແວຕາມຄວາມຕ້ອງການ", icon: "cus" },
  { id: "bizdesign", title_en: "Business-focused Design", title_lo: "ອອກແບບເນັ້ນທຸລະກິດ", icon: "biz" },
  { id: "scale", title_en: "Scalable Backend", title_lo: "Backend ຂະຫຍາຍໄດ້", icon: "scl" },
  { id: "future", title_en: "Future-ready Architecture", title_lo: "ສະຖາປັດຕະຍະກຳພ້ອມອະນາຄົດ", icon: "fut" },
  { id: "ui", title_en: "Clean UI/UX", title_lo: "UI/UX ສະອາດ", icon: "ux" },
  { id: "support", title_en: "Long-term Support", title_lo: "ສະໜັບສະໜູນໄລຍະຍາວ", icon: "sla" },
];

export const technologies = [
  { id: "t1", name: "Frontend", category: "frontend", icon: null },
  { id: "t2", name: "Backend", category: "backend", icon: null },
  { id: "t3", name: "Database", category: "database", icon: null },
  { id: "t4", name: "Mobile", category: "mobile", icon: null },
  { id: "t5", name: "Cloud", category: "cloud", icon: null },
  { id: "t6", name: "API", category: "api", icon: null },
  { id: "t7", name: "Security", category: "security", icon: null },
  { id: "t8", name: "Reporting", category: "reporting", icon: null },
];

export const theme = {
  primaryColor: "#3b82f6",
  secondaryColor: "#22d3ee",
  backgroundColor: "#050810",
  accentColor: "#60a5fa",
  animationStyle: "smooth",
};

// UI strings (buttons, labels, section titles) — translation-ready
export const ui = {
  nav_cta_en: "Contact Us", nav_cta_lo: "ຕິດຕໍ່ພວກເຮົາ",
  hero_badge_en: "Software company · Since 2002", hero_badge_lo: "ບໍລິສັດຊອບແວ · ຕັ້ງແຕ່ 2002",
  btn_explore_en: "Explore Projects", btn_explore_lo: "ເບິ່ງໂປຣເຈັກ",
  btn_tutorials_en: "Watch Tutorials", btn_tutorials_lo: "ເບິ່ງວິດີໂອສອນ",
  btn_contact_en: "Contact Us", btn_contact_lo: "ຕິດຕໍ່ພວກເຮົາ",
  about_kicker_en: "About the company", about_kicker_lo: "ກ່ຽວກັບບໍລິສັດ",
  about_title_en: "Building real systems for real businesses", about_title_lo: "ສ້າງລະບົບຕົວຈິງ ສຳລັບທຸລະກິດຕົວຈິງ",
  services_kicker_en: "Services", services_kicker_lo: "ບໍລິການ",
  services_title_en: "What we can build for you", services_title_lo: "ສິ່ງທີ່ພວກເຮົາສ້າງໃຫ້ທ່ານໄດ້",
  projects_kicker_en: "Projects", projects_kicker_lo: "ໂປຣເຈັກ",
  projects_title_en: "Systems in production", projects_title_lo: "ລະບົບທີ່ໃຊ້ງານຈິງ",
  btn_view_project_en: "View Project", btn_view_project_lo: "ເບິ່ງໂປຣເຈັກ",
  btn_watch_tutorial_en: "Watch Tutorial", btn_watch_tutorial_lo: "ເບິ່ງວິດີໂອສອນ",
  btn_request_demo_en: "Request Demo", btn_request_demo_lo: "ຂໍເດໂມ",
  tutorials_title_en: "Tutorial Videos", tutorials_title_lo: "ວິດີໂອສອນ",
  tutorials_subtitle_en: "Learn how to use our systems step by step.", tutorials_subtitle_lo: "ຮຽນຮູ້ວິທີໃຊ້ລະບົບຂອງພວກເຮົາເທື່ອລະຂັ້ນຕອນ.",
  filter_all_en: "All", filter_all_lo: "ທັງໝົດ",
  why_kicker_en: "Why choose us", why_kicker_lo: "ເປັນຫຍັງຕ້ອງເລືອກພວກເຮົາ",
  why_title_en: "A partner for the long run", why_title_lo: "ຄູ່ຮ່ວມງານໄລຍະຍາວ",
  tech_kicker_en: "Technology", tech_kicker_lo: "ເທັກໂນໂລຊີ",
  tech_title_en: "Capability across the full stack", tech_title_lo: "ຄວາມສາມາດຄົບທຸກຊັ້ນເທັກໂນໂລຊີ",
  contact_kicker_en: "Contact", contact_kicker_lo: "ຕິດຕໍ່",
  contact_title_en: "Let's build your system", contact_title_lo: "ມາສ້າງລະບົບຂອງທ່ານກັນ",
  contact_subtitle_en: "Tell us about your business and what you need.", contact_subtitle_lo: "ບອກພວກເຮົາກ່ຽວກັບທຸລະກິດ ແລະ ສິ່ງທີ່ທ່ານຕ້ອງການ.",
  field_name_en: "Name", field_name_lo: "ຊື່",
  field_email_en: "Email or phone", field_email_lo: "ອີເມວ ຫຼື ເບີໂທ",
  field_message_en: "Message", field_message_lo: "ຂໍ້ຄວາມ",
  btn_send_en: "Send Message", btn_send_lo: "ສົ່ງຂໍ້ຄວາມ",
  btn_custom_en: "Request a Custom System", btn_custom_lo: "ຂໍລະບົບຕາມຄວາມຕ້ອງການ",
  contact_card_title_en: "Company contact", contact_card_title_lo: "ຂໍ້ມູນຕິດຕໍ່ບໍລິສັດ",
  contact_email_label_en: "Email", contact_email_label_lo: "ອີເມວ",
  contact_phone_label_en: "Phone", contact_phone_label_lo: "ເບີໂທ",
  contact_address_label_en: "Address", contact_address_label_lo: "ທີ່ຢູ່",
  contact_social_label_en: "Social media", contact_social_label_lo: "ໂຊຊຽວມີເດຍ",
  placeholder_tba_en: "To be added", placeholder_tba_lo: "ຈະເພີ່ມພາຍຫຼັງ",
  footer_projects_en: "Projects", footer_projects_lo: "ໂປຣເຈັກ",
  footer_services_en: "Services", footer_services_lo: "ບໍລິການ",
  footer_contact_en: "Contact", footer_contact_lo: "ຕິດຕໍ່",
  footer_desc_en: "Web apps, mobile apps, and business systems — built to scale since 2002.", footer_desc_lo: "ເວັບແອັບ, ໂມບາຍແອັບ ແລະ ລະບົບທຸລະກິດ — ສ້າງເພື່ອຂະຫຍາຍ ຕັ້ງແຕ່ 2002.",
  copyright_en: "© 2026 PLC Lao Developer. All rights reserved.", copyright_lo: "© 2026 PLC Lao Developer. ສະຫງວນລິຂະສິດ.",
  form_sent_en: "Thank you — your message is ready to send once contact details are connected.", form_sent_lo: "ຂອບໃຈ — ຂໍ້ຄວາມຂອງທ່ານພ້ອມສົ່ງ ເມື່ອເຊື່ອມຕໍ່ຂໍ້ມູນຕິດຕໍ່ແລ້ວ.",
  scroll_hint_en: "Scroll to explore", scroll_hint_lo: "ເລື່ອນລົງເພື່ອສຳຫຼວດ",
  interact_hint_en: "Click or drag the background", interact_hint_lo: "ຄລິກ ຫຼື ລາກພື້ນຫຼັງ",
  stat_years_en: "Years building software", stat_years_lo: "ປີແຫ່ງການສ້າງຊອບແວ",
  stat_systems_en: "Systems in production", stat_systems_lo: "ລະບົບທີ່ໃຊ້ງານຈິງ",
  stat_services_en: "Service areas", stat_services_lo: "ຂອບເຂດການບໍລິການ",
  back_top_en: "Back to top", back_top_lo: "ກັບຄືນເທິງສຸດ",
};
