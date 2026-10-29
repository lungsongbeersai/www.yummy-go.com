"use client";

import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";

const en = {
  workspaceMode: "Workspace mode", liveMode: "Live restaurant", trainingMode: "Training",
  title: "Restaurant simulator", subtitle: "YummyGo · POSAll training studio", online: "Connected", disconnected: "Connection interrupted",
  onlineOnly: "Online only · Isolated simulation", connectionHelp: "Transactions and automatic operations are paused. Reconnect to verify server state before continuing.",
  reconnect: "Reconnect", retry: "Retry", start: "Start simulation", pause: "Pause", resume: "Resume", reset: "Reset", save: "Save snapshot", restore: "Restore snapshot",
  session: "Simulation session", newSession: "New session", savedSessions: "Existing sessions", noSession: "Your restaurant, ready for a practice service.",
  startHelp: "Practice with this branch’s real menu and table configuration. All orders, receipts and kitchen tickets stay inside your simulation session.",
  manual: "Manual", auto: "Auto", autoHelp: "Customers and staff advance through server-validated operations while this window is active.", branch: "Branch", employee: "Employee", language: "Language",
  tables: "Tables", allZones: "All zones", all: "All", available: "Available", occupied: "Occupied", guests: "Guests", table: "Table", counter: "Counter orders",
  selectTable: "Select a table to begin", selectHelp: "Click a table in the restaurant or select one from the list. Staff and customers reveal their current activity when selected.",
  openTable: "Open table", openCounter: "New counter bill", customer: "Customer name", assign: "Assign customer", updateGuests: "Update guests", currentBill: "Current bill", bill: "Bill",
  menu: "Menu", search: "Search products…", allCategories: "All categories", add: "Add to bill", options: "Product options", toppings: "Toppings", note: "Item note", quantity: "Quantity", edit: "Edit", cancel: "Cancel item", confirm: "Send to kitchen", cleanup: "Clear my draft items",
  emptyCart: "No items yet", emptyCartHelp: "Choose products from the branch menu to start this order.", subtotal: "Subtotal", itemDiscount: "Item discounts", billDiscount: "Bill discount", service: "Service charge", vat: "VAT", total: "Total", paid: "Paid", balance: "Balance",
  discount: "Discount", percent: "Percent", fixed: "Fixed amount", none: "None", apply: "Apply", move: "Transfer", merge: "Merge", split: "Split bill", target: "Destination", chooseItems: "Select items for a new bill", orderActions: "Table & bill actions",
  payment: "Payment", method: "Method", cash: "Cash", qr: "QR", transfer: "Transfer", currency: "Currency", amount: "Amount tendered", pay: "Complete simulated payment", requestBill: "Request bill", receipt: "Simulated receipt", simulated: "SIMULATION · NOT A TAX RECEIPT",
  history: "Order history", noHistory: "Completed bills appear here.", kitchen: "Kitchen queue", noKitchen: "Kitchen is clear", preparing: "Preparing", ready: "Ready", served: "Served", markReady: "Mark ready", serve: "Serve food", printFailed: "Printer failed", retryPrint: "Retry print", failPrint: "Simulate printer failure", noPrinter: "No mapped printer", printAttempts: "Print attempts",
  timeline: "Activity", sales: "Simulated sales", closedBills: "Closed bills", activeBills: "Active bills", customers: "Customers", activity: "Activity", state: "State", actor: "Restaurant activity", noActivity: "Service events will appear here.",
  loading: "Loading authenticated restaurant state…", loading3d: "Preparing the restaurant…", paused: "Paused", running: "Running", version: "Version", close: "Close", back: "Back", sceneHelp: "Drag to rotate · Scroll or pinch to zoom · Select a table", view3d: "Restaurant", operations: "Operations", webglError: "The 3D view could not start on this device. Table controls and online operations remain available.",
  resetTitle: "Reset this simulation?", resetHelp: "This clears the current simulated service. Your saved snapshot and production transactions are preserved.", restoreTitle: "Restore the saved simulation?", restoreHelp: "The current simulated state will be replaced with the last server-saved snapshot.", cancelTitle: "Cancel this item?", cancelHelp: "The server will validate whether this item can be cancelled.", cleanupTitle: "Clear draft items?", cleanupHelp: "Only eligible unconfirmed items belonging to this employee will be removed.", confirmAction: "Confirm", noProducts: "No matching products", unsupported: "Unavailable in simulator", processing: "Waiting for server…", popupBlocked: "Allow pop-ups to open the 3D Simulator.", saveDone: "Snapshot saved on server", snapshot: "Saved snapshot", selected: "Selected", minutes: "Service tick", stock: "Simulation stock",
  draft: "Draft", confirmed: "Confirmed", cancelled: "Cancelled", paymentHelp: "No real payment or print job is sent. The server validates the bill and configured exchange rates.", branchHelp: "Only server-authorized branches are listed.", noTables: "This branch uses counter orders.", name: "Session name", emptySessions: "No sessions yet", inspect: "Inspect", dismiss: "Dismiss",
};

type Labels = Record<keyof typeof en, string>;
const th: Labels = {
  workspaceMode: "โหมดการใช้งาน", liveMode: "ร้านจริง", trainingMode: "ฝึกใช้งาน",
  title: "เครื่องจำลองร้านอาหาร", subtitle: "YummyGo · ฝึกใช้งาน POSAll", online: "เชื่อมต่อแล้ว", disconnected: "การเชื่อมต่อขัดข้อง",
  onlineOnly: "ออนไลน์เท่านั้น · ข้อมูลจำลองแยกอิสระ", connectionHelp: "หยุดธุรกรรมและการทำงานอัตโนมัติแล้ว เชื่อมต่อใหม่เพื่อตรวจสอบสถานะจากเซิร์ฟเวอร์ก่อนดำเนินการต่อ",
  reconnect: "เชื่อมต่อใหม่", retry: "ลองอีกครั้ง", start: "เริ่มจำลอง", pause: "หยุดชั่วคราว", resume: "ทำต่อ", reset: "เริ่มใหม่", save: "บันทึกสถานะ", restore: "กู้คืนสถานะ",
  session: "เซสชันจำลอง", newSession: "เซสชันใหม่", savedSessions: "เซสชันที่มีอยู่", noSession: "ร้านของคุณพร้อมสำหรับการฝึกบริการแล้ว",
  startHelp: "ฝึกด้วยเมนูและการตั้งค่าโต๊ะจริงของสาขานี้ ออเดอร์ ใบเสร็จ และใบครัวทั้งหมดอยู่ในเซสชันจำลองเท่านั้น",
  manual: "ควบคุมเอง", auto: "อัตโนมัติ", autoHelp: "ลูกค้าและพนักงานทำงานผ่านคำสั่งที่เซิร์ฟเวอร์ตรวจสอบ ขณะที่หน้าต่างนี้เปิดใช้งาน", branch: "สาขา", employee: "พนักงาน", language: "ภาษา",
  tables: "โต๊ะ", allZones: "ทุกโซน", all: "ทั้งหมด", available: "ว่าง", occupied: "มีลูกค้า", guests: "จำนวนลูกค้า", table: "โต๊ะ", counter: "ออเดอร์เคาน์เตอร์",
  selectTable: "เลือกโต๊ะเพื่อเริ่มต้น", selectHelp: "คลิกโต๊ะในร้านหรือเลือกจากรายการ เลือกลูกค้าหรือพนักงานเพื่อดูการทำงานปัจจุบัน",
  openTable: "เปิดโต๊ะ", openCounter: "เปิดบิลเคาน์เตอร์", customer: "ชื่อลูกค้า", assign: "ระบุลูกค้า", updateGuests: "ปรับจำนวนลูกค้า", currentBill: "บิลปัจจุบัน", bill: "บิล",
  menu: "เมนู", search: "ค้นหาสินค้า…", allCategories: "ทุกหมวดหมู่", add: "เพิ่มลงบิล", options: "ตัวเลือกสินค้า", toppings: "ท็อปปิ้ง", note: "หมายเหตุรายการ", quantity: "จำนวน", edit: "แก้ไข", cancel: "ยกเลิกรายการ", confirm: "ส่งเข้าครัว", cleanup: "ล้างรายการร่างของฉัน",
  emptyCart: "ยังไม่มีรายการ", emptyCartHelp: "เลือกสินค้าจากเมนูสาขาเพื่อเริ่มออเดอร์", subtotal: "รวมสินค้า", itemDiscount: "ส่วนลดรายการ", billDiscount: "ส่วนลดบิล", service: "ค่าบริการ", vat: "ภาษีมูลค่าเพิ่ม", total: "ยอดรวม", paid: "ชำระแล้ว", balance: "ยอดคงเหลือ",
  discount: "ส่วนลด", percent: "เปอร์เซ็นต์", fixed: "จำนวนเงิน", none: "ไม่มี", apply: "ใช้ส่วนลด", move: "ย้ายโต๊ะ", merge: "รวมบิล", split: "แยกบิล", target: "ปลายทาง", chooseItems: "เลือกรายการสำหรับบิลใหม่", orderActions: "จัดการโต๊ะและบิล",
  payment: "ชำระเงิน", method: "วิธีชำระ", cash: "เงินสด", qr: "QR", transfer: "โอนเงิน", currency: "สกุลเงิน", amount: "จำนวนเงินที่รับ", pay: "ยืนยันชำระเงินจำลอง", requestBill: "เรียกเก็บเงิน", receipt: "ใบเสร็จจำลอง", simulated: "ข้อมูลจำลอง · ไม่ใช่ใบกำกับภาษี",
  history: "ประวัติออเดอร์", noHistory: "บิลที่ปิดแล้วจะแสดงที่นี่", kitchen: "คิวครัว", noKitchen: "ไม่มีออเดอร์ค้างในครัว", preparing: "กำลังเตรียม", ready: "พร้อมเสิร์ฟ", served: "เสิร์ฟแล้ว", markReady: "อาหารพร้อม", serve: "เสิร์ฟอาหาร", printFailed: "พิมพ์ไม่สำเร็จ", retryPrint: "ลองพิมพ์ใหม่", failPrint: "จำลองเครื่องพิมพ์ขัดข้อง", noPrinter: "ไม่มีเครื่องพิมพ์ที่ผูกไว้", printAttempts: "จำนวนครั้งที่พิมพ์",
  timeline: "เหตุการณ์", sales: "ยอดขายจำลอง", closedBills: "บิลที่ปิดแล้ว", activeBills: "บิลที่เปิดอยู่", customers: "ลูกค้า", activity: "การทำงาน", state: "สถานะ", actor: "กิจกรรมในร้าน", noActivity: "เหตุการณ์บริการจะแสดงที่นี่",
  loading: "กำลังโหลดสถานะร้านที่ยืนยันตัวตนแล้ว…", loading3d: "กำลังเตรียมร้านอาหาร…", paused: "หยุดชั่วคราว", running: "กำลังทำงาน", version: "เวอร์ชัน", close: "ปิด", back: "กลับ", sceneHelp: "ลากเพื่อหมุน · เลื่อนหรือจีบเพื่อซูม · เลือกโต๊ะ", view3d: "ร้านอาหาร", operations: "การดำเนินงาน", webglError: "อุปกรณ์นี้เปิดภาพ 3D ไม่สำเร็จ ยังใช้รายการโต๊ะและทำรายการออนไลน์ได้",
  resetTitle: "เริ่มการจำลองนี้ใหม่?", resetHelp: "ล้างการบริการจำลองปัจจุบัน โดยเก็บสถานะที่บันทึกไว้และไม่กระทบธุรกรรมจริง", restoreTitle: "กู้คืนสถานะที่บันทึกไว้?", restoreHelp: "แทนที่การจำลองปัจจุบันด้วยสถานะล่าสุดที่บันทึกบนเซิร์ฟเวอร์", cancelTitle: "ยกเลิกรายการนี้?", cancelHelp: "เซิร์ฟเวอร์จะตรวจสอบว่าสามารถยกเลิกรายการนี้ได้หรือไม่", cleanupTitle: "ล้างรายการร่าง?", cleanupHelp: "ลบเฉพาะรายการที่ยังไม่ยืนยันและเป็นของพนักงานนี้ตามสิทธิ์", confirmAction: "ยืนยัน", noProducts: "ไม่พบสินค้า", unsupported: "ยังไม่รองรับในการจำลอง", processing: "กำลังรอเซิร์ฟเวอร์…", popupBlocked: "อนุญาตหน้าต่างป๊อปอัปเพื่อเปิด 3D Simulator", saveDone: "บันทึกสถานะบนเซิร์ฟเวอร์แล้ว", snapshot: "สถานะที่บันทึก", selected: "เลือกแล้ว", minutes: "จังหวะบริการ", stock: "สต็อกจำลอง",
  draft: "ร่าง", confirmed: "ยืนยันแล้ว", cancelled: "ยกเลิกแล้ว", paymentHelp: "ไม่มีการชำระเงินจริงหรือส่งงานพิมพ์จริง เซิร์ฟเวอร์ตรวจสอบบิลและอัตราแลกเปลี่ยนที่ตั้งค่าไว้", branchHelp: "แสดงเฉพาะสาขาที่เซิร์ฟเวอร์อนุญาต", noTables: "สาขานี้ใช้ออเดอร์เคาน์เตอร์", name: "ชื่อเซสชัน", emptySessions: "ยังไม่มีเซสชัน", inspect: "ดูรายละเอียด", dismiss: "ปิดข้อความ",
};

const la: Labels = {
  workspaceMode: "ຮູບແບບການໃຊ້ງານ", liveMode: "ຮ້ານຈິງ", trainingMode: "ຝຶກໃຊ້ງານ",
  title: "ຈຳລອງຮ້ານອາຫານ", subtitle: "YummyGo · ຝຶກໃຊ້ POSAll", online: "ເຊື່ອມຕໍ່ແລ້ວ", disconnected: "ການເຊື່ອມຕໍ່ຂັດຂ້ອງ",
  onlineOnly: "ອອນລາຍເທົ່ານັ້ນ · ຂໍ້ມູນຈຳລອງແຍກຕ່າງຫາກ", connectionHelp: "ຢຸດທຸລະກຳແລະການເຮັດວຽກອັດຕະໂນມັດແລ້ວ ເຊື່ອມຕໍ່ໃໝ່ເພື່ອກວດສອບສະຖານະຈາກເຊີບເວີ",
  reconnect: "ເຊື່ອມຕໍ່ໃໝ່", retry: "ລອງໃໝ່", start: "ເລີ່ມຈຳລອງ", pause: "ພັກຊົ່ວຄາວ", resume: "ສືບຕໍ່", reset: "ເລີ່ມໃໝ່", save: "ບັນທຶກສະຖານະ", restore: "ກູ້ຄືນສະຖານະ",
  session: "ເຊສຊັນຈຳລອງ", newSession: "ເຊສຊັນໃໝ່", savedSessions: "ເຊສຊັນທີ່ມີ", noSession: "ຮ້ານຂອງທ່ານພ້ອມສຳລັບການຝຶກບໍລິການແລ້ວ",
  startHelp: "ຝຶກດ້ວຍເມນູແລະໂຕະຈິງຂອງສາຂາ ອໍເດີ ໃບບິນ ແລະໃບຄົວທັງໝົດຢູ່ໃນເຊສຊັນຈຳລອງເທົ່ານັ້ນ",
  manual: "ຄວບຄຸມເອງ", auto: "ອັດຕະໂນມັດ", autoHelp: "ລູກຄ້າແລະພະນັກງານເຮັດວຽກຜ່ານຄຳສັ່ງທີ່ເຊີບເວີກວດສອບ ເມື່ອໜ້າຕ່າງນີ້ໃຊ້ງານ", branch: "ສາຂາ", employee: "ພະນັກງານ", language: "ພາສາ",
  tables: "ໂຕະ", allZones: "ທຸກໂຊນ", all: "ທັງໝົດ", available: "ວ່າງ", occupied: "ມີລູກຄ້າ", guests: "ຈຳນວນລູກຄ້າ", table: "ໂຕະ", counter: "ອໍເດີເຄົາເຕີ",
  selectTable: "ເລືອກໂຕະເພື່ອເລີ່ມ", selectHelp: "ຄລິກໂຕະໃນຮ້ານຫຼືເລືອກຈາກລາຍການ ເລືອກລູກຄ້າຫຼືພະນັກງານເພື່ອເບິ່ງກິດຈະກຳ",
  openTable: "ເປີດໂຕະ", openCounter: "ເປີດບິນເຄົາເຕີ", customer: "ຊື່ລູກຄ້າ", assign: "ກຳນົດລູກຄ້າ", updateGuests: "ປັບຈຳນວນລູກຄ້າ", currentBill: "ບິນປັດຈຸບັນ", bill: "ບິນ",
  menu: "ເມນູ", search: "ຄົ້ນຫາສິນຄ້າ…", allCategories: "ທຸກໝວດໝູ່", add: "ເພີ່ມໃສ່ບິນ", options: "ຕົວເລືອກສິນຄ້າ", toppings: "ທັອບປິ້ງ", note: "ໝາຍເຫດລາຍການ", quantity: "ຈຳນວນ", edit: "ແກ້ໄຂ", cancel: "ຍົກເລີກລາຍການ", confirm: "ສົ່ງເຂົ້າຄົວ", cleanup: "ລ້າງລາຍການຮ່າງຂອງຂ້ອຍ",
  emptyCart: "ຍັງບໍ່ມີລາຍການ", emptyCartHelp: "ເລືອກສິນຄ້າຈາກເມນູສາຂາເພື່ອເລີ່ມອໍເດີ", subtotal: "ລວມສິນຄ້າ", itemDiscount: "ສ່ວນຫຼຸດລາຍການ", billDiscount: "ສ່ວນຫຼຸດບິນ", service: "ຄ່າບໍລິການ", vat: "ອາກອນ", total: "ຍອດລວມ", paid: "ຊຳລະແລ້ວ", balance: "ຍອດຄົງເຫຼືອ",
  discount: "ສ່ວນຫຼຸດ", percent: "ເປີເຊັນ", fixed: "ຈຳນວນເງິນ", none: "ບໍ່ມີ", apply: "ໃຊ້ສ່ວນຫຼຸດ", move: "ຍ້າຍໂຕະ", merge: "ລວມບິນ", split: "ແຍກບິນ", target: "ປາຍທາງ", chooseItems: "ເລືອກລາຍການສຳລັບບິນໃໝ່", orderActions: "ຈັດການໂຕະແລະບິນ",
  payment: "ຊຳລະເງິນ", method: "ວິທີຊຳລະ", cash: "ເງິນສົດ", qr: "QR", transfer: "ໂອນເງິນ", currency: "ສະກຸນເງິນ", amount: "ຈຳນວນເງິນທີ່ຮັບ", pay: "ຢືນຢັນຊຳລະເງິນຈຳລອງ", requestBill: "ເອີ້ນເກັບເງິນ", receipt: "ໃບບິນຈຳລອງ", simulated: "ຂໍ້ມູນຈຳລອງ · ບໍ່ແມ່ນໃບບິນອາກອນ",
  history: "ປະຫວັດອໍເດີ", noHistory: "ບິນທີ່ປິດແລ້ວຈະສະແດງຢູ່ນີ້", kitchen: "ຄິວຄົວ", noKitchen: "ບໍ່ມີອໍເດີຄ້າງໃນຄົວ", preparing: "ກຳລັງກຽມ", ready: "ພ້ອມເສີບ", served: "ເສີບແລ້ວ", markReady: "ອາຫານພ້ອມ", serve: "ເສີບອາຫານ", printFailed: "ພິມບໍ່ສຳເລັດ", retryPrint: "ລອງພິມໃໝ່", failPrint: "ຈຳລອງເຄື່ອງພິມຂັດຂ້ອງ", noPrinter: "ບໍ່ມີເຄື່ອງພິມທີ່ຜູກໄວ້", printAttempts: "ຈຳນວນຄັ້ງທີ່ພິມ",
  timeline: "ເຫດການ", sales: "ຍອດຂາຍຈຳລອງ", closedBills: "ບິນທີ່ປິດແລ້ວ", activeBills: "ບິນທີ່ເປີດຢູ່", customers: "ລູກຄ້າ", activity: "ການເຮັດວຽກ", state: "ສະຖານະ", actor: "ກິດຈະກຳໃນຮ້ານ", noActivity: "ເຫດການບໍລິການຈະສະແດງຢູ່ນີ້",
  loading: "ກຳລັງໂຫຼດສະຖານະຮ້ານທີ່ຢືນຢັນແລ້ວ…", loading3d: "ກຳລັງກຽມຮ້ານອາຫານ…", paused: "ພັກຊົ່ວຄາວ", running: "ກຳລັງເຮັດວຽກ", version: "ເວີຊັນ", close: "ປິດ", back: "ກັບ", sceneHelp: "ລາກເພື່ອໝຸນ · ເລື່ອນຫຼືຈີບເພື່ອຊູມ · ເລືອກໂຕະ", view3d: "ຮ້ານອາຫານ", operations: "ການດຳເນີນງານ", webglError: "ອຸປະກອນນີ້ເປີດ 3D ບໍ່ສຳເລັດ ຍັງໃຊ້ລາຍການໂຕະແລະເຮັດລາຍການອອນລາຍໄດ້",
  resetTitle: "ເລີ່ມການຈຳລອງນີ້ໃໝ່?", resetHelp: "ລ້າງການບໍລິການຈຳລອງປັດຈຸບັນ ໂດຍເກັບສະຖານະທີ່ບັນທຶກໄວ້ແລະບໍ່ກະທົບທຸລະກຳຈິງ", restoreTitle: "ກູ້ຄືນສະຖານະທີ່ບັນທຶກ?", restoreHelp: "ແທນທີ່ສະຖານະຈຳລອງດ້ວຍສະຖານະລ່າສຸດທີ່ບັນທຶກໃນເຊີບເວີ", cancelTitle: "ຍົກເລີກລາຍການນີ້?", cancelHelp: "ເຊີບເວີຈະກວດສອບວ່າລາຍການນີ້ຍົກເລີກໄດ້ຫຼືບໍ່", cleanupTitle: "ລ້າງລາຍການຮ່າງ?", cleanupHelp: "ລຶບສະເພາະລາຍການທີ່ຍັງບໍ່ຢືນຢັນແລະເປັນຂອງພະນັກງານນີ້", confirmAction: "ຢືນຢັນ", noProducts: "ບໍ່ພົບສິນຄ້າ", unsupported: "ຍັງບໍ່ຮອງຮັບໃນການຈຳລອງ", processing: "ກຳລັງລໍຖ້າເຊີບເວີ…", popupBlocked: "ອະນຸຍາດໜ້າຕ່າງປັອບອັບເພື່ອເປີດ 3D Simulator", saveDone: "ບັນທຶກສະຖານະໃນເຊີບເວີແລ້ວ", snapshot: "ສະຖານະທີ່ບັນທຶກ", selected: "ເລືອກແລ້ວ", minutes: "ຈັງຫວະບໍລິການ", stock: "ສະຕັອກຈຳລອງ",
  draft: "ຮ່າງ", confirmed: "ຢືນຢັນແລ້ວ", cancelled: "ຍົກເລີກແລ້ວ", paymentHelp: "ບໍ່ມີການຊຳລະເງິນຈິງຫຼືສົ່ງງານພິມຈິງ ເຊີບເວີກວດສອບບິນແລະອັດຕາແລກປ່ຽນທີ່ຕັ້ງຄ່າ", branchHelp: "ສະແດງສະເພາະສາຂາທີ່ເຊີບເວີອະນຸຍາດ", noTables: "ສາຂານີ້ໃຊ້ອໍເດີເຄົາເຕີ", name: "ຊື່ເຊສຊັນ", emptySessions: "ຍັງບໍ່ມີເຊສຊັນ", inspect: "ເບິ່ງລາຍລະອຽດ", dismiss: "ປິດຂໍ້ຄວາມ",
};

// Simulator languages are scoped to this window; Thai does not change the
// existing application's Lao/English API-language or preference contracts.
export const simulatorI18n = createInstance();
const extras = {
  en: {
    dashboard: { darkTheme: "Dark theme", lightTheme: "Light theme" },
    callStaff: "Call staff", promotion: { free: "free" },
    visits: { title: "Simulated table visit", help: "Practice QR and visit-code ordering inside this authenticated session. These codes cannot open production tables.", tableQR: "Table QR", customerOrder: "Customer ordering", create: "Create simulated QR", revoke: "Revoke visit", revokeHelp: "The current code will stop accepting simulated customer orders.", inactive: "This table has no active simulation visit.", scans: "Scans", code: "Simulation QR token or visit code", scan: "Scan code", scanHelp: "Scan a valid simulation code to open the customer menu.", submit: "Submit customer order", submitted: "Awaiting staff confirmation" },
    scene: { kitchen: "Kitchen", cashier: "Cashier", entrance: "Entrance", unavailable: "3D graphics are unavailable. Use the table controls to continue.", controls: "Drag to rotate · Scroll to zoom · Select a table or person", stopFollowing: "Stop following", recovering: "Graphics paused. Waiting for the browser to restore graphics." },
    roles: { customer: "Customer", waiter: "Waiter", chef: "Chef", cashier: "Cashier" },
    states: { entering: "Entering", waiting: "Waiting for seating", walking: "Walking to table", seated: "Seated", browsing: "Browsing menu", waiting_food: "Waiting for food", eating: "Eating", requesting_bill: "Requesting bill", paying: "Paying", leaving: "Leaving", left: "Left", welcoming: "Welcoming", serving: "Serving", preparing: "Preparing", ready: "Ready", reviewing: "Reviewing bills", billing: "Billing" },
    deposits: { title: "Customers & product deposits", help: "Isolated customer profiles and product-quantity deposits. Withdrawals carry no new charge.", newCustomer: "New customer", create: "Deposit products", withdraw: "Withdraw", empty: "No product deposits yet", phone: "Phone", expires: "Expires", linkBill: "Link to bill (optional)", withdrawals: "Withdrawal history", ACTIVE: "Active", WITHDRAWN: "Withdrawn", EXPIRED: "Expired", notConfigured: "Set product-deposit expiry in the store configuration to enable deposits.", memberCode: "Member code", editCustomer: "Edit customer" },
  },
  th: {
    dashboard: { darkTheme: "ธีมมืด", lightTheme: "ธีมสว่าง" },
    callStaff: "เรียกพนักงาน", promotion: { free: "รายการแถม" },
    visits: { title: "การเข้าใช้โต๊ะจำลอง", help: "ฝึกสั่งอาหารด้วย QR และรหัสเข้าโต๊ะในเซสชันที่ยืนยันตัวตน รหัสนี้ใช้เปิดโต๊ะจริงไม่ได้", tableQR: "QR โต๊ะ", customerOrder: "ลูกค้าสั่งอาหาร", create: "สร้าง QR จำลอง", revoke: "ยกเลิกรหัสเข้าโต๊ะ", revokeHelp: "รหัสปัจจุบันจะไม่รับออเดอร์จำลองจากลูกค้าอีก", inactive: "โต๊ะนี้ไม่มีรหัสเข้าใช้จำลองที่ใช้งานอยู่", scans: "สแกนแล้ว", code: "โทเคน QR หรือรหัสเข้าโต๊ะจำลอง", scan: "สแกนรหัส", scanHelp: "สแกนรหัสจำลองที่ใช้งานได้เพื่อเปิดเมนูลูกค้า", submit: "ส่งออเดอร์ลูกค้า", submitted: "รอพนักงานยืนยัน" },
    scene: { kitchen: "ครัว", cashier: "แคชเชียร์", entrance: "ทางเข้า", unavailable: "ไม่สามารถเปิดภาพ 3D ได้ ใช้รายการโต๊ะเพื่อดำเนินการต่อ", controls: "ลากเพื่อหมุน · เลื่อนเพื่อซูม · เลือกโต๊ะหรือตัวละคร", stopFollowing: "หยุดติดตาม", recovering: "พักภาพกราฟิก รอเบราว์เซอร์กู้คืนระบบกราฟิก" },
    roles: { customer: "ลูกค้า", waiter: "พนักงานเสิร์ฟ", chef: "พ่อครัว", cashier: "แคชเชียร์" },
    states: { entering: "กำลังเข้าร้าน", waiting: "รอที่นั่ง", walking: "กำลังเดินไปโต๊ะ", seated: "นั่งแล้ว", browsing: "เลือกเมนู", waiting_food: "รออาหาร", eating: "รับประทานอาหาร", requesting_bill: "เรียกเก็บเงิน", paying: "ชำระเงิน", leaving: "กำลังออกจากร้าน", left: "ออกจากร้านแล้ว", welcoming: "ต้อนรับลูกค้า", serving: "เสิร์ฟอาหาร", preparing: "เตรียมอาหาร", ready: "พร้อม", reviewing: "ตรวจสอบบิล", billing: "คิดเงิน" },
    deposits: { title: "ลูกค้าและการฝากสินค้า", help: "ข้อมูลลูกค้าและการฝากจำนวนสินค้าแยกในการจำลอง การถอนสินค้าไม่มีค่าใช้จ่ายเพิ่ม", newCustomer: "เพิ่มลูกค้า", create: "ฝากสินค้า", withdraw: "ถอนสินค้า", empty: "ยังไม่มีสินค้าฝาก", phone: "โทรศัพท์", expires: "หมดอายุ", linkBill: "เชื่อมกับบิล (ไม่บังคับ)", withdrawals: "ประวัติถอนสินค้า", ACTIVE: "มีสินค้าคงเหลือ", WITHDRAWN: "ถอนครบแล้ว", EXPIRED: "หมดอายุ", notConfigured: "ตั้งค่าจำนวนวันหมดอายุของสินค้าฝากที่ร้านก่อนใช้งาน", memberCode: "รหัสสมาชิก", editCustomer: "แก้ไขลูกค้า" },
  },
  la: {
    dashboard: { darkTheme: "ຮູບແບບມືດ", lightTheme: "ຮູບແບບສະຫວ່າງ" },
    callStaff: "ເອີ້ນພະນັກງານ", promotion: { free: "ລາຍການແຖມ" },
    visits: { title: "ການເຂົ້າໃຊ້ໂຕະຈຳລອງ", help: "ຝຶກສັ່ງອາຫານດ້ວຍ QR ແລະລະຫັດເຂົ້າໂຕະໃນເຊສຊັນທີ່ຢືນຢັນຕົວຕົນ ລະຫັດນີ້ເປີດໂຕະຈິງບໍ່ໄດ້", tableQR: "QR ໂຕະ", customerOrder: "ລູກຄ້າສັ່ງອາຫານ", create: "ສ້າງ QR ຈຳລອງ", revoke: "ຍົກເລີກລະຫັດເຂົ້າໂຕະ", revokeHelp: "ລະຫັດປັດຈຸບັນຈະບໍ່ຮັບອໍເດີຈຳລອງຈາກລູກຄ້າອີກ", inactive: "ໂຕະນີ້ບໍ່ມີລະຫັດເຂົ້າໃຊ້ຈຳລອງທີ່ໃຊ້ງານ", scans: "ສະແກນແລ້ວ", code: "ໂທເຄນ QR ຫຼືລະຫັດເຂົ້າໂຕະຈຳລອງ", scan: "ສະແກນລະຫັດ", scanHelp: "ສະແກນລະຫັດຈຳລອງທີ່ໃຊ້ງານເພື່ອເປີດເມນູລູກຄ້າ", submit: "ສົ່ງອໍເດີລູກຄ້າ", submitted: "ລໍຖ້າພະນັກງານຢືນຢັນ" },
    scene: { kitchen: "ຄົວ", cashier: "ແຄັດເຊຍ", entrance: "ທາງເຂົ້າ", unavailable: "ບໍ່ສາມາດເປີດ 3D ໄດ້ ໃຊ້ລາຍການໂຕະເພື່ອສືບຕໍ່", controls: "ລາກເພື່ອໝຸນ · ເລື່ອນເພື່ອຊູມ · ເລືອກໂຕະຫຼືຕົວລະຄອນ", stopFollowing: "ຢຸດຕິດຕາມ", recovering: "ພັກກຣາຟິກ ລໍຖ້າເບຣົາເຊີກູ້ຄືນກຣາຟິກ" },
    roles: { customer: "ລູກຄ້າ", waiter: "ພະນັກງານເສີບ", chef: "ພໍ່ຄົວ", cashier: "ແຄັດເຊຍ" },
    states: { entering: "ກຳລັງເຂົ້າຮ້ານ", waiting: "ລໍຖ້າບ່ອນນັ່ງ", walking: "ກຳລັງຍ່າງໄປໂຕະ", seated: "ນັ່ງແລ້ວ", browsing: "ເລືອກເມນູ", waiting_food: "ລໍຖ້າອາຫານ", eating: "ກິນອາຫານ", requesting_bill: "ເອີ້ນເກັບເງິນ", paying: "ຊຳລະເງິນ", leaving: "ກຳລັງອອກຈາກຮ້ານ", left: "ອອກຈາກຮ້ານແລ້ວ", welcoming: "ຕ້ອນຮັບລູກຄ້າ", serving: "ເສີບອາຫານ", preparing: "ກຽມອາຫານ", ready: "ພ້ອມ", reviewing: "ກວດສອບບິນ", billing: "ຄິດເງິນ" },
    deposits: { title: "ລູກຄ້າແລະການຝາກສິນຄ້າ", help: "ຂໍ້ມູນລູກຄ້າແລະການຝາກຈຳນວນສິນຄ້າແຍກໃນການຈຳລອງ ການຖອນບໍ່ມີຄ່າໃຊ້ຈ່າຍເພີ່ມ", newCustomer: "ເພີ່ມລູກຄ້າ", create: "ຝາກສິນຄ້າ", withdraw: "ຖອນສິນຄ້າ", empty: "ຍັງບໍ່ມີສິນຄ້າຝາກ", phone: "ໂທລະສັບ", expires: "ໝົດອາຍຸ", linkBill: "ເຊື່ອມກັບບິນ (ບໍ່ບັງຄັບ)", withdrawals: "ປະຫວັດຖອນສິນຄ້າ", ACTIVE: "ມີສິນຄ້າຄົງເຫຼືອ", WITHDRAWN: "ຖອນຄົບແລ້ວ", EXPIRED: "ໝົດອາຍຸ", notConfigured: "ຕັ້ງຄ່າຈຳນວນວັນໝົດອາຍຸສິນຄ້າຝາກຂອງຮ້ານກ່ອນໃຊ້ງານ", memberCode: "ລະຫັດສະມາຊິກ", editCustomer: "ແກ້ໄຂລູກຄ້າ" },
  },
};
void simulatorI18n.use(initReactI18next).init({
  lng: "en", fallbackLng: "en", supportedLngs: ["en", "la", "th"],
  resources: { en: { simulator: { ...en, ...extras.en } }, la: { simulator: { ...la, ...extras.la } }, th: { simulator: { ...th, ...extras.th } } },
  ns: ["simulator"], defaultNS: "simulator", initAsync: false,
  interpolation: { escapeValue: false }, react: { useSuspense: false },
});

export type SimulatorLanguage = "en" | "la" | "th";
