# Yummy Go — App Store Review รอบแก้ไข

เอกสารชุดนี้ใช้กับ iOS เวอร์ชัน `1.0` build `2` และแก้ประเด็นที่ถูกปฏิเสธในรอบ `1.0 (1)`

## ก่อนกดส่งตรวจ

- สร้างบัญชี reviewer จริงบน production backend และใส่ข้อมูลตัวอย่างที่ไม่ใช่ข้อมูลลูกค้าจริง
- บัญชีต้องเข้าได้ตลอดช่วงตรวจ ไม่มี OTP และไม่หมดอายุ
- ให้สิทธิ์เห็น Dashboard, Tables, POS Order, Sales, Products และ Reports
- ใส่ username/password ใน App Review Information; ห้ามใส่รหัสผ่านใน source code หรือ screenshot
- บัญชี reviewer ที่เจ้าของระบบส่งมาได้รับการทดสอบแล้ว: ล็อกอินสำเร็จ เห็น 17 โต๊ะ สินค้า 36 รายการ และออเดอร์ตัวอย่างของโต๊ะ T01
- อัปโหลด build `1.0 (2)` จาก `ios/App/App.xcworkspace` และเลือก build นี้ใน App Store Connect
- แทนที่ Description เดิมด้วยข้อความใน `app-description-en.txt`
- อัปโหลด screenshot ใหม่ตาม `screenshot-plan.md`; ห้ามใช้ login, splash หรือภาพจาก build เก่าเป็นภาพหลัก
- วางข้อความจาก `review-notes-en.txt` ใน Notes for Review หลังแทนค่าช่องวงเล็บเหลี่ยมครบแล้ว
- ตรวจ Privacy Policy URL และลิงก์นโยบายในแอปให้เปิดได้จริง

## สิ่งที่แก้ใน build นี้

- Native app ที่ยังไม่ล็อกอินเข้า `/login` โดยตรง ไม่ผ่านหน้า landing/การตลาด
- หน้า login ระบุฟังก์ชัน POS ที่มีจริง และนำปุ่ม placeholder ที่กดไม่ได้ออก
- มี native iOS project, app icon, splash และปลั๊กอินที่ใช้งานครบ
- Bundle ID `com.yummygo.app`, marketing version `1.0`, build `2`
- ตัวตรวจเวอร์ชัน iOS เตรียมไว้แล้ว แต่ยังปิดจนกว่า App Store จะเผยแพร่ build นี้

Apple เป็นผู้ตัดสินผลสุดท้าย การส่งใหม่โดยไม่มีบัญชี reviewer ที่ใช้งานได้หรือใช้ screenshot เก่าจะยังมีโอกาสถูกปฏิเสธซ้ำสูง
