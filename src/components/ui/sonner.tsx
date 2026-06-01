"use client";

import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useAppStore } from "@/stores/app-store";

function Toaster(props: ToasterProps) {
  const theme = useAppStore((state) => state.theme);

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="top-right"
      richColors
      closeButton
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />
      }}
      style={
        {
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
          "--border-radius": "0.75rem"
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          fontFamily: 'var(--font-noto-sans-lao), "Aptos", "Segoe UI", sans-serif'
        }
      }}
      {...props}
    />
  );
}

export { Toaster };
