export interface OfflineDialogState {
  open: boolean;
  dismissedForThisOutage: boolean;
}

export const initialOfflineDialogState: OfflineDialogState = {
  open: false,
  dismissedForThisOutage: false,
};

// เรียกทุกครั้งที่ offlineSession เปลี่ยนค่า — ปิด popup และ reset การ dismiss ทันทีที่กลับมา
// ออนไลน์จริง (offlineSession -> false) เพื่อให้รอบออฟไลน์ครั้งถัดไปเตือนใหม่ได้ปกติ
export function applyOfflineSessionChange(
  state: OfflineDialogState,
  offlineSession: boolean,
): OfflineDialogState {
  if (offlineSession) return state;
  return initialOfflineDialogState;
}

// เรียกหลัง probe เชื่อมต่อจริงเสร็จระหว่างที่ offlineSession ยัง true อยู่ — ถ้าผู้ใช้กด
// "ใช้งานโหมดออฟไลน์" ไปแล้วสำหรับรอบนี้ ต้องไม่เปิด popup ซ้ำแม้ probe จะยังล้มเหลวต่อเนื่อง
export function applyConnectivityProbeResult(
  state: OfflineDialogState,
  online: boolean,
): OfflineDialogState {
  if (online) return { ...state, open: false };
  if (state.dismissedForThisOutage) return state;
  return { ...state, open: true };
}

// เรียกตอนผู้ใช้ปิด popup เอง (กด "ใช้งานโหมดออฟไลน์")
export function applyUserDismiss(): OfflineDialogState {
  return { open: false, dismissedForThisOutage: true };
}
