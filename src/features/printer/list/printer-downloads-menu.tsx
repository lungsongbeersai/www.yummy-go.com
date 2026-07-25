"use client";

import { useTranslation } from "react-i18next";
import { Apple, Download, MonitorDown } from "lucide-react";
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

export interface AgentDownloadFile {
  agent_file_uuid: string;
  download_url?: string;
  file_name: string;
  file_platform: string;
}

export interface AgentFilesState {
  activeAgentFiles: AgentDownloadFile[];
  agentFilesFailed: boolean;
  loadingAgentFiles: boolean;
}

// รายการไฟล์ agent ในดรอปดาวน์ — หน้า printer แสดง 2 ที่ (แถบเครื่องมือจอกว้าง กับเมนูรวม
// บนจอแคบ) ทั้งสองใช้ลำดับสถานะ กำลังโหลด / โหลดไม่สำเร็จ / มีไฟล์ / ไม่มีไฟล์ ชุดเดียวกัน
export function AgentFileMenuItems({
  activeAgentFiles,
  agentFilesFailed,
  loadingAgentFiles,
}: AgentFilesState) {
  const { t } = useTranslation();

  if (loadingAgentFiles) {
    return (
      <DropdownMenuItem disabled>
        <Spinner />
        {t("printer.loadingAgentFiles")}
      </DropdownMenuItem>
    );
  }

  if (agentFilesFailed) {
    return <DropdownMenuItem disabled>{t("printer.agentFilesLoadFailed")}</DropdownMenuItem>;
  }

  if (!activeAgentFiles.length) {
    return <DropdownMenuItem disabled>{t("printer.noAgentFiles")}</DropdownMenuItem>;
  }

  return activeAgentFiles.map((file) => {
    const platformKey = file.file_platform.trim().toLowerCase();
    const platformLabel = t(`printer.agentPlatform.${platformKey}`, {
      defaultValue: file.file_platform || t("printer.agent"),
    });

    return (
      <DropdownMenuItem key={file.agent_file_uuid} asChild>
        <a
          href={agentDownloadUrl(file)}
          target="_blank"
          rel="noreferrer"
          download={file.file_name}
        >
          <AgentPlatformIcon platform={file.file_platform} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{platformLabel}</span>
            <span className="truncate text-xs text-muted-foreground">{file.file_name}</span>
          </span>
        </a>
      </DropdownMenuItem>
    );
  });
}

export function PrinterDownloadsMenu({
  activeAgentFiles,
  agentFilesFailed,
  loadingAgentFiles,
  onAgentOpenChange,
  onDriverDownload,
  onLaoFontDownload,
  onPrinterSetupDownload,
}: AgentFilesState & {
  onAgentOpenChange: (open: boolean) => void;
  onDriverDownload: () => void;
  onLaoFontDownload: () => void;
  onPrinterSetupDownload: () => void;
}) {
  const { t } = useTranslation();

  return (
    <DropdownMenu onOpenChange={onAgentOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          className="shadow-sm"
          size="sm"
          type="button"
          variant="outline"
          aria-label={t("printer.downloadsMenu")}
        >
          <Download data-icon="inline-start" />
          <span className="hidden sm:inline">{t("printer.downloadsMenu")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("printer.downloadsMenu")}</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <a
              href={XPRINTER_DRIVER_URL}
              download={XPRINTER_DRIVER_FILE_NAME}
              onClick={onDriverDownload}
            >
              <Download />
              {t("printer.installDriver")}
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href="/downloads/laoscript8.msi"
              download
              onClick={onLaoFontDownload}
            >
              <Download />
              {t("printer.downloadLaoFont")}
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={PRINTER_SETUP_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
              onClick={onPrinterSetupDownload}
            >
              <Download />
              {t("printer.downloadPrinterSetup")}
            </a>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("printer.downloadAgent")}</DropdownMenuLabel>
          <AgentFileMenuItems
            activeAgentFiles={activeAgentFiles}
            agentFilesFailed={agentFilesFailed}
            loadingAgentFiles={loadingAgentFiles}
          />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
