import { describe, expect, it } from "vitest";
import {
  PASSWORD_MIN_LENGTH,
  trimChangePasswordValues,
  validateChangePassword,
  type ChangePasswordMessages
} from "@/lib/password";

const messages: ChangePasswordMessages = {
  required: "required",
  minLength: "minLength",
  mismatch: "mismatch",
  sameAsOld: "sameAsOld"
};

function values(oldPassword: string, newPassword: string, confirmPassword = newPassword) {
  return { oldPassword, newPassword, confirmPassword };
}

describe("change password validation", () => {
  it("accepts a valid change", () => {
    expect(validateChangePassword(values("9999", "0000"), messages)).toBeNull();
  });

  it("rejects blank and whitespace-only fields", () => {
    expect(validateChangePassword(values("", "0000"), messages)).toBe("required");
    expect(validateChangePassword(values("9999", ""), messages)).toBe("required");
    expect(validateChangePassword(values("9999", "0000", ""), messages)).toBe("required");
    expect(validateChangePassword(values("   ", "0000"), messages)).toBe("required");
  });

  it("rejects a new password shorter than the minimum", () => {
    expect(validateChangePassword(values("9999", "0".repeat(PASSWORD_MIN_LENGTH - 1)), messages)).toBe("minLength");
    expect(validateChangePassword(values("9999", "0".repeat(PASSWORD_MIN_LENGTH)), messages)).toBeNull();
  });

  it("rejects a confirmation that does not match", () => {
    expect(validateChangePassword(values("9999", "0000", "0001"), messages)).toBe("mismatch");
  });

  it("rejects reusing the current password", () => {
    expect(validateChangePassword(values("0000", "0000"), messages)).toBe("sameAsOld");
  });

  it("compares trimmed values so padded input cannot bypass a rule", () => {
    expect(validateChangePassword(values(" 0000 ", "0000"), messages)).toBe("sameAsOld");
    expect(validateChangePassword(values("9999", " 0000", "0000 "), messages)).toBeNull();
  });

  it("trims every field", () => {
    expect(trimChangePasswordValues(values(" a ", " b ", " c "))).toEqual({
      oldPassword: "a",
      newPassword: "b",
      confirmPassword: "c"
    });
  });
});
