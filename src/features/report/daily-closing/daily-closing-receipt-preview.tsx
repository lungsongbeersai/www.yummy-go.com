"use client";

import { useState } from "react";
import {
  type DailyClosingPrintData,
  renderDailyClosingReceiptPreviewDoc,
} from "./daily-closing-report-print";

interface DailyClosingReceiptPreviewProps {
  data: DailyClosingPrintData;
}

// แสดงใบเสร็จบนหน้าจอด้วยเอกสารชุดเดียวกับหน้าพิมพ์ (window.open) ผ่าน iframe
// ผู้ใช้จึงเห็นหน้าจอตรงกับผลลัพธ์การพิมพ์ 1:1 โดยไม่ต้องเปิดหน้าต่างพิมพ์
export function DailyClosingReceiptPreview({ data }: DailyClosingReceiptPreviewProps) {
  const [height, setHeight] = useState(640);

  return (
    <div className="daily-closing-receipt-preview">
      <iframe
        title={data.labels.title}
        srcDoc={renderDailyClosingReceiptPreviewDoc(data)}
        className="daily-closing-receipt-frame"
        style={{ height }}
        onLoad={(event) => {
          const previewDocument = event.currentTarget.contentDocument;
          if (!previewDocument) return;

          void previewDocument.fonts.ready.then(() => {
            setHeight(previewDocument.body.scrollHeight + 8);
          });
        }}
      />
    </div>
  );
}
