export interface OfflineDialogState {
  open: boolean;
  dismissedForThisOutage: boolean;
}

export const initialOfflineDialogState: OfflineDialogState = {
  open: false,
  dismissedForThisOutage: false,
};

// The dialog follows confirmed Backend reachability, not auth, printer, Agent,
// or sync state. Reset its dismissal only after Backend is reachable again.
export function applyBackendOfflineChange(
  state: OfflineDialogState,
  backendOffline: boolean,
): OfflineDialogState {
  if (backendOffline) return state;
  return initialOfflineDialogState;
}

// เรียกหลัง probe เชื่อมต่อจริงเสร็จระหว่างที่ Backend ยัง unreachable — ถ้าผู้ใช้กด
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
