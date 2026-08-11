# Screenshot plan

ใช้ข้อมูลร้าน/บุคคลสมมติเท่านั้น ภาพที่เตรียมเป็น authenticated production UI เดียวกับที่ online-shell build `1.0 (2)` โหลดหลังล็อกอิน

## ขนาดที่ต้องส่ง

- iPhone 6.5 นิ้ว แนวตั้ง: `1284 × 2778` หรือ `1242 × 2688` px
- iPad 13 นิ้ว แนวตั้ง: `2064 × 2752` หรือ `2048 × 2732` px
- ไฟล์ `.png`, `.jpg` หรือ `.jpeg` ไม่มี alpha channel

## ไฟล์ที่เตรียมแล้ว

- iPhone 6.5 นิ้ว: `release/app-store-review/iphone-6.5/` ขนาด `1242 × 2688` px
- iPad 13 นิ้ว: `release/app-store-review/ipad-13/` ขนาด `2064 × 2752` px
- ทุกไฟล์เป็น PNG แบบ RGB และไม่มี alpha channel

## ลำดับภาพที่ให้อัปโหลด

1. `03-pos-order.png` — หน้า POS Order ที่เห็นหมวดสินค้า รูปเมนู ราคา และตะกร้า
2. `02-tables.png` — หน้า Tables ที่เห็น 17 โต๊ะ พร้อมสถานะว่าง/ไม่ว่าง
3. `04-cart.png` — ตะกร้าตัวอย่างของโต๊ะ T01 พร้อมยอดรวม ค่าบริการ และภาษี (ใช้กับ iPhone; iPad ใช้เป็นภาพเสริมได้)
4. `05-products.png` — Product management ที่เห็นสินค้า ราคา สต็อก และหมวดหมู่
5. `01-dashboard.png` — Dashboard และตัวกรองรายงาน

ภาพแรกต้องเป็น `03-pos-order.png` เพื่อให้ Apple เห็นฟังก์ชันหลักทันที ไม่ควรเริ่มด้วย Dashboard ที่ยอดขายของวันปัจจุบันเป็นศูนย์

อย่าใช้ splash, login, landing page, ภาพ Android, mockup ที่ไม่ใช่ UI จริง หรือข้อมูลลูกค้าจริง เพราะ Apple ระบุว่า screenshot ต้องแสดงแอปขณะใช้งานจริง

อ้างอิง: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
