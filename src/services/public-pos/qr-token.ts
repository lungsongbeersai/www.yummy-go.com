// ตรวจ prefix ของ token ฝั่ง client ล้วนๆ (ไม่ decode/verify — แค่รู้ว่าต้องยิง
// endpoint ไหน) — ต้องตรงกับ COMPACT_TOKEN_PREFIX ใน back-end/utils/branch_menu_qr_jwt.js
// เก็บเป็นค่าคงที่แยกไว้เพราะ backend/frontend เป็นคนละ repo แชร์ค่ากันไม่ได้ตรงๆ
const BRANCH_MENU_QR_TOKEN_PREFIX = "bq1.";

export function isBranchMenuQrToken(token: string) {
  return token.trim().startsWith(BRANCH_MENU_QR_TOKEN_PREFIX);
}

/*
  Backend ตอบ code 410 จาก tableTokenVerifyDb เมื่อ QR ใบนั้น "จบรอบ" ไปแล้ว —
  ปิดบิล (จ่ายเงินแล้ว), ย้ายโต๊ะ หรือ admin ปิด QR ซึ่ง bump qr_ver +
  ปิด qr_enabled ทิ้ง ต่างจาก token มั่ว/หมดอายุที่เป็น 400 ตรงที่กดลองใหม่
  กี่ครั้งก็ไม่มีวันผ่าน ต้องให้พนักงานพิมพ์ QR ใบใหม่อย่างเดียว
*/
export const PUBLIC_QR_REVOKED_CODE = 410;

export function isPublicQrRevokedError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;

  return (
    Number((error as { statusCode?: unknown }).statusCode) ===
    PUBLIC_QR_REVOKED_CODE
  );
}
