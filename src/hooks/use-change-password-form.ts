"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PASSWORD_MIN_LENGTH,
  trimChangePasswordValues,
  validateChangePassword,
  type ChangePasswordValues
} from "@/lib/password";

const EMPTY_VALUES: ChangePasswordValues = { oldPassword: "", newPassword: "", confirmPassword: "" };

// ใช้ร่วมกันระหว่าง dialog ในหน้า settings/user กับการ์ดในหน้า /profile —
// ทั้งสองที่เปลี่ยนรหัสของบัญชีที่ล็อกอินอยู่เหมือนกัน ต่างแค่เปลือก UI
export function useChangePasswordForm() {
  const { t } = useTranslation();
  const [values, setValues] = useState<ChangePasswordValues>(EMPTY_VALUES);
  const [error, setError] = useState<string | null>(null);

  function setValue(field: keyof ChangePasswordValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (error) setError(null);
  }

  function reset() {
    setValues(EMPTY_VALUES);
    setError(null);
  }

  // ผ่าน = คืนค่าที่ trim แล้วพร้อมส่ง, ไม่ผ่าน = คืน null และตั้งข้อความ error ให้ฟอร์มแสดง
  function validate(): ChangePasswordValues | null {
    const message = validateChangePassword(values, {
      required: t("profile.validation.passwordRequired"),
      minLength: t("profile.validation.passwordMinLength", { count: PASSWORD_MIN_LENGTH }),
      mismatch: t("profile.validation.passwordMismatch"),
      sameAsOld: t("profile.validation.passwordSameAsOld")
    });

    setError(message);
    return message ? null : trimChangePasswordValues(values);
  }

  return { error, reset, setValue, validate, values };
}
