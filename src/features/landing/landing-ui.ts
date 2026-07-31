// ข้อความ UI ทั้งหมดของหน้า landing (ปุ่ม/หัวข้อ/ป้ายกำกับ) — สองภาษา
// เนื้อหาผลิตภัณฑ์อยู่ที่ landing-data.ts
// ทิศทาง import เป็นทางเดียว: ไฟล์นี้ -> landing-data.ts เท่านั้น (ห้ามย้อนกลับ)

import type { LocalizedText } from "./landing-data";

export const landingUi = {
  navCta: { en: "Get a Free Trial", la: "ຂໍທົດລອງໃຊ້ຟຣີ" },
  btnLogin: { en: "Sign In", la: "ເຂົ້າສູ່ລະບົບ" },
  heroBadge: {
    en: "Restaurant POS · Works on every device",
    la: "ລະບົບ POS ຮ້ານອາຫານ · ໃຊ້ໄດ້ທຸກອຸປະກອນ"
  },
  btnTrial: { en: "Get a Free Trial", la: "ຂໍທົດລອງໃຊ້ຟຣີ" },
  btnFeatures: { en: "See Features", la: "ເບິ່ງຟີເຈີ" },
  btnContact: { en: "Talk to us", la: "ລົມກັບພວກເຮົາ" },
  aboutKicker: { en: "About Yummy-go", la: "ກ່ຽວກັບ Yummy-go" },
  aboutTitle: {
    en: "Made for how restaurants actually run",
    la: "ສ້າງມາໃຫ້ຕົງກັບວິທີດຳເນີນງານຂອງຮ້ານອາຫານຈິງ"
  },
  featuresKicker: { en: "Features", la: "ຟີເຈີ" },
  featuresTitle: { en: "Everything your shop needs", la: "ທຸກຢ່າງທີ່ຮ້ານຂອງທ່ານຕ້ອງການ" },
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
    en: "Not sure which plan? Ask for a trial first.",
    la: "ຍັງບໍ່ແນ່ໃຈວ່າແພັກເກັດໃດ? ຂໍທົດລອງໃຊ້ກ່ອນໄດ້."
  },
  pricingHelpCta: { en: "Ask for a trial", la: "ຂໍທົດລອງໃຊ້" },
  btnLoginNow: { en: "Sign In", la: "ເຂົ້າສູ່ລະບົບ" },
  btnAskTrial: { en: "Ask for a trial", la: "ຂໍທົດລອງໃຊ້" },
  platformsKicker: { en: "Platforms", la: "ແພລດຟອມ" },
  platformsTitle: {
    en: "Use it wherever you work",
    la: "ໃຊ້ໄດ້ທຸກບ່ອນທີ່ທ່ານເຮັດວຽກ"
  },
  stepsKicker: { en: "Getting started", la: "ເລີ່ມຕົ້ນໃຊ້ງານ" },
  stepsTitle: { en: "Up and running in four steps", la: "ພ້ອມໃຊ້ງານໃນສີ່ຂັ້ນຕອນ" },
  tutorialsKicker: { en: "Tutorials", la: "ວິດີໂອສອນ" },
  tutorialsTitle: { en: "Tutorial Videos", la: "ວິດີໂອສອນ" },
  tutorialsSubtitle: {
    en: "Learn how to run your shop on Yummy-go, step by step.",
    la: "ຮຽນຮູ້ວິທີດຳເນີນຮ້ານດ້ວຍ Yummy-go ເທື່ອລະຂັ້ນຕອນ."
  },
  testimonialsKicker: { en: "Customers", la: "ລູກຄ້າ" },
  testimonialsTitle: { en: "What shop owners say", la: "ເຈົ້າຂອງຮ້ານເວົ້າແນວໃດ" },
  faqKicker: { en: "FAQ", la: "ຄຳຖາມພົບບ່ອຍ" },
  faqTitle: { en: "Questions before you start", la: "ຄຳຖາມກ່ອນເລີ່ມໃຊ້" },
  faqMoreQuestions: { en: "Still have a question?", la: "ຍັງມີຄຳຖາມອີກບໍ?" },
  faqMoreCta: { en: "Ask us", la: "ຖາມພວກເຮົາ" },
  trialKicker: { en: "Free trial", la: "ທົດລອງໃຊ້ຟຣີ" },
  trialTitle: { en: "Try Yummy-go at your shop", la: "ລອງໃຊ້ Yummy-go ທີ່ຮ້ານຂອງທ່ານ" },
  trialSubtitle: {
    en: "Tell us about your shop and we'll set you up.",
    la: "ບອກພວກເຮົາກ່ຽວກັບຮ້ານຂອງທ່ານ ແລ້ວພວກເຮົາຈະຕັ້ງໃຫ້."
  },
  trialCardTitle: { en: "Contact us directly", la: "ຕິດຕໍ່ພວກເຮົາໂດຍກົງ" },
  trialUnavailable: { en: "Opening soon", la: "ກຳລັງເປີດຮັບໄວໆນີ້" },
  trialIntro: { en: "Yummy-go trial request", la: "ຂໍທົດລອງໃຊ້ Yummy-go" },
  fieldShopName: { en: "Shop name", la: "ຊື່ຮ້ານ" },
  fieldContactName: { en: "Your name", la: "ຊື່ຜູ້ຕິດຕໍ່" },
  fieldPhone: { en: "Phone", la: "ເບີໂທ" },
  fieldShopType: { en: "Shop type", la: "ປະເພດຮ້ານ" },
  fieldBranchCount: { en: "Number of branches", la: "ຈຳນວນສາຂາ" },
  fieldRequired: { en: "Required", la: "ຕ້ອງໃສ່" },
  shopTypeRestaurant: { en: "Restaurant", la: "ຮ້ານອາຫານ" },
  shopTypeCafe: { en: "Café", la: "ຄາເຟ່" },
  shopTypeDrinks: { en: "Drinks shop", la: "ຮ້ານເຄື່ອງດື່ມ" },
  shopTypeOther: { en: "Other", la: "ອື່ນໆ" },
  btnRequestTrial: { en: "Send request", la: "ສົ່ງຄຳຂໍ" },
  contactEmailLabel: { en: "Email", la: "ອີເມວ" },
  contactPhoneLabel: { en: "Phone", la: "ເບີໂທ" },
  contactAddressLabel: { en: "Address", la: "ທີ່ຢູ່" },
  contactSocialLabel: { en: "Social media", la: "ໂຊຊຽວມີເດຍ" },
  footerFeatures: { en: "Features", la: "ຟີເຈີ" },
  footerPlatforms: { en: "Platforms", la: "ແພລດຟອມ" },
  footerTrial: { en: "Free trial", la: "ທົດລອງໃຊ້ຟຣີ" },
  footerDesc: {
    en: "A complete POS for restaurants — counter, tables, QR ordering, and reports.",
    la: "ລະບົບ POS ຄົບຊຸດສຳລັບຮ້ານອາຫານ — ເຄົາເຕີ, ໂຕະ, ສັ່ງຜ່ານ QR ແລະ ລາຍງານ."
  },
  copyrightSuffix: { en: "All rights reserved.", la: "ສະຫງວນລິຂະສິດ." },
  formSent: {
    en: "Thanks — we'll get back to you shortly.",
    la: "ຂອບໃຈ — ພວກເຮົາຈະຕິດຕໍ່ກັບໄປໄວໆນີ້."
  },
  scrollHint: { en: "Scroll to explore", la: "ເລື່ອນລົງເພື່ອສຳຫຼວດ" },
  interactHint: { en: "Click or drag the background", la: "ຄລິກ ຫຼື ລາກພື້ນຫຼັງ" },
  statFeatures: { en: "Features", la: "ຟີເຈີ" },
  statPlatforms: { en: "Platforms", la: "ແພລດຟອມ" },
  statReports: { en: "Report types", la: "ຊະນິດລາຍງານ" },
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
