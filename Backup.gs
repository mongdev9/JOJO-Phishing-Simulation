// Backup.gs — สำรองข้อมูลทั้งฐานเป็นไฟล์ Excel จริง (.xlsx)
// แยกออกจาก Code.gs (2026-06-05) เพื่อไม่ให้ไฟล์หลักยาวเกินไป
// ทุกฟังก์ชันอยู่ใน global scope เดียวกับ Code.gs จึงเรียก HEADERS/rows_/getCurrentUser_/
// requireCustomer_/logAction_/setupDatabase ข้ามไฟล์ได้ตามปกติ
//
// สร้างไฟล์ OOXML เองด้วย Utilities.zip — ไม่ต้องเพิ่ม OAuth scope, ไม่ใช้ไลบรารีภายนอก
// admin = ทุกชีต/ทุกแถว · customer = เฉพาะชีตที่มี customer_id (กรองเป็นของตัวเอง) + MailTopics
function exportDataXlsx() {
  setupDatabase();
  const user = getCurrentUser_();
  requireCustomer_(user);
  const isAdmin = user.role === 'admin';

  const sheetsData = [];
  Object.keys(HEADERS).forEach(function (name) {
    const headers = HEADERS[name];
    if (!headers || !headers.length) return;
    const hasCustomer = headers.indexOf('customer_id') !== -1;
    if (!isAdmin && !hasCustomer && name !== 'MailTopics') return; // customer ไม่เอาชีต config กลาง
    let data = rows_(name);
    if (!isAdmin && hasCustomer) {
      data = data.filter(function (r) { return r.customer_id === user.customer_id; });
    }
    const matrix = data.map(function (r) {
      return headers.map(function (h) { return xlsxVal_(r[h]); });
    });
    sheetsData.push({ name: name, headers: headers, rows: matrix });
  });

  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyyMMdd_HHmm');
  const fileName = 'jojo_backup_' + (isAdmin ? 'all' : (user.customer_id || 'me')) + '_' + stamp + '.xlsx';
  const b64 = xlsxBuild_(sheetsData, fileName);
  logAction_('EXPORT_DATA_XLSX', 'OK', sheetsData.length + ' sheets');
  return { fileName: fileName, b64: b64, sheets: sheetsData.length };
}

function xlsxVal_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  }
  return String(v);
}

function xlsxEsc_(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function xlsxColName_(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function xlsxSheetName_(name) {
  const s = String(name).replace(/[:\\\/?*\[\]]/g, '_');
  return s.length > 31 ? s.substring(0, 31) : s;
}

function xlsxSheetXml_(sd) {
  const allRows = [sd.headers].concat(sd.rows);
  const rowsXml = allRows.map(function (cells, ri) {
    const rnum = ri + 1;
    const cellsXml = cells.map(function (val, ci) {
      const ref = xlsxColName_(ci + 1) + rnum;
      return '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + xlsxEsc_(val) + '</t></is></c>';
    }).join('');
    return '<row r="' + rnum + '">' + cellsXml + '</row>';
  }).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetData>' + rowsXml + '</sheetData></worksheet>';
}

function xlsxBuild_(sheetsData, fileName) {
  const overrides = sheetsData.map(function (sd, i) {
    return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
  }).join('');
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    overrides + '</Types>';
  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';
  const sheetTags = sheetsData.map(function (sd, i) {
    return '<sheet name="' + xlsxEsc_(xlsxSheetName_(sd.name)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
  }).join('');
  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets>' + sheetTags + '</sheets></workbook>';
  const wbRels = sheetsData.map(function (sd, i) {
    return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
  }).join('');
  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + wbRels + '</Relationships>';

  const blobs = [
    Utilities.newBlob(contentTypes, 'application/xml', '[Content_Types].xml'),
    Utilities.newBlob(rootRels, 'application/xml', '_rels/.rels'),
    Utilities.newBlob(workbook, 'application/xml', 'xl/workbook.xml'),
    Utilities.newBlob(workbookRels, 'application/xml', 'xl/_rels/workbook.xml.rels')
  ];
  sheetsData.forEach(function (sd, i) {
    blobs.push(Utilities.newBlob(xlsxSheetXml_(sd), 'application/xml', 'xl/worksheets/sheet' + (i + 1) + '.xml'));
  });
  const zipped = Utilities.zip(blobs, fileName);
  return Utilities.base64Encode(zipped.getBytes());
}
