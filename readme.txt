============================================================
 JOJO+ Phishing Simulation — สรุปการตั้งค่า & วิธีนำไปใช้งาน
============================================================
อัปเดต: 2026-06-25
บัญชีเจ้าของ/แอดมิน: monggame29@gmail.com
GitHub (private): https://github.com/mongdev9/JOJO-Phishing-Simulation

โปรเจคนี้คืออะไร:
  แพลตฟอร์มฝึกอบรมความตระหนักรู้ภัย Phishing ภายในองค์กร
  สร้างด้วย Google Apps Script + Google Sheet เป็นฐานข้อมูล
  ไม่มี Node/npm/build — แก้ไฟล์แล้ววางเข้า Apps Script ได้เลย
  โมเดล: single-tenant (1 องค์กร = 1 ชุด: ชีต + สคริปต์ + deployment)


------------------------------------------------------------
 1) สรุปสิ่งที่แก้ไปในรอบนี้
------------------------------------------------------------

[A] ตั้งค่า CONFIG ให้เป็นของบัญชี monggame29 (ไฟล์ Code.gs บนสุด)

    ค่า                 | เดิม (ของ dev เก่า)        | ใหม่
    --------------------|----------------------------|------------------------
    developerEmail      | sunart.srisumal@gmail.com  | monggame29@gmail.com
    spreadsheetId       | ชีตของ sunart              | '' (ใช้ชีตที่ผูกอยู่อัตโนมัติ)
    webAppUrl           | deployment ของ sunart      | '' (auto-detect)
    trainingWebAppUrl   | deployment ของ sunart      | '' (auto-detect)
    seedDemo            | true                       | false (DB สะอาด ไม่มีข้อมูลตัวอย่าง)

    ผล: ก๊อปไปวางบัญชีไหน บัญชีนั้นเป็น admin + เครดิตผู้พัฒนาอัตโนมัติ
        ไม่ชี้ทรัพยากรของเจ้าของเดิมอีกต่อไป

[B] งานเดิมที่ค้างในไฟล์ (เก็บเข้า git ให้พร้อมกัน — ไม่ใช่ของใหม่ที่เพิ่ม)
    - SCHEMA_VERSION -> 14, เพิ่มคอลัมน์ name ในชีต Results
    - รองรับกลุ่มคำถามที่ผู้ใช้สร้างเอง
    - อ่าน Logs เบาลง, แก้ normalize วันที่ใน Schedule, ปรับ Report, ปรับ UI

[C] Git
    - Commit: "Configure self-deploy for monggame29 + carry pending work"
    - สร้าง repo ใหม่แบบ private และ push ขึ้น GitHub บัญชี mongdev9

** สำคัญ: ยังไม่มีการส่งเมลจริง — กฎความปลอดภัย Phase 1 คงเดิมทุกข้อ **


------------------------------------------------------------
 2) วิธีนำไปใช้งาน (Deploy บน Google) — 6 ขั้น
------------------------------------------------------------

1. สร้าง Google Sheet เปล่า 1 ไฟล์ ในบัญชี monggame29
   -> เปิด Extensions > Apps Script

2. วางครบ 4 ไฟล์ในตัว editor (ชื่อต้องตรงเป๊ะ):
   - Code.gs
   - Backup.gs
   - Index.html   (** ตั้งชื่อไฟล์ว่า Index — ตัว I ใหญ่ **)
   - appsscript.json

3. รัน setupDatabase() 1 ครั้ง
   (เลือกฟังก์ชันนี้ใน editor แล้วกด Run, รอขึ้น "ดำเนินการเสร็จสมบูรณ์")
   มันจะสร้างชีต/หัวข้ออบรม/คลังคำถามให้อัตโนมัติ — รันซ้ำได้ปลอดภัย

4. Deploy ตัวที่ 1 = ADMIN (Deploy > New deployment > Web app)
   - Execute as:      User accessing
   - Who has access:  Anyone with Google account
   - ใช้สำหรับหน้า admin (ต้องล็อกอินด้วย Google)

5. Deploy ตัวที่ 2 = TRAINING
   - Execute as:      Me
   - Who has access:  Anyone  (ไม่ต้องล็อกอิน)
   - URL นี้คือลิงก์ที่ใส่ในเมลให้พนักงานเปิดหน้าอบรม

6. (ถ้าลิงก์ training เปิดไม่ติด) คัดลอก URL /exec ของทั้ง 2 ตัว
   กลับมาใส่ webAppUrl / trainingWebAppUrl ใน CONFIG
   -> save -> redeploy ตัว Admin อีกครั้ง

ข้อควรระวัง:
   - ห้าม clasp redeploy ตัว Training (clasp จะเขียนทับเป็น "ต้องล็อกอิน")
     ให้ redeploy ผ่านหน้า UI เท่านั้น
   - ลิงก์ training ใช้ cid= ไม่ใช่ c= (Google สงวนตัว c)
   - ถ้า error "ไม่พบไฟล์ HTML ชื่อ Index" = ชื่อไฟล์ HTML ไม่ตรง ต้องเป็น Index


------------------------------------------------------------
 3) หลัง deploy เสร็จ ใช้งานยังไง
------------------------------------------------------------

1. เปิด URL ตัว Admin -> ล็อกอินด้วย monggame29
   -> เป็น admin เห็นทุกเมนู (Email List, Simulation, Schedule,
      Report, Results, Training, คลังคำถาม)

2. เพิ่มรายชื่อเป้าหมาย ที่เมนู Email List (วาง/import จาก Google Sheet)

3. สร้างคิวจำลอง ที่เมนู Simulation
   *** Phase 1 ยังเป็นแค่ record ในชีต ยังไม่ส่งเมลออกจริง ***

4. ทดสอบหน้าอบรม: เปิด URL ตัว Training
   (ทำแบบทดสอบได้โดยไม่ต้องล็อกอิน) -> ผลไปโผล่ที่ Results/Report

5. ดู Report/Results เพื่อดู funnel:
   เป้าหมาย -> คลิก -> อบรม -> ผ่าน


------------------------------------------------------------
 4) ขั้นถัดไปที่แนะนำ (ต้องให้หัวหน้ายืนยัน scope ก่อน)
------------------------------------------------------------

   ทำให้ "ส่งเมลแคมเปญจริง" ถึงรายชื่อในลิสต์ได้
   (ลิงก์ยังต้องจบที่หน้า training ตามกฎความปลอดภัย)
   -> นี่คือชิ้นส่วนเดียวที่กั้นระหว่าง demo กับระบบใช้งานจริง

   ** ห้ามทำโดยไม่มีคำสั่งชัดเจน: spoof ผู้ส่ง, clone หน้า login,
      เก็บรหัสผ่าน/credential — เป็นข้อห้ามระดับโปรเจค **


------------------------------------------------------------
 5) บันทึกการแก้ไขล่าสุด (2026-06-25 รอบที่ 2)
------------------------------------------------------------

[1] แก้บั๊ก: หน้า training ไม่ขึ้น / เด้งไปหน้า admin
    สาเหตุ: Apps Script รันหน้าเว็บใน iframe ที่ไม่พา query param
            (page/cid/g/t/e/name) ติดไปด้วย -> location.search ว่าง
            -> client เข้าใจผิดว่าเป็นหน้า admin
    แก้:    - Code.gs (doGet) ฉีด params เข้า template ผ่าน paramsJson
            - Index.html อ่านจาก SERVER_PARAMS ก่อน แล้ว fallback
              ไป location.search
    ผล:     หน้า training ขึ้นถูกต้อง + quiz ได้ค่า g/cid ครบ

[2] แก้บั๊ก: หน้า Report คะแนนอบรมไม่ขึ้น (ทั้งที่ Excel มีคะแนน)
    สาเหตุ: getReportData() ข้ามแถวที่ email ว่าง และ join รายชื่อ
            ด้วย email อย่างเดียว -> คนที่อบรมผ่านลิงก์ anonymous
            (มีแต่ชื่อ ไม่มี email) เลยไม่เคยโผล่ในรายงาน
    แก้:    getReportData() ใช้ชื่อเป็นคีย์เมื่อ email ว่าง และเพิ่ม
            คนที่มีผลอบรมแต่ไม่อยู่ใน EmailList เข้ารายงานด้วย
    ผล:     คะแนนในชีต Results ขึ้นครบในหน้า Report

[3] แก้บั๊ก: หน้า Simulation ว่างเปล่า
    สาเหตุ: renderSimulation() สร้าง step6 ด้วย ${s.quiz.length}
            แต่ตอนเปิดครั้งแรก s.quiz = null -> template literal
            คำนวณทันที -> null.length โยน TypeError -> ฟังก์ชันพัง
            ก่อน set innerHTML -> หน้าว่าง
    แก้:    Index.html เปลี่ยนเป็น ${s.quiz ? s.quiz.length : 0}
            (null-safe)
    ผล:     หน้า Simulation แสดง 6 การ์ดขั้นตอนได้ปกติ

** ต้องทำหลังแก้: วางทับ Code.gs + Index ใน Apps Script -> Save
   -> redeploy version ใหม่ทั้ง Admin และ Training (ผ่าน UI เท่านั้น)
   โค้ดใหม่จะไม่มีผลจนกว่าจะออก version ใหม่ **

[4] ใส่ URL deployment จริงลง CONFIG (sync repo ให้ตรงของที่รันอยู่)
    - webAppUrl         = URL ตัว Admin
    - trainingWebAppUrl = URL ตัว Training (Execute as Me + Anyone)
    ผล: ลิงก์ในเมลชี้ไปหน้า training โดยตรง เปิดได้ไม่ต้องล็อกอิน
    หมายเหตุ: ถ้าก๊อป repo ไปติดตั้งบนชีต/บัญชีอื่น ต้องเปลี่ยน 2 URL
             นี้เป็นของ deployment ตัวเอง (ดูขั้นตอน Deploy ด้านบน)

------------------------------------------------------------
 6) PHASE 2 — ส่งอีเมลจริงถึงรายชื่อในลิสต์ (2026-06-25)
------------------------------------------------------------
อนุมัติ scope โดยเจ้าของ (monggame29) ให้ส่งอีเมลจำลองจริงถึง
ผู้รับในหน้า Email List ได้ (เดิม Phase 1 ส่งทดสอบหาตัวเองเท่านั้น)

คงกฎความปลอดภัยเดิมทุกข้อ:
  - ลิงก์ในเมลจบที่หน้า training เท่านั้น (?page=training)
  - ไม่เก็บรหัสผ่าน / ไม่ clone หน้า login
  - ไม่ปลอม "ที่อยู่" ผู้ส่ง (MailApp ส่งในนามบัญชีที่รันสคริปต์เสมอ)
    * หมายเหตุ: ชื่อแสดงผู้ส่งตั้งเป็น "IT Support" (เป็นข้อความ ไม่ใช่
      การปลอม address) เปลี่ยนได้ใน buildCampaignMail_ -> MailApp name

หมายเหตุ: หน้า Send Mail (Campaign) เคยหลุดจากเมนูตอน refactor
  single-tenant -> เพิ่มกลับเข้า nav แล้ว (แท็บ "Campaign" 📧)
  อยู่ระหว่าง Email -> Campaign -> Result

วิธีใช้:
  1. หน้า Send Mail (Campaign) -> เลือกหัวข้อ + จำนวน -> "สร้างคิวแคมเปญ"
     (สุ่มหัวข้อจาก MailTopics + สุ่มรายชื่อ active, เคารพโควต้า)
  2. ที่ตารางคิว กดปุ่ม "✉ ส่งคิวจริง (N รายการรอส่ง)" -> ยืนยัน
  3. ระบบส่งอีเมลแต่ละแถว status=queued:
     - เนื้อหา = หัวข้อ/context จาก MailTopic ที่สุ่มให้
     - ลิงก์ต่อท้าย e=<อีเมล> เพื่อให้ Report ติดตามรายคนได้
     - สำเร็จ -> status=sent · ล้มเหลว -> failed (+last_error,+retry_count)
     - เคารพโควต้าจริง Gmail (getRemainingDailyQuota) หมดแล้วคงค้าง queued

ฟังก์ชันที่เพิ่ม (Code.gs): buildCampaignMail_, sendQueuedNow, escapeHtml_
UI ที่เพิ่ม (Index.html): ปุ่มส่งคิว + sendQueue()

** ข้อจำกัด: Gmail ฟรีส่งได้ ~100/วัน · ทดสอบกับอีเมลจำนวนน้อยก่อน **

----- สถานะยืนยันแล้ว (2026-06-25) -----
- หน้า training ขึ้นปกติหลัง redeploy           : OK
- หน้า Simulation แสดง 6 การ์ด                  : OK
- หน้า Report คะแนนขึ้นครบ                       : OK
- ส่งเมลทดสอบเข้า Gmail                          : OK
- กดลิงก์ในเมล -> หน้า training ไม่ต้องล็อกอิน   : OK
- แท็บ Campaign กลับมาในเมนู                     : OK
- PHASE 2: ส่งคิวจริงถึงรายชื่อในลิสต์ได้        : OK
=> flow ครบวงจรใช้งานได้จริงตั้งแต่ต้นจนจบ (รวม Phase 2 ส่งจริง)

------------------------------------------------------------
 7) เพิ่มโหมด "สร้างคิวแบบกำหนดเอง" (Manual) ในหน้า Campaign
------------------------------------------------------------
เดิมหน้า Campaign มีแค่ "สร้างคิวแบบสุ่ม" (สุ่มหัวข้อ + สุ่มรายชื่อ active
ตามจำนวน) เพิ่มโหมดที่แอดมินกำหนดเองได้:
  - เลือกหัวข้อ 1 หัวข้อจาก dropdown
  - ติ๊กรายชื่อเป้าหมายที่ต้องการเอง (มีปุ่มเลือกทั้งหมด/ล้าง)
  - กด "สร้างคิวแบบกำหนดเอง"
คงกฎเดิม: เคารพโควต้าเดียวกัน, บันทึกเป็น status='queued', ลิงก์จบที่หน้า
training · อนุญาตเฉพาะอีเมลที่อยู่ในลิสต์เป้าหมาย active (กันฉีดอีเมลนอกลิสต์)
แล้วกด "ส่งคิวจริง" ที่ตารางคิวเพื่อส่งออกได้เหมือนเดิม

ฟังก์ชันที่เพิ่ม (Code.gs): createManualQueue
UI ที่เพิ่ม (Index.html): การ์ด Manual + createManualQueue()/toggleAllTargets()

============================================================
