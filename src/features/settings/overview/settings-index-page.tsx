"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SETTINGS_MODULE_SLUGS } from "@/features/settings/shared/settings-config";
import { canViewSettingModule } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth-store";

export function SettingsIndexPage() {
  const { t } = useTranslation();
  const userStatus = useAuthStore((state) => state.user?.status);
  const modules = SETTINGS_MODULE_SLUGS.filter((slug) => canViewSettingModule(slug, userStatus));

  return (
    <div className="flex min-w-0 flex-col gap-4 px-4 py-4 sm:gap-5 sm:px-0 sm:py-0">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-bold text-primary">{t("settings.title")}</p>
        <h1 className="text-pretty text-2xl font-black">
          {t("settings.indexTitle")}
        </h1>
        <p className="max-w-3xl text-pretty text-sm text-muted-foreground">
          {t("settings.description")}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((slug) => (
          <Link
            key={slug}
            href={`/settings/${slug}`}
            className="group min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="h-full transition group-hover:border-primary group-hover:shadow-md">
              <CardHeader className="min-h-14 items-start gap-2">
                <CardTitle className="min-w-0 truncate">
                  {t(`settings.modules.${slug}.title`)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="line-clamp-2 min-w-0 break-words text-sm leading-6 text-muted-foreground">
                  {t(`settings.modules.${slug}.description`)}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
