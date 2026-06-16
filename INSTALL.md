# ติดตั้ง JOJO+ Phishing Simulation (Self-Deploy)

โมเดล **single-tenant**: 1 องค์กร = 1 ชุดของตัวเอง (Google Sheet + Apps Script + Web App deployment)
ไม่มีระบบลูกค้าล็อกอินข้ามองค์กร — แต่ละองค์กรก๊อปไปรันเอง เป็น admin ของข้อมูลตัวเอง

## ขั้นตอน

1. **สร้าง Google Sheet** เปล่า 1 ไฟล์ (เป็นฐานข้อมูล) → จด`Spreadsheet ID` จาก URL
   `https://docs.google.com/spreadsheets/d/`**`<ID>`**`/edit`

2. **เปิด Apps Script** ของชีตนั้น (Extensions → Apps Script) แล้ววางไฟล์ 4 ไฟล์นี้ให้ครบ ชื่อตรงเป๊ะ:
   - `Code.gs`, `Backup.gs`, `Index.html` (ชื่อไฟล์ใน editor = `Index`), `appsscript.json`

3. **แก้ `CONFIG` (บนสุดของ `Code.gs`)**:
   - `developerEmail` → **ปล่อย `''` ได้เลย** — ระบบจะใช้ **เจ้าของชีต** เป็น admin + ชื่อผู้พัฒนาอัตโนมัติ (ก๊อปไปลงบัญชีไหน บัญชีนั้นเป็นเจ้าของเดียว = admin) · จะ override เป็นอีเมลอื่นก็ได้
   - `adminEmails` → admin เพิ่มเติม (ปล่อย `[]` ได้ — โมเดลเจ้าของเดียว)
   - `spreadsheetId` → ID จากข้อ 1
   - `webAppUrl` / `trainingWebAppUrl` → ใส่ทีหลังหลัง deploy (ปล่อย `''` ไปก่อนได้)
   - `seedDemo` → ตั้ง **`false`** ถ้าต้องการฐานข้อมูลสะอาด (ไม่มีลูกค้า/อีเมลตัวอย่าง)

4. **รัน `setupDatabase()` 1 ครั้ง** ใน editor (สร้างชีต/หัวข้อ/คลังคำถามอัตโนมัติ — idempotent รันซ้ำได้)

5. **Deploy 2 ตัว** (Deploy → New deployment → Web app):

   | Deployment | Execute as | Who has access | ใช้ทำ |
   |---|---|---|---|
   | **Admin** | ผู้ใช้ที่เข้าถึง (User accessing) | ทุกคนที่มีบัญชี Google | หน้า admin (ต้องล็อกอิน) |
   | **Training** | ฉัน (Me = เจ้าของชีต) | ทุกคน (Anyone, ไม่ล็อกอิน) | ลิงก์ในเมล → หน้าอบรม |

   > Training ต้อง **Execute as = Me** เพื่อให้รันในนามเจ้าของชีต (recipient ไม่ต้องมีสิทธิ์ชีต)

6. **เอา URL `/exec` ของทั้ง 2 ตัวใส่กลับใน `CONFIG`** (`webAppUrl`, `trainingWebAppUrl`) → save → redeploy แอด admin อีกครั้ง

## ข้อควรระวัง

- **`c` เป็น query param สงวนของ Google** → ลิงก์ training ใช้ `cid=` (ไม่ใช่ `c=`) มิฉะนั้นได้ HTTP 400
- **ห้าม `clasp redeploy` ตัว Training** — clasp เขียนทับ access เป็น "ต้องล็อกอิน" ทุกครั้ง ให้ redeploy ผ่าน UI เท่านั้น (Manage deployments → ✏ → New version)
- ก่อน clasp push: ถ้าเพิ่มไฟล์ `.gs` ใหม่ ต้อง whitelist ใน `.claspignore` ด้วย
- ดูกฎความปลอดภัย Phase 1 ใน `CLAUDE.md` / `README.md` (ไม่ส่งเมลจริงนอกจาก test-send หาตัวเอง, ไม่ clone หน้า login, ลิงก์จบที่หน้าอบรม)
