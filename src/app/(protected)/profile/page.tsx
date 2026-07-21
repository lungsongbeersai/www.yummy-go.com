import type { Metadata } from "next";
import { ProfilePage } from "@/features/profile/overview/profile-page";

export const metadata: Metadata = {
  title: "ແກ້ໄຂໂປຣໄຟລ໌",
};

export default function Page() {
  return <ProfilePage />;
}
