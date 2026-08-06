// สัดส่วนกลางของรูปสินค้า/โลโก้ทั้งระบบ
//
// ต้องใช้ค่านี้ให้ตรงกัน 3 จุด ไม่งั้นภาพที่เห็นจะไม่ตรงกับที่ผู้ใช้ตัดไว้:
//   1. กรอบตัดรูป (aspect ของ Cropper)
//   2. ขนาด canvas ตอนบันทึกไฟล์
//   3. กล่องที่เอาไปแสดงผลทุกที่ (POS, QR ordering, รายการสินค้า)
//
// เดิมทั้งสามจุดกำหนดกันเอง เลยหลุดเป็นคนละค่า (ตัด 1:1 แต่แสดง 4:3 กับ 16:9)
// แล้ว object-cover ตัดซ้ำอีกรอบจนกรอบภาพเลื่อนไปจากที่ตั้งใจ
export const IMAGE_CROP_ASPECT = 4 / 3;

// คลาส Tailwind ของสัดส่วนเดียวกัน — ให้ทุกที่ที่แสดงรูปสินค้าอ้างตัวนี้แทนการพิมพ์เอง
export const IMAGE_CROP_ASPECT_CLASS = "aspect-[4/3]";

export const IMAGE_CROP_OUTPUT_WIDTH = 640;
export const IMAGE_CROP_OUTPUT_HEIGHT = Math.round(IMAGE_CROP_OUTPUT_WIDTH / IMAGE_CROP_ASPECT);

// QR โอนเงินของสาขา — แสดงในกล่อง aspect-square เสมอ (payment-dialog-content, customer-display)
// ต้องแยกจาก IMAGE_CROP_ASPECT ของรูปสินค้า ไม่งั้นตัด 4:3 แล้วไปอัดใน กรอบสี่เหลี่ยมจัตุรัสจนเหลือพื้นที่ขาวรอบ QR
export const QR_CROP_ASPECT = 1;
export const QR_CROP_ASPECT_CLASS = "aspect-square";

export const QR_CROP_OUTPUT_WIDTH = 640;
export const QR_CROP_OUTPUT_HEIGHT = 640;
