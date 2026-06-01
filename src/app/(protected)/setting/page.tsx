"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SETTINGS } from "@/features/settings/settings-config";
import { canViewSettingModule } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth-store";

export default function SettingsIndexPage() {
  const { t } = useTranslation();
  const userStatus = useAuthStore((state) => state.user?.status);

  return (
    <div className="flex min-w-0 flex-col gap-4 px-4 py-4 sm:gap-5 sm:px-0 sm:py-0">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-bold text-primary">{t("settings.title")}</p>
        <h1 className="text-pretty text-2xl font-black">{t("settings.indexTitle")}</h1>
        <p className="max-w-3xl text-pretty text-sm text-muted-foreground">{t("settings.description")}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Object.values(SETTINGS)
          .filter((item, index, list) => list.findIndex((match) => match.slug === item.slug) === index)
          .filter((item) => canViewSettingModule(item.slug, userStatus))
          .map((item) => (
            <Link
              key={item.slug}
              href={`/setting/${item.slug}`}
              className="group min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition group-hover:border-primary group-hover:shadow-md">
                <CardHeader className="min-h-14 items-start gap-2">
                  <CardTitle className="min-w-0 truncate">{t(`settings.modules.${item.slug}.title`)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-2 min-w-0 break-words text-sm leading-6 text-muted-foreground">
                    {t(`settings.modules.${item.slug}.description`)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
      </div>
    </div>
  );
}
