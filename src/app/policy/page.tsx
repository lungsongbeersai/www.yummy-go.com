import type { Metadata } from "next";
import { PolicyPage } from "@/features/policy/policy-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Yummy Go",
  description: "Privacy Policy for Yummy Go restaurant POS and management application.",
  robots: { index: false, follow: false }
};

export default function Page() {
  return <PolicyPage />;
}
