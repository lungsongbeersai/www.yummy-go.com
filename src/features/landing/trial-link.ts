// ช่องทางติดต่อของหน้า landing และตรรกะประกอบลิงก์ "ขอทดลองใช้"
//
// backend ยังไม่มี endpoint สมัครร้านใหม่แบบ self-serve (/api/v1/register/create
// ต้อง auth และสร้างพนักงานในร้านที่มีอยู่แล้ว) ฟอร์มจึงส่งผู้ใช้ออกไปช่องทางแชทแทน
// เมื่อ backend พร้อม เปลี่ยนเฉพาะ handler ตอน submit เป็นเรียก service ใหม่ได้เลย

export interface LandingContact {
  email: string;
  phone: string;
  line: string;
  whatsapp: string;
  facebook: string;
  address: string;
}

export interface TrialRequest {
  shopName: string;
  contactName: string;
  phone: string;
  shopType: string;
  branchCount: string;
}

export interface TrialMessageLabels {
  intro: string;
  shopName: string;
  contactName: string;
  phone: string;
  shopType: string;
  branchCount: string;
}

// ต้องกรอกอย่างน้อยหนึ่งช่องทาง (line / whatsapp / email) ก่อน deploy
// ไม่งั้นปุ่มขอทดลองใช้จะถูก disable ตาม buildTrialLink ที่คืน null
export const landingContact: LandingContact = {
  email: "",
  phone: "",
  line: "", // LINE Official Account ID เช่น @yummygo
  whatsapp: "", // เบอร์รูปแบบสากล เช่น 8562012345678
  facebook: "", // URL เต็ม
  address: ""
};

export function buildTrialMessage(request: TrialRequest, labels: TrialMessageLabels): string {
  return [
    labels.intro,
    `${labels.shopName}: ${request.shopName}`,
    `${labels.contactName}: ${request.contactName}`,
    `${labels.phone}: ${request.phone}`,
    `${labels.shopType}: ${request.shopType}`,
    `${labels.branchCount}: ${request.branchCount}`
  ].join("\n");
}

/** คืน null เมื่อยังไม่ตั้งค่าช่องทางใดเลย — ผู้เรียกใช้ค่านี้ปิดปุ่มส่ง */
export function buildTrialLink(
  contact: LandingContact,
  message: string,
  subject: string
): string | null {
  const text = encodeURIComponent(message);

  const line = contact.line.trim();
  if (line) return `https://line.me/R/oaMessage/${encodeURIComponent(line)}/?${text}`;

  // wa.me รับเฉพาะตัวเลข — ตัดเครื่องหมาย + และช่องว่างที่มักติดมากับเบอร์ที่คนกรอก
  const whatsapp = contact.whatsapp.replace(/\D/g, "");
  if (whatsapp) return `https://wa.me/${whatsapp}?text=${text}`;

  const email = contact.email.trim();
  if (email) return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${text}`;

  return null;
}
