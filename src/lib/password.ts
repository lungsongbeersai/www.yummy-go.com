export const PASSWORD_MIN_LENGTH = 4;

export interface ChangePasswordValues {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordMessages {
  required: string;
  minLength: string;
  mismatch: string;
  sameAsOld: string;
}

// service layer trim ค่าด้วย requiredText ก่อนส่งขึ้น backend — validate ค่าที่ trim แล้วเหมือนกัน
// ไม่งั้นรหัสที่มีแต่ช่องว่างจะผ่านฝั่ง UI แล้วไปตกที่ backend แทน
export function trimChangePasswordValues(values: ChangePasswordValues): ChangePasswordValues {
  return {
    oldPassword: values.oldPassword.trim(),
    newPassword: values.newPassword.trim(),
    confirmPassword: values.confirmPassword.trim()
  };
}

export function validateChangePassword(
  values: ChangePasswordValues,
  messages: ChangePasswordMessages
): string | null {
  const { oldPassword, newPassword, confirmPassword } = trimChangePasswordValues(values);

  if (!oldPassword || !newPassword || !confirmPassword) return messages.required;
  if (newPassword.length < PASSWORD_MIN_LENGTH) return messages.minLength;
  if (newPassword !== confirmPassword) return messages.mismatch;
  if (newPassword === oldPassword) return messages.sameAsOld;
  return null;
}
