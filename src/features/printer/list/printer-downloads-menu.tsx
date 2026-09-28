"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Apple, Download, Languages, MonitorDown, Settings2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import {
  agentDownloadUrl,
  PRINTER_SETUP_DOWNLOAD_URL,
  XPRINTER_DRIVER_FILE_NAME,
  XPRINTER_DRIVER_URL,
} from "./printer-page-utils";

export function AgentPlatformIcon({ platform }: { platform: string }) {
  const normalizedPlatform = platform.trim().toLowerCase();

  if (normalizedPlatform.includes("mac")) return <Apple aria-hidden="true" />;
  if (normalizedPlatform.includes("win"))
    return <MonitorDown aria-hidden="true" />;

  return <Download aria-hidden="true" />;
}

interface AgentFile {
  agent_file_uuid: string;
  download_url?: string;
  file_name: string;
  file_platform: string;
}

// ข้อความรองใต้ชื่อไฟล์ — เดิมเป็นปุ่มเรียงกัน 4 ปุ่มบนหัวหน้า ("ติดตั้ง Driver", "ดาวน์โหลด Agent",
// "Lao Script 8", "Xprinter Utility") โดยไม่บอกว่าแต่ละไฟล์ใช้ทำอะไร คนตั้งเครื่องครั้งแรกเลือกไม่ถูก
function MenuFileLabel({ hint, title }: { hint: string; title: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate font-semibold">{title}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </span>
  );
}

/**
 * ไฟล์ติดตั้งทั้งหมดรวมอยู่ในเมนูเดียวทุกขนาดจอ — Agent อยู่บนสุดเพราะต้องมีก่อนเครื่องพิมพ์จะทำงานได้
 * รายการ Agent โหลดจาก backend ตอนเปิดเมนู (onAgentOpenChange) ส่วนที่เหลือเป็นไฟล์ static ของเว็บ/ลิงก์ภายนอก
 */
export function PrinterDownloadsMenu({
  activeAgentFiles,
  agentFilesFailed,
  loadingAgentFiles,
  onAgentOpenChange,
  onDriverDownload,
  onLaoFontDownload,
  onPrinterSetupDownload,
  triggerClassName,
}: {
  activeAgentFiles: AgentFile[];
  agentFilesFailed: boolean;
  loadingAgentFiles: boolean;
  onAgentOpenChange: (open: boolean) => void;
  onDriverDownload: () => void;
  onLaoFontDownload: () => void;
  onPrinterSetupDownload: () => void;
  triggerClassName?: string;
}) {
  const { t } = useTranslation();

  return (
    <DropdownMenu onOpenChange={onAgentOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          className={triggerClassName}
          type="button"
          variant="outline"
          aria-label={t("printer.setupMenu")}
        >
          <Settings2 data-icon="inline-start" />
          <span className="hidden sm:inline">{t("printer.setupMenu")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <p className="px-2 pt-1.5 pb-1 text-xs text-muted-foreground">{t("printer.setupMenuHint")}</p>
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("printer.downloadAgent")}</DropdownMenuLabel>
          {loadingAgentFiles ? (
            <DropdownMenuItem disabled>
              <Spinner />
              {t("printer.loadingAgentFiles")}
            </DropdownMenuItem>
          ) : agentFilesFailed ? (
            <DropdownMenuItem disabled>
              {t("printer.agentFilesLoadFailed")}
            </DropdownMenuItem>
          ) : activeAgentFiles.length ? (
            activeAgentFiles.map((file) => {
              const platformKey = file.file_platform.trim().toLowerCase();
              const platformLabel = t(`printer.agentPlatform.${platformKey}`, {
                defaultValue: file.file_platform || t("printer.agent"),
              });
              const url = agentDownloadUrl(file);

              return (
                <DropdownMenuItem key={file.agent_file_uuid} asChild>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    download={file.file_name}
                    onClick={(event) => {
                      event.currentTarget.href = agentDownloadUrl(
                        file,
                        Date.now(),
                      );
                    }}
                  >
                    <AgentPlatformIcon platform={file.file_platform} />
                    <MenuFileLabel
                      title={`${t("printer.agent")} · ${platformLabel}`}
                      hint={file.file_name || t("printer.agentFileHint")}
                    />
                  </a>
                </DropdownMenuItem>
              );
            })
          ) : (
            <DropdownMenuItem disabled>
              {t("printer.noAgentFiles")}
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("printer.downloadsMenu")}</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <a
              href={XPRINTER_DRIVER_URL}
              download={XPRINTER_DRIVER_FILE_NAME}
              onClick={onDriverDownload}
            >
              <Download />
              <MenuFileLabel title={t("printer.installDriver")} hint={t("printer.driverHint")} />
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href="/downloads/laoscript8.msi"
              download
              onClick={onLaoFontDownload}
            >
              <Languages />
              <MenuFileLabel title={t("printer.downloadLaoFont")} hint={t("printer.laoFontHint")} />
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={PRINTER_SETUP_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
              onClick={onPrinterSetupDownload}
            >
              <Wrench />
              <MenuFileLabel title={t("printer.downloadPrinterSetup")} hint={t("printer.setupUtilityHint")} />
            </a>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
