"use client";

import { useState } from "react";
import { Box, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { internalRoute } from "@/lib/routes";
import { useAuthStore } from "@/stores/auth-store";

export function SimulatorLauncher() {
  const branch = useAuthStore((state) => state.user?.branch_uuid);
  const [blocked, setBlocked] = useState(false);
  return <div className="flex items-center gap-2">
    <Button type="button" aria-label="3D Simulator" title="3D Simulator" variant="secondary" className="h-10 gap-2" disabled={!branch} onClick={() => {
      // A same-origin opener copies sessionStorage for non-remembered logins.
      // Only the URL is passed; credentials never enter URLs or messages.
      const popup = window.open(internalRoute(`/simulator?${new URLSearchParams({ branch_uuid: branch ?? "" })}`),
        "_blank", "popup=yes,width=1480,height=960,resizable=yes,scrollbars=yes");
      setBlocked(!popup);
      popup?.focus();
    }}><Box /><span className="hidden xl:inline">3D Simulator</span><ExternalLink className="hidden size-3 xl:inline" /></Button>
    {blocked && <span role="alert" className="max-w-44 text-xs text-destructive">Allow pop-ups / ອະນຸຍາດ pop-ups / อนุญาต pop-ups</span>}
  </div>;
}
