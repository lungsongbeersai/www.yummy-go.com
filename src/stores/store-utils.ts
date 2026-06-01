"use client";

export function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong";
}

export interface AsyncSlice {
  loading: boolean;
  saving: boolean;
  error: string | null;
}
