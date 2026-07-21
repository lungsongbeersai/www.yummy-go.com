"use client";

import "./globals.css";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}

export default function GlobalError({ error, unstable_retry }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body>
        <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
          <section className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
            <h1 className="text-xl font-black">Yummy Go could not load</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Retry the page. If the problem continues, contact support.
            </p>
            {error.digest ? (
              <p className="mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p>
            ) : null}
            <button
              type="button"
              className="mt-5 min-h-11 rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground"
              onClick={unstable_retry}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
