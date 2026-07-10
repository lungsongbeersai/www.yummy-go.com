import type { ReactNode } from "react";

const sections: { title: string; content: ReactNode }[] = [
  {
    title: "1. Information We Collect",
    content: (
      <>
        <p>
          We may collect information that is necessary to provide and improve
          our restaurant POS and management services.
        </p>

        <ul>
          <li>Restaurant or business account information</li>
          <li>User login and account details</li>
          <li>Order, sales, receipt, table, and product information</li>
          <li>Printer and device connection information</li>
          <li>Technical information such as device type, app version, and usage logs</li>
        </ul>
      </>
    ),
  },
  {
    title: "2. How We Use Information",
    content: (
      <>
        <p>We use collected information to operate and improve Yummy Go.</p>

        <ul>
          <li>Provide restaurant POS and order management services</li>
          <li>Process orders, receipts, kitchen tickets, and sales records</li>
          <li>Manage tables, products, staff access, and restaurant operations</li>
          <li>Improve application performance, reliability, and security</li>
          <li>Provide customer support and troubleshooting</li>
          <li>Prevent unauthorized access and protect our systems</li>
        </ul>
      </>
    ),
  },
  {
    title: "3. Data Sharing",
    content: (
      <p>
        We do not sell personal information to third parties. We may share
        information only when necessary to provide our services, comply with
        legal obligations, protect users, or maintain the security and reliability
        of our systems.
      </p>
    ),
  },
  {
    title: "4. Data Security",
    content: (
      <p>
        We use reasonable technical and organizational measures to protect user
        data from unauthorized access, loss, misuse, alteration, or disclosure.
        However, no method of electronic storage or transmission is completely
        secure.
      </p>
    ),
  },
  {
    title: "5. Data Retention",
    content: (
      <p>
        We retain information only as long as necessary to provide our services,
        comply with legal requirements, resolve disputes, maintain business
        records, and support restaurant operations.
      </p>
    ),
  },
  {
    title: "6. User Rights",
    content: (
      <p>
        Users may contact us to request access, correction, or deletion of their
        information, subject to legal, security, and business requirements.
      </p>
    ),
  },
  {
    title: "7. Children’s Privacy",
    content: (
      <p>
        Yummy Go is intended for business and restaurant use. It is not directed
        to children under the age required by applicable law, and we do not
        knowingly collect personal information from children.
      </p>
    ),
  },
  {
    title: "8. Changes to This Policy",
    content: (
      <p>
        We may update this Privacy Policy from time to time. Any changes will be
        posted on this page with an updated effective date.
      </p>
    ),
  },
];

export function PolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <section className="relative overflow-hidden bg-linear-to-br from-emerald-700 via-green-600 to-lime-500 px-4 py-16 text-white md:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_35%)]" />

        <div className="relative mx-auto max-w-5xl">
          <div className="inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/25 backdrop-blur">
            Yummy Go Restaurant POS
          </div>

          <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
            Privacy Policy
          </h1>

          <p className="mt-5 max-w-3xl text-base leading-8 text-emerald-50 md:text-lg">
            This Privacy Policy explains how Yummy Go collects, uses, stores,
            and protects information when you use our restaurant POS, mobile
            ordering, receipt printing, and management services.
          </p>

          <div className="mt-8 grid gap-4 text-sm md:grid-cols-3">
            <div className="rounded-2xl bg-white/15 p-4 ring-1 ring-white/20 backdrop-blur">
              <p className="font-semibold">Application</p>
              <p className="mt-1 text-emerald-50">Yummy Go</p>
            </div>

            <div className="rounded-2xl bg-white/15 p-4 ring-1 ring-white/20 backdrop-blur">
              <p className="font-semibold">Purpose</p>
              <p className="mt-1 text-emerald-50">Restaurant POS Management</p>
            </div>

            <div className="rounded-2xl bg-white/15 p-4 ring-1 ring-white/20 backdrop-blur">
              <p className="font-semibold">Last Updated</p>
              <p className="mt-1 text-emerald-50">July 8, 2026</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 md:py-14">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-lg font-semibold text-slate-950">
              Policy Summary
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Yummy Go uses information to provide restaurant management,
              ordering, sales, receipt printing, and support services.
            </p>

            <div className="mt-6 space-y-3 text-sm">
              <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-800">
                We do not sell personal information.
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 text-slate-700">
                Data is used only for service, security, support, and business
                operation purposes.
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <h2 className="text-2xl font-bold text-slate-950">
                About Yummy Go
              </h2>

              <div className="mt-4 space-y-4 leading-8 text-slate-700">
                <p>
                  Yummy Go is a restaurant POS and management application
                  designed to help restaurants manage orders, sales, tables,
                  receipts, kitchen printing, products, and daily operations.
                </p>

                <p>
                  By using Yummy Go, you agree to the collection and use of
                  information in accordance with this Privacy Policy.
                </p>
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
                  {section.content}
                </div>
              </section>
            ))}

            <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm md:p-8">
              <h2 className="text-xl font-bold text-slate-950">
                Contact Us
              </h2>

              <p className="mt-4 leading-8 text-slate-700">
                If you have any questions about this Privacy Policy or how your
                information is handled, please contact us.
              </p>

              <div className="mt-5 rounded-2xl bg-white p-5 ring-1 ring-emerald-100">
                <p className="text-sm font-medium text-slate-500">
                  Support Email
                </p>

                <a
                  href="mailto:support@yummy-go.com"
                  className="mt-1 inline-block font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  support@yummy-go.com
                </a>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
