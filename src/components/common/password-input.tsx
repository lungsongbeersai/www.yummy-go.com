"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const PasswordInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, disabled, ...props }, ref) => {
    const { t } = useTranslation();
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          autoCapitalize="off"
          autoCorrect="off"
          className={cn("pr-12", className)}
          disabled={disabled}
          spellCheck={false}
          translate="no"
          type={visible ? "text" : "password"}
          {...props}
        />
        <Button
          aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 h-full w-11 rounded-l-none text-muted-foreground hover:bg-transparent hover:text-foreground"
          disabled={disabled}
          size="iconSm"
          type="button"
          variant="ghost"
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
