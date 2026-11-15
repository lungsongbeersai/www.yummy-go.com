import type { EmployeeWorkScope } from "@/services/pos";
import { EMPLOYEE_WORK_SCOPES } from "./employee-work-format";

export function employeeWorkSwipeScope(scope: EmployeeWorkScope, deltaX: number, deltaY: number): EmployeeWorkScope | null {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY) || Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.5) return null;
  const index = EMPLOYEE_WORK_SCOPES.indexOf(scope);
  return EMPLOYEE_WORK_SCOPES[index + (deltaX < 0 ? 1 : -1)] ?? null;
}
