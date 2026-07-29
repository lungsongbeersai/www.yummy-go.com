# แก้ Responsive Scroll และขอบเขต Pagination ของรายการขาย

วันที่อนุมัติแนวทาง: 2026-07-28

## สรุป

หน้า `/sales/sales-list` ต้องคง pagination ไว้ใน footer ของแผงรายการบิล เพราะ pagination เปลี่ยนเฉพาะรายการบิล ไม่ได้เปลี่ยนแผงรายละเอียดบิล บน desktop footer จึงกว้างเท่าแผงรายการด้านซ้าย ส่วน tablet และ mobile แผงรายการกว้างเต็มพื้นที่เนื้อหาอยู่แล้ว

ปัญหาที่ผู้ใช้ปัดรายการบิลบน tablet/mobile แล้วหน้าไม่เลื่อน เกิดจากรายการบิลเป็น `overflow-y-auto overscroll-contain` ทุก breakpoint แม้ว่าบนหน้าจอต่ำกว่า `xl` รายการจะขยายตามเนื้อหาและไม่มี overflow ภายในของตัวเอง ทำให้ scroll gesture ถูกดักไว้และไม่ส่งต่อไปยัง page scroller

## หลักฐาน

ตรวจที่ viewport `1024×768`:

- page scroller สูง `690px` แต่มีเนื้อหาสูง `1,816px` จึงต้องเลื่อนได้
- รายการบิลมี `clientHeight` และ `scrollHeight` เท่ากันที่ประมาณ `1,615px` จึงไม่มีพื้นที่ให้เลื่อนภายใน
- การปัดบนรายการบิลทำให้ทั้ง list และ page มี `scrollTop` คงเดิมที่ `0`
- การปัดนอกพื้นที่รายการทำให้ page `scrollTop` เปลี่ยนเป็น `400`

`overscroll-contain` ถูกเพิ่มใน commit `3a3eedc8` พร้อมการปรับหน้าตารายการบิล ก่อนหน้านั้น scroll chaining ยังไม่ถูกปิด

## ดีไซน์ที่เลือก

### Desktop (`xl` ขึ้นไป)

- คง fixed-height split panel เดิม
- รายการบิลเป็น internal vertical scroller
- ใช้ `overscroll-contain` เพื่อไม่ให้ gesture หลุดไปยัง shell เมื่อรายการเลื่อนถึงขอบ
- pagination อยู่ด้านล่างของแผงรายการบิลและไม่เลื่อนตามรายการ

### Tablet และ mobile (ต่ำกว่า `xl`)

- ใช้ page container เป็น vertical scroller เพียงตัวเดียว
- รายการบิลขยายตามเนื้อหา ไม่สร้าง nested scroll container
- pagination อยู่ต่อจากรายการบิลและกว้างเต็ม card/content โดยธรรมชาติ
- การปัดที่ตำแหน่งใดในรายการบิลต้องเลื่อน page ได้

## ขอบเขตการเปลี่ยนแปลง

- ปรับ responsive overflow classes ใน `src/features/sales/sales-list/sales-bill-list.tsx`
- ไม่เปลี่ยน `AppPagination`, pagination logic, API, Zustand store หรือ URL state
- ไม่เปลี่ยนตำแหน่ง pagination ให้อยู่ใต้ทั้ง list และ detail panel
- ไม่เพิ่ม dependency หรือ locale key
- คง touch target, keyboard focus, light mode และ dark mode เดิม

## การตรวจสอบ

- รัน `npm run typecheck`
- รัน `npm run lint`
- ตรวจ browser ที่ `390×844`, `1024×768` และ desktop อย่างน้อย `1280px`
- tablet/mobile: ปัดบนรายการบิลแล้ว page ต้องเลื่อนจนเห็น pagination
- desktop: รายการบิลต้องเลื่อนภายในแผง ส่วน pagination ต้องคงอยู่ด้านล่าง
- ยืนยันว่าไม่มี horizontal overflow และ pagination controls ยังกดด้วย keyboard/touch ได้

## เกณฑ์สำเร็จ

1. ผู้ใช้เลื่อนรายการบิลได้จากบริเวณตัวรายการบน tablet และ mobile
2. desktop ยังคง split-panel scrolling เดิม
3. pagination สัมพันธ์กับรายการบิลอย่างชัดเจน: เต็มแผงรายการบน desktop และเต็ม card บน tablet/mobile
4. ไม่มี regression ต่อข้อมูล หน้า URL การเลือกบิล หรือแผงรายละเอียด
