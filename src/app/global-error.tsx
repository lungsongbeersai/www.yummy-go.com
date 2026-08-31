"use client";

import { useEffect } from "react";
import { recoverFromChunkLoadError } from "@/lib/chunk-load-recovery";
import { GLOBAL_ERROR_COPY, readGlobalErrorClientState } from "@/lib/global-error-state";
import "./globals.css";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}

export default function GlobalError({ error, unstable_retry }: GlobalErrorProps) {
  const { theme, lang } = readGlobalErrorClientState();
  const copy = GLOBAL_ERROR_COPY[lang];

  useEffect(() => {
    void recoverFromChunkLoadError(error, { automatic: true });
  }, [error]);

  async function handleRetry() {
    if (await recoverFromChunkLoadError(error)) return;
    unstable_retry();
  }

  return (
    <html
      lang={lang}
      className={theme === "dark" ? "dark" : undefined}
      data-theme={theme}
      style={{ colorScheme: theme }}
    >
      <body>
        <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
          <section className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
            <h1 className="text-xl font-black">{copy.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>
            {error.digest ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {copy.reference}: {error.digest}
              </p>
            ) : null}
            <button
              type="button"
              className="mt-5 min-h-11 rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground"
              onClick={() => void handleRetry()}
            >
              {copy.retry}
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
