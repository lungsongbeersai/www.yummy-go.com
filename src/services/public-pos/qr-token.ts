// ตรวจ prefix ของ token ฝั่ง client ล้วนๆ (ไม่ decode/verify — แค่รู้ว่าต้องยิง
// endpoint ไหน) — ต้องตรงกับ COMPACT_TOKEN_PREFIX ใน back-end/utils/branch_menu_qr_jwt.js
// เก็บเป็นค่าคงที่แยกไว้เพราะ backend/frontend เป็นคนละ repo แชร์ค่ากันไม่ได้ตรงๆ
const BRANCH_MENU_QR_TOKEN_PREFIX = "bq1.";

export function isBranchMenuQrToken(token: string) {
  return token.trim().startsWith(BRANCH_MENU_QR_TOKEN_PREFIX);
}
