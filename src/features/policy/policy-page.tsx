"use client";

import { useTranslation } from "react-i18next";

interface PolicySection {
  title: string;
  paragraphs?: string[];
  list?: string[];
}

function translatedArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function PolicyPage() {
  const { t } = useTranslation();
  const aboutParagraphs = translatedArray<string>(t("policy.about.paragraphs", { returnObjects: true }));
  const sections = translatedArray<PolicySection>(t("policy.sections", { returnObjects: true }));

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <section className="relative overflow-hidden bg-linear-to-br from-emerald-700 via-green-600 to-lime-500 px-4 py-16 text-white md:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_35%)]" />

        <div className="relative mx-auto max-w-5xl">
          <div className="inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/25 backdrop-blur">
            {t("policy.badge")}
          </div>

          <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
            {t("policy.title")}
          </h1>

          <p className="mt-5 max-w-3xl text-base leading-8 text-emerald-50 md:text-lg">
            {t("policy.intro")}
          </p>

          <div className="mt-8 grid gap-4 text-sm md:grid-cols-3">
            <div className="rounded-2xl bg-white/15 p-4 ring-1 ring-white/20 backdrop-blur">
              <p className="font-semibold">{t("policy.meta.application")}</p>
              <p className="mt-1 text-emerald-50">{t("policy.meta.applicationValue")}</p>
            </div>

            <div className="rounded-2xl bg-white/15 p-4 ring-1 ring-white/20 backdrop-blur">
              <p className="font-semibold">{t("policy.meta.purpose")}</p>
              <p className="mt-1 text-emerald-50">{t("policy.meta.purposeValue")}</p>
            </div>

            <div className="rounded-2xl bg-white/15 p-4 ring-1 ring-white/20 backdrop-blur">
              <p className="font-semibold">{t("policy.meta.updated")}</p>
              <p className="mt-1 text-emerald-50">{t("policy.meta.updatedValue")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 md:py-14">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-lg font-semibold text-slate-950">
              {t("policy.summary.title")}
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              {t("policy.summary.description")}
            </p>

            <div className="mt-6 flex flex-col gap-3 text-sm">
              <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-800">
                {t("policy.summary.noSell")}
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 text-slate-700">
                {t("policy.summary.purposeOnly")}
              </div>
            </div>
          </aside>

          <div className="flex flex-col gap-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <h2 className="text-2xl font-bold text-slate-950">
                {t("policy.about.title")}
              </h2>

              <div className="mt-4 flex flex-col gap-4 leading-8 text-slate-700">
                {aboutParagraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>

            {sections.map((section) => (
              <section
                key={section.title}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
              >
                <h2 className="text-xl font-bold text-slate-950">
                  {section.title}
                </h2>

                <div className="mt-4 leading-8 text-slate-700 [&_p+ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
                  {(section.paragraphs ?? []).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {section.list ? (
                    <ul>
                      {section.list.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </section>
            ))}

            <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm md:p-8">
              <h2 className="text-xl font-bold text-slate-950">
                {t("policy.contact.title")}
              </h2>

              <p className="mt-4 leading-8 text-slate-700">
                {t("policy.contact.description")}
              </p>

              <div className="mt-5 rounded-2xl bg-white p-5 ring-1 ring-emerald-100">
                <p className="text-sm font-medium text-slate-500">
                  {t("policy.contact.emailLabel")}
                </p>

                <a
                  href={`mailto:${t("policy.contact.email")}`}
                  className="mt-1 inline-block font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  {t("policy.contact.email")}
                </a>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
