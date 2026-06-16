// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  CONFIG — แก้เฉพาะบล็อกนี้เมื่อก๊อปไปติดตั้งบนชีต/สคริปต์ของตัวเอง (ดู INSTALL.md)   ║
// ║  โมเดล: single-tenant / self-deploy — 1 องค์กร = 1 ชุด (ชีต+สคริปต์+deployment)  ║
// ╚══════════════════════════════════════════════════════════════════════════╝
const CONFIG = {
  // ผู้พัฒนา (ผู้เขียนซอฟต์แวร์) — แสดงเครดิต "พัฒนาโดย" เสมอ + เป็น admin เสมอ ไม่ว่าติดตั้งบนบัญชีใด
  developerEmail: 'sunart.srisumal@gmail.com',
  // admin เพิ่มเติม — เจ้าของชีต (บัญชีที่ติดตั้ง) เป็น admin อัตโนมัติอยู่แล้ว ปล่อย [] ได้
  adminEmails: [],

  // ID ชีตฐานข้อมูล — ใช้เป็น fallback เมื่อ getActiveSpreadsheet() คืน null
  // ติดตั้งใหม่: ใส่ ID ชีตของตัวเอง
  spreadsheetId: '1tEp9CSHtWZhaSSfh5lDf5mkfT1L5WI7YFiYfsdN-mtM',

  // URL /exec ของ deployment แอด admin — ปล่อย '' ได้ ระบบ auto-detect จาก ScriptApp.getService().getUrl()
  webAppUrl: 'https://script.google.com/macros/s/AKfycbzdPMQHI0NEGys7MhMFbJWEZbWc41M99wllvzDT76Q8rv-enPYVCd9KL7jhV5fRLkPD/exec',

  // URL /exec ของ deployment training แบบ "ทุกคน/ไม่ต้องล็อกอิน" (Execute as Me + Anyone)
  // ปล่อย '' = ใช้ webAppUrl แทน (แต่จะกลายเป็นต้องล็อกอิน) — ดู [[anonymous-training-deployment]]
  trainingWebAppUrl: 'https://script.google.com/macros/s/AKfycbzr9C0vwwFfJ7sJI0SSzfwND1U9tTLrkw6TuTUyM6hoc_rgCRkawKykD5As52jglZw/exec',

  // seed ข้อมูลสาธิต (ลูกค้า SUNART/TFP + อีเมล/ผลตัวอย่าง) — ติดตั้งใช้งานจริงให้ตั้ง false เพื่อ DB สะอาด
  seedDemo: true
};

const APP = {
  name: 'JOJO+ Phishing Simulation',
  version: '1',
  developer: CONFIG.developerEmail,
  logFileName: 'jojo_phishing_log.txt',
  defaults: {
    maxDomains: 3,
    maxTargetEmails: 300,
    maxSendDay: 10
  }
};

// ID ชีต (มาจาก CONFIG) — เก็บแยกไม่ให้ถูกส่งไปฝั่ง client ผ่าน getBootstrap
const SPREADSHEET_ID = CONFIG.spreadsheetId;

// เพิ่มเลขนี้ทุกครั้งที่แก้ HEADERS/seed เพื่อบังคับ setupDatabase รันใหม่ 1 ครั้งหลัง deploy
const SCHEMA_VERSION = 13;

// กลุ่มคำถามอบรม (5 กลุ่ม) — code ใช้ในชีต Questions, label แสดงผลภาษาไทย
const QUESTION_GROUPS = [
  { code: 'link',    label: 'ลิงก์ & โดเมนปลอม' },
  { code: 'cred',    label: 'รหัสผ่าน & OTP/MFA' },
  { code: 'finance', label: 'การเงิน & ใบแจ้งหนี้' },
  { code: 'file',    label: 'ไฟล์แนบ & อุปกรณ์' },
  { code: 'social',  label: 'Social Engineering' }
];

// เพดานโควต้าส่งต่อวัน (ใช้ตอนสร้างคิว Campaign) — แก้ค่าจริงได้ที่ชีต Settings
const QUOTA_DEFAULTS = {
  platformDailyCap: 100, // Gmail free hard cap ของทั้งแพลตฟอร์ม
  customerDailyCap: 30   // เพดานต่อ 1 ลูกค้า/วัน (กันลูกค้าเดียวกินโควต้าหมด)
};

// อีเมลที่เป็น admin เสมอ (มาจาก CONFIG — นอกเหนือจากที่อยู่ในชีต Customers และเจ้าของชีต)
const ADMIN_EMAILS = CONFIG.adminEmails;

const SHEETS = {
  customers: 'Customers',
  emailList: 'EmailList',
  mailTopics: 'MailTopics',
  questions: 'Questions',
  schedule: 'Schedule',
  oldTopics: 'OldTopics',
  queue: 'Queue',
  results: 'Results',
  reports: 'Reports',
  settings: 'Settings',
  logs: 'Logs'
};

const HEADERS = {
  Customers: ['customer_id', 'login_email', 'role', 'allowed_domains', 'max_send_day', 'status', 'created_at', 'last_login'],
  EmailList: ['customer_id', 'email', 'description', 'status', 'clicked', 'replied', 'trained', 'last_sent', 'fullname', 'department'],
  MailTopics: ['topic', 'context', 'category', 'active', 'created_at', 'question', 'choices', 'correct', 'explain'],
  Questions: ['customer_id', 'group', 'question', 'choices', 'correct', 'explain', 'active', 'source', 'created_at'],
  Schedule: ['customer_id', 'date', 'count', 'status', 'created_at', 'emails'],
  OldTopics: ['topic', 'context', 'category', 'active', 'created_at', 'archived_at'],
  Queue: ['customer_id', 'email', 'topic', 'send_date', 'status', 'retry_count', 'last_error'],
  Results: ['customer_id', 'email', 'action', 'action_time', 'topic', 'score'],
  Reports: ['timestamp', 'customer_id', 'report_type', 'summary'],
  Settings: ['key', 'value', 'description'],
  Logs: ['timestamp', 'customer_id', 'user_email', 'role', 'action', 'result', 'error_message']
};

function doGet(e) {
  const page = e && e.parameter && e.parameter.page;
  if (page === 'training') {
    return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle(APP.name + ' Training')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  setupDatabase();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(APP.name)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function setupDatabase() {
  // Perf: ถ้า setup เสร็จแล้วในช่วงนี้ ข้ามไปเลย (เร็วขึ้นมากทุกการเรียก)
  const cache = CacheService.getScriptCache();
  const cacheKey = 'db_ready_v' + SCHEMA_VERSION;
  if (cache.get(cacheKey)) return { ok: true, cached: true };

  const ss = activeSpreadsheet_();
  Object.keys(SHEETS).forEach(function (key) {
    const name = SHEETS[key];
    const sheet = getOrCreateSheet_(ss, name);
    ensureHeaders_(sheet, HEADERS[name]);
  });
  // จำเป็นเสมอ: ตั้งค่า, admin, เนื้อหาอบรม (หัวข้อ + คลังคำถาม)
  seedSettings_();
  seedAdmin_();
  seedTopics_();
  seedExtraTopics_();
  seedQuestions_();
  seedScamQuestions_();
  // ข้อมูลสาธิตเท่านั้น (ลูกค้าตัวอย่าง + อีเมล/ผล) — ปิดได้ด้วย CONFIG.seedDemo=false สำหรับติดตั้งจริง
  if (CONFIG.seedDemo) {
    seedInitialCustomers_();
    seedDemoSimulation_();
    seedIsolationDemo_();
  }
  cache.put(cacheKey, '1', 21600); // 6 ชั่วโมง
  return { ok: true, message: 'Database ready' };
}

function getBootstrap() {
  setupDatabase();
  _rowsCache = {}; // เปิด cache อ่านชีตเฉพาะใน request นี้ (อ่านอย่างเดียว)
  try {
    const user = getCurrentUser_();
    logAction_('BOOTSTRAP', 'OK', '');
    return jsonSafe_({
      app: APP,
      appUrl: getAppUrl_(),
      trainingUrl: getTrainingUrl_(),
      user: user,
      dashboard: getDashboardData(),
      topics: rows_(SHEETS.mailTopics),
      emailList: listEmailTargets(),
      queue: listQueue(),
      results: listResults(),
      logs: listLogs(100),
      settings: getSettings(),
      quota: computeQuota_(user),
      questions: manageableQuestions_(user),
      questionGroups: questionGroupCounts_(user)
    });
  } finally {
    _rowsCache = null; // ปิด cache เสมอ กันค่าค้างไปถึง request ที่มีการเขียน
  }
}

function getCurrentUser() {
  setupDatabase();
  return getCurrentUser_();
}

function getDashboardData() {
  setupDatabase();
  const user = getCurrentUser_();
  const customers = rows_(SHEETS.customers);
  const emailRows = scopeRows_(rows_(SHEETS.emailList), 'customer_id', user);
  const queueRows = scopeRows_(rows_(SHEETS.queue), 'customer_id', user);
  const resultRows = scopeRows_(rows_(SHEETS.results), 'customer_id', user);
  const scopedCustomers = user.role === 'admin'
    ? customers
    : customers.filter(function (row) { return row.customer_id === user.customer_id; });

  return {
    customers: scopedCustomers.length,
    users: emailRows.length,
    sent: queueRows.filter(function (row) { return row.status === 'sent'; }).length,
    queue: queueRows.filter(function (row) { return row.status === 'queued'; }).length,
    clicked: resultRows.filter(function (row) { return row.action === 'clicked'; }).length,
    trained: resultRows.filter(function (row) { return row.action === 'trained'; }).length
  };
}

function listEmailTargets() {
  setupDatabase();
  const user = getCurrentUser_();
  return scopeRows_(rows_(SHEETS.emailList), 'customer_id', user);
}

function listTopics() {
  setupDatabase();
  return rows_(SHEETS.mailTopics).filter(function (row) {
    return String(row.active).toLowerCase() !== 'false';
  });
}

function getTrainingTopic(topicName) {
  setupDatabase();
  const name = String(topicName || '').toLowerCase().trim();
  const match = rows_(SHEETS.mailTopics).filter(function (row) {
    return String(row.active).toLowerCase() !== 'false'
      && String(row.topic).toLowerCase().trim() === name;
  })[0];

  logAction_('GET_TRAINING_TOPIC', match && match.question ? 'OK' : 'FALLBACK', topicName || '');

  if (match && String(match.question || '').trim()) {
    return {
      topic: match.topic,
      context: match.context || '',
      question: match.question,
      choices: splitChoices_(match.choices),
      correct: Number(match.correct) || 0,
      explain: match.explain || ''
    };
  }
  return defaultTrainingTopic_();
}

function defaultTrainingTopic_() {
  return {
    topic: 'Awareness Training',
    context: '',
    question: 'คุณควรทำอย่างไรเมื่อได้รับข้อความที่น่าสงสัยและเร่งด่วน?',
    choices: ['ทำตามทันทีเพราะเร่งด่วน', 'หยุดและตรวจสอบผ่านช่องทางที่เชื่อถือได้'],
    correct: 2,
    explain: 'ความเร่งด่วนคือสัญญาณเตือนที่พบบ่อย ให้ตรวจสอบผ่านช่องทางที่รู้จักก่อนเสมอ'
  };
}

function splitChoices_(value) {
  return String(value || '').split('|').map(function (item) {
    return item.trim();
  }).filter(Boolean);
}

/* ===== คลังคำถามอบรม (Questions) — สุ่ม 3 ข้อ + customer เพิ่ม/upload เองได้ ===== */

// คำถามที่ org หนึ่งใช้ได้ = คลังกลาง (customer_id ว่าง/GLOBAL) + ของ org นั้นเอง, เฉพาะ active
function questionsForOrg_(customerId) {
  const org = String(customerId || '');
  return rows_(SHEETS.questions).filter(function (r) {
    if (String(r.active).toLowerCase() === 'false') return false;
    const cid = String(r.customer_id || '');
    return cid === '' || cid.toUpperCase() === 'GLOBAL' || cid === org;
  });
}

// คำถามที่ผู้ใช้จัดการได้ (admin = ทั้งหมด, customer = เฉพาะของ org ตัวเอง)
function manageableQuestions_(user) {
  const all = rows_(SHEETS.questions);
  if (user.role === 'admin') return all;
  // customer เห็นคลังกลาง (GLOBAL) + ของหน่วยงานตัวเอง (แก้/ลบได้เฉพาะของตัวเอง — เช็คฝั่ง client/server)
  return all.filter(function (r) {
    return String(r.customer_id) === user.customer_id || String(r.customer_id).toUpperCase() === 'GLOBAL';
  });
}

function questionGroupCounts_(user) {
  // admin เห็น/นับทุกคำถามในระบบ · customer เห็นเฉพาะคลังกลาง + ของหน่วยงานตัวเอง
  const pool = user.role === 'admin' ? rows_(SHEETS.questions) : questionsForOrg_(user.customer_id);
  return QUESTION_GROUPS.map(function (g) {
    const n = pool.filter(function (r) { return String(r.group).toLowerCase().trim() === g.code; }).length;
    return { code: g.code, label: g.label, count: n };
  });
}

function listQuestions() {
  setupDatabase();
  const user = getCurrentUser_();
  requireCustomer_(user);
  return jsonSafe_({ questions: manageableQuestions_(user), questionGroups: questionGroupCounts_(user) });
}

// PUBLIC (เข้าถึงได้จากหน้า training ของพนักงาน/anonymous) — สุ่ม 3 ข้อไม่ซ้ำจากกลุ่มที่ระบุ
// ไม่มีการ scope แบบ admin/customer ที่นี่โดยตั้งใจ: รับ customer_id จาก client (เหมือน recordTrainingAction)
function getTrainingQuiz(group, customerId) {
  setupDatabase();
  const g = String(group || '').toLowerCase().trim();
  let pool = questionsForOrg_(customerId);
  if (g) {
    const byGroup = pool.filter(function (r) { return String(r.group).toLowerCase().trim() === g; });
    if (byGroup.length) pool = byGroup;
  }
  const picked = shuffle_(pool).slice(0, 3).map(function (r) {
    return {
      group: r.group,
      question: String(r.question || ''),
      choices: splitChoices_(r.choices),
      correct: Number(r.correct) || 0,
      explain: String(r.explain || '')
    };
  });
  logAction_('GET_TRAINING_QUIZ', picked.length ? 'OK' : 'FALLBACK', (group || '') + ' x' + picked.length);
  if (!picked.length) {
    const d = defaultTrainingTopic_();
    return jsonSafe_([{ group: 'general', question: d.question, choices: d.choices, correct: d.correct, explain: d.explain }]);
  }
  return jsonSafe_(picked);
}

// ปฏิเสธเนื้อหาที่อาจกลายเป็น "ลิงก์/สคริปต์จริง" — บังคับให้เป็นข้อความล้วนเท่านั้น
// (URL เปล่า ๆ ที่เป็นข้อความยังใส่ได้ เพราะฝั่ง client escape แล้ว กดไม่ได้)
function assertSafeContent_(text) {
  const s = String(text || '');
  if (/javascript:/i.test(s) || /on\w+\s*=/i.test(s) || /<\s*\/?\s*[a-z][^>]*>/i.test(s)) {
    throw new Error('เนื้อหามี HTML/แท็ก/ลิงก์ที่ไม่อนุญาต — กรุณาใส่เป็นข้อความล้วน');
  }
}

// ตรวจ + ทำให้เป็นมาตรฐาน 1 คำถาม (ใช้ทั้ง add และ import) — คืน array แถวพร้อมเขียน หรือ throw
function normalizeQuestion_(item, ownerId, source) {
  const groupCodes = QUESTION_GROUPS.map(function (g) { return g.code; });
  const group = String(item && item.group || '').toLowerCase().trim();
  if (groupCodes.indexOf(group) === -1) throw new Error('กลุ่มไม่ถูกต้อง: ' + group);
  const question = String(item && item.question || '').trim();
  if (!question) throw new Error('คำถามว่าง');
  const choices = splitChoices_(item && item.choices);
  if (choices.length < 2) throw new Error('ต้องมีตัวเลือกอย่างน้อย 2 ข้อ (คั่นด้วย |)');
  const correct = Number(item && item.correct) || 0;
  if (!(correct >= 1 && correct <= choices.length)) throw new Error('ข้อถูกต้องไม่อยู่ในช่วงตัวเลือก');
  const explain = String(item && item.explain || '').trim();
  assertSafeContent_(question);
  choices.forEach(assertSafeContent_);
  assertSafeContent_(explain);
  return [ownerId, group, question, choices.join('|'), correct, explain, true, source || 'manual', new Date()];
}

function bankOwnerId_(user) {
  return user.role === 'admin' ? 'GLOBAL' : user.customer_id;
}

function addQuestionRow(data) {
  setupDatabase();
  const user = getCurrentUser_();
  requireCustomer_(user);
  const row = normalizeQuestion_(data, bankOwnerId_(user), 'manual');
  sheet_(SHEETS.questions).appendRow(row);
  logAction_('ADD_QUESTION', 'OK', row[1]);
  return jsonSafe_({ questions: manageableQuestions_(user), questionGroups: questionGroupCounts_(user) });
}

function deleteQuestionRow(rowIndex) {
  setupDatabase();
  const user = getCurrentUser_();
  requireCustomer_(user);
  const sheet = sheet_(SHEETS.questions);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const r = Number(rowIndex);
  if (!(r >= 2 && r <= values.length)) throw new Error('แถวไม่ถูกต้อง');
  const ci = headers.indexOf('customer_id');
  if (user.role !== 'admin' && String(values[r - 1][ci]) !== user.customer_id) {
    throw new Error('ลบได้เฉพาะคำถามของหน่วยงานคุณเท่านั้น');
  }
  sheet.deleteRow(r);
  logAction_('DELETE_QUESTION', 'OK', String(rowIndex));
  return jsonSafe_({ questions: manageableQuestions_(user), questionGroups: questionGroupCounts_(user) });
}

function toggleQuestion(data) {
  setupDatabase();
  const user = getCurrentUser_();
  requireCustomer_(user);
  const sheet = sheet_(SHEETS.questions);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const r = Number(data && data.row_index);
  if (!(r >= 2 && r <= values.length)) throw new Error('แถวไม่ถูกต้อง');
  const ci = headers.indexOf('customer_id');
  if (user.role !== 'admin' && String(values[r - 1][ci]) !== user.customer_id) {
    throw new Error('แก้ได้เฉพาะคำถามของหน่วยงานคุณเท่านั้น');
  }
  sheet.getRange(r, headers.indexOf('active') + 1).setValue(!!(data && data.active));
  logAction_('TOGGLE_QUESTION', 'OK', r + '=' + !!(data && data.active));
  return jsonSafe_({ questions: manageableQuestions_(user), questionGroups: questionGroupCounts_(user) });
}

// import จากแถวที่ client แปลงมาแล้ว (CSV ที่อ่านในเบราว์เซอร์)
function importQuestions(payload) {
  setupDatabase();
  const user = getCurrentUser_();
  requireCustomer_(user);
  const items = (payload && payload.rows) || [];
  return jsonSafe_(importQuestionItems_(items, user, 'upload:csv'));
}

// import จากลิงก์ Google Sheet (online) — อ่านชีตแรก, แถวแรกเป็นหัวคอลัมน์
function importQuestionsFromSheet(url) {
  setupDatabase();
  const user = getCurrentUser_();
  requireCustomer_(user);
  let ss;
  try {
    ss = SpreadsheetApp.openByUrl(String(url || ''));
  } catch (e) {
    throw new Error('เปิดลิงก์ Google Sheet ไม่ได้ — ตรวจสิทธิ์การเข้าถึง/ลิงก์');
  }
  const data = ss.getSheets()[0].getDataRange().getValues();
  if (data.length < 2) throw new Error('ชีตไม่มีข้อมูล');
  const head = data[0].map(function (h) { return String(h).toLowerCase().trim(); });
  const idx = {
    group: head.indexOf('group'),
    question: head.indexOf('question'),
    choices: head.indexOf('choices'),
    correct: head.indexOf('correct'),
    explain: head.indexOf('explain')
  };
  if (idx.group < 0 || idx.question < 0 || idx.choices < 0 || idx.correct < 0) {
    throw new Error('หัวคอลัมน์ต้องมี: group, question, choices, correct, explain');
  }
  const items = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!String(row[idx.question] || '').trim()) continue;
    items.push({
      group: row[idx.group],
      question: row[idx.question],
      choices: row[idx.choices],
      correct: row[idx.correct],
      explain: idx.explain >= 0 ? row[idx.explain] : ''
    });
  }
  return jsonSafe_(importQuestionItems_(items, user, 'upload:sheet'));
}

function importQuestionItems_(items, user, source) {
  const ownerId = bankOwnerId_(user);
  const rowsToAdd = [];
  const errors = [];
  items.forEach(function (item, i) {
    try {
      rowsToAdd.push(normalizeQuestion_(item, ownerId, source));
    } catch (e) {
      errors.push('แถว ' + (i + 1) + ': ' + e.message);
    }
  });
  if (rowsToAdd.length) {
    const sheet = sheet_(SHEETS.questions);
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, HEADERS.Questions.length).setValues(rowsToAdd);
  }
  logAction_('IMPORT_QUESTIONS', 'OK', source + ' added=' + rowsToAdd.length + ' err=' + errors.length);
  return {
    added: rowsToAdd.length,
    errors: errors,
    questions: manageableQuestions_(user),
    questionGroups: questionGroupCounts_(user)
  };
}

function listQueue() {
  setupDatabase();
  const user = getCurrentUser_();
  return scopeRows_(rows_(SHEETS.queue), 'customer_id', user);
}

function listResults() {
  setupDatabase();
  const user = getCurrentUser_();
  return scopeRows_(rows_(SHEETS.results), 'customer_id', user);
}

// โควต้าส่งเมลจริงของ Google ที่เหลือวันนี้ (ใช้ scope script.send_mail)
// หุ้มด้วย try/catch เพื่อไม่ให้พังถ้าผู้ใช้ยังไม่ได้อนุญาตสิทธิ์หรือเรียกไม่ได้
function getGoogleMailQuota() {
  try {
    const remaining = MailApp.getRemainingDailyQuota();
    logAction_('GOOGLE_MAIL_QUOTA', 'OK', String(remaining));
    return { ok: true, remaining: remaining };
  } catch (e) {
    logAction_('GOOGLE_MAIL_QUOTA', 'ERROR', String(e && e.message || e));
    return { ok: false, error: String(e && e.message || e) };
  }
}

// ข้อมูลรายงานผล: funnel + KPI, รายคน, แยกตามกลุ่มหัวข้อ (scope ตาม org)
function getReportData() {
  setupDatabase();
  const user = getCurrentUser_();
  requireCustomer_(user);
  const targets = scopeRows_(rows_(SHEETS.emailList), 'customer_id', user);
  const results = scopeRows_(rows_(SHEETS.results), 'customer_id', user);
  const queue = scopeRows_(rows_(SHEETS.queue), 'customer_id', user);

  // รวมผลต่ออีเมล
  const byEmail = {};
  results.forEach(function (r) {
    const e = String(r.email || '').toLowerCase();
    if (!e) return;
    const o = byEmail[e] || (byEmail[e] = { clicked: false, trained: false, passed: false, score: 0 });
    const a = String(r.action || '').toLowerCase();
    if (a === 'clicked') o.clicked = true;
    if (a === 'trained' || a === 'passed') { o.trained = true; o.clicked = true; }
    if (a === 'passed') o.passed = true;
    const sc = Number(r.score);
    if (!isNaN(sc) && sc > o.score) o.score = sc;
  });

  const people = targets.map(function (t) {
    const e = String(t.email || '').toLowerCase();
    const o = byEmail[e] || { clicked: false, trained: false, passed: false, score: 0 };
    return {
      email: t.email, fullname: t.fullname || '', department: t.department || '',
      clicked: o.clicked, trained: o.trained, passed: o.passed, score: o.score
    };
  });

  const totalTargets = people.length;
  const clicked = people.filter(function (p) { return p.clicked; }).length;
  const trained = people.filter(function (p) { return p.trained; }).length;
  const passed = people.filter(function (p) { return p.passed; }).length;

  // แยกตามกลุ่ม (Results.topic = group code ที่บันทึกจากหน้า quiz)
  const groups = {};
  QUESTION_GROUPS.forEach(function (g) { groups[g.code] = { code: g.code, label: g.label, attempts: 0, passed: 0 }; });
  results.forEach(function (r) {
    const g = String(r.topic || '').toLowerCase().trim();
    const a = String(r.action || '').toLowerCase();
    if (groups[g] && (a === 'trained' || a === 'passed')) {
      groups[g].attempts++;
      if (a === 'passed') groups[g].passed++;
    }
  });

  return jsonSafe_({
    funnel: {
      targets: totalTargets,
      sent: queue.length,
      clicked: clicked,
      trained: trained,
      passed: passed,
      passRate: totalTargets ? Math.round(passed / totalTargets * 100) : 0,
      passOfTrained: trained ? Math.round(passed / trained * 100) : 0,
      clickRate: totalTargets ? Math.round(clicked / totalTargets * 100) : 0
    },
    people: people,
    groups: QUESTION_GROUPS.map(function (g) { return groups[g.code]; }),
    quota: computeQuota_(user),
    org: user.customer_id || 'ALL',
    generatedBy: user.email
  });
}

function listLogs(limit) {
  setupDatabase();
  const user = getCurrentUser_();
  const logs = scopeRows_(rows_(SHEETS.logs), 'customer_id', user);
  return logs.slice(Math.max(logs.length - (limit || 100), 0)).reverse();
}

function getSettings() {
  setupDatabase();
  return rows_(SHEETS.settings);
}

function addEmailTargets(payload) {
  setupDatabase();
  const user = getCurrentUser_();
  requireCustomer_(user);

  const text = payload && payload.text ? String(payload.text) : '';
  const parsed = parseEmailText_(text);
  const customer = getCustomer_(user.customer_id);
  const allowedDomains = splitCsv_(customer.allowed_domains);
  const existingRows = rows_(SHEETS.emailList).filter(function (row) {
    return row.customer_id === user.customer_id;
  });
  const existing = {};
  existingRows.forEach(function (row) { existing[String(row.email).toLowerCase()] = true; });

  const maxTargets = Number(getSettingValue_('max_target_emails', APP.defaults.maxTargetEmails));
  const sheet = sheet_(SHEETS.emailList);
  const added = [];
  const rejected = [];

  parsed.forEach(function (item) {
    const email = item.email.toLowerCase();
    const domain = email.split('@')[1] || '';
    if (!isValidEmail_(email)) {
      rejected.push({ email: item.email, reason: 'invalid_email' });
      return;
    }
    if (allowedDomains.length && allowedDomains.indexOf(domain) === -1) {
      rejected.push({ email: item.email, reason: 'domain_not_allowed' });
      return;
    }
    if (existing[email]) {
      rejected.push({ email: item.email, reason: 'duplicate' });
      return;
    }
    if (existingRows.length + added.length >= maxTargets) {
      rejected.push({ email: item.email, reason: 'quota_exceeded' });
      return;
    }
    existing[email] = true;
    added.push([user.customer_id, email, item.description, 'active', false, false, false, '', '', '']);
  });

  if (added.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, added.length, HEADERS.EmailList.length).setValues(added);
  }

  logAction_('ADD_EMAIL_TARGETS', 'OK', 'added=' + added.length + ', rejected=' + rejected.length);
  return jsonSafe_({
    added: added.length,
    rejected: rejected,
    emailList: listEmailTargets(),
    dashboard: getDashboardData()
  });
}

// คืนสถานะโควต้าของวันนี้สำหรับผู้ใช้ปัจจุบัน (ใช้แสดงบนหน้า Campaign)
function getQuotaInfo() {
  setupDatabase();
  return jsonSafe_(computeQuota_(getCurrentUser_()));
}

// คิดโควต้าจากคิวที่มี send_date เป็นวันนี้ (Phase 1: queue-only นับเป็นการใช้โควต้า)
// FCFS — ไม่มี reservation, เช็คทั้งเพดานลูกค้าและเพดานแพลตฟอร์มพร้อมกัน
function computeQuota_(user) {
  const platformCap = Number(getSettingValue_('platform_daily_cap', QUOTA_DEFAULTS.platformDailyCap)) || QUOTA_DEFAULTS.platformDailyCap;
  const customerCap = Number(getSettingValue_('customer_daily_cap', QUOTA_DEFAULTS.customerDailyCap)) || QUOTA_DEFAULTS.customerDailyCap;
  const today = new Date();
  let platformToday = 0;
  let customerToday = 0;
  rows_(SHEETS.queue).forEach(function (row) {
    if (!row.send_date || !isSameDay_(row.send_date, today)) return;
    platformToday++;
    if (String(row.customer_id) === String(user.customer_id)) customerToday++;
  });
  const customerRemaining = Math.max(0, customerCap - customerToday);
  const platformRemaining = Math.max(0, platformCap - platformToday);
  return {
    platform_cap: platformCap,
    customer_cap: customerCap,
    platform_today: platformToday,
    customer_today: customerToday,
    platform_remaining: platformRemaining,
    customer_remaining: customerRemaining,
    // single-tenant: เหลือลิมิตเดียว = เพดานต่อวันของ Gmail (platform_daily_cap, ดีฟอลต์ 100) ไม่บังคับ customer cap
    available: platformRemaining
  };
}

function isSameDay_(value, ref) {
  const d = new Date(value);
  return d.getFullYear() === ref.getFullYear()
    && d.getMonth() === ref.getMonth()
    && d.getDate() === ref.getDate();
}

function createRandomQueue(payload) {
  setupDatabase();
  const user = getCurrentUser_();
  requireCustomer_(user);

  const quota = computeQuota_(user);
  if (quota.available <= 0) {
    logAction_('CREATE_RANDOM_QUEUE', 'BLOCKED', 'quota_full');
    return jsonSafe_({
      queued: 0, requested: 0, clamped: false, blocked: true,
      message: 'วันนี้เต็มโควต้าแล้ว ลองใหม่พรุ่งนี้',
      queue: listQueue(), dashboard: getDashboardData(), quota: quota
    });
  }

  const requested = Math.max(1, Number(payload && payload.count) || 1);
  const count = Math.min(requested, quota.available);

  // หัวข้อที่ผู้ใช้ติ๊กเลือกมา (ถ้าไม่ส่งมา = ใช้หัวข้อ active ทั้งหมด)
  const selected = (payload && payload.topics && payload.topics.length)
    ? payload.topics.map(function (t) { return String(t).toLowerCase().trim(); })
    : null;
  let topicPool = listTopics();
  if (selected) {
    topicPool = topicPool.filter(function (t) {
      return selected.indexOf(String(t.topic).toLowerCase().trim()) !== -1;
    });
  }
  const topics = shuffle_(topicPool);

  const targets = shuffle_(listEmailTargets().filter(function (row) { return row.status === 'active'; }));
  const sheet = sheet_(SHEETS.queue);
  const rowsToAdd = [];
  const now = new Date();

  targets.slice(0, count).forEach(function (target, index) {
    const topic = topics.length ? topics[index % topics.length] : null;
    rowsToAdd.push([
      user.customer_id,
      target.email,
      topic ? topic.topic : 'Awareness Training',
      new Date(now.getTime() + randomInt_(5, 180) * 60000),
      'queued',
      0,
      ''
    ]);
  });

  if (rowsToAdd.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, HEADERS.Queue.length).setValues(rowsToAdd);
  }

  const after = computeQuota_(user);
  const noTargets = targets.length === 0;
  logAction_('CREATE_RANDOM_QUEUE', 'OK', 'queued=' + rowsToAdd.length + ', requested=' + requested);
  return jsonSafe_({
    queued: rowsToAdd.length,
    requested: requested,
    clamped: requested > count,        // ถูกตัดเพราะโควต้าไม่พอ
    noTargets: noTargets,              // ไม่มีรายชื่อเป้าหมาย active
    blocked: false,
    queue: listQueue(),
    dashboard: getDashboardData(),
    quota: after
  });
}

/* ===== Schedule (ปฏิทิน) + Google time-trigger ยิงอัตโนมัติรายวัน ===== */

function todayStr_() { return dateStr_(new Date()); }
function dateStr_(d) { return Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

// ปฏิทินของหน่วยงานผู้ใช้ + สถานะ trigger (สำหรับ admin)
// สร้างเนื้อหาเมลจำลอง (ใช้ร่วมทั้ง preview และ send จริง) — ผู้ส่งที่แสดงเป็นชื่อ "ลวง"
// เพื่อความสมจริงในหน้าจำลองเท่านั้น (ตอนส่งจริงผู้ส่งคือบัญชีระบบ ไม่ปลอม)
function buildTestMail_(user) {
  // ใช้ cid= (ไม่ใช่ c=) เพราะ c เป็นพารามิเตอร์สงวนของ Google → /exec ตอบ 400 ก่อนถึงสคริปต์
  const link = getTrainingUrl_() + '?page=training&g=link&cid=' + encodeURIComponent(user.customer_id || '');
  return {
    to: user.email,
    fromName: 'IT Support',
    fromEmail: 'it-support@account-verify-secure.com',
    subject: 'บัญชีอีเมลของคุณต้องยืนยันด่วนภายใน 24 ชั่วโมง',
    link: link,
    html:
      '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e6ece9;border-radius:10px;overflow:hidden">' +
        '<div style="background:#1c4733;color:#fff;padding:14px 18px;font-size:16px;font-weight:bold">⚠ การแจ้งเตือนความปลอดภัยบัญชี</div>' +
        '<div style="padding:18px">' +
          '<p>เรียนผู้ใช้งาน</p>' +
          '<p>ระบบตรวจพบกิจกรรมผิดปกติ บัญชีอีเมลของคุณจะถูกระงับใน <b>24 ชั่วโมง</b> หากไม่ยืนยันตัวตน</p>' +
          '<p style="text-align:center;margin:22px 0">' +
            '<a href="' + link + '" style="background:#2f8f5b;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">ยืนยันบัญชีทันที</a>' +
          '</p>' +
          '<p style="color:#7c8a83;font-size:12px;border-top:1px solid #e6ece9;padding-top:12px;margin-top:18px">' +
            'อีเมลนี้เป็นการ<b>จำลองเพื่อฝึกความตระหนักรู้</b>ของ JOJO+ Phishing Simulation — ' +
            'ลิงก์ทั้งหมดนำไปยัง<b>หน้าอบรม</b>เท่านั้น ไม่มีการเก็บรหัสผ่าน หากเป็นอีเมลจริงให้สังเกตจุดเตือนเหล่านี้และรายงาน IT' +
          '</p>' +
        '</div>' +
      '</div>'
  };
}

// ดูตัวอย่างเมลจำลอง (ไม่ส่งจริง ไม่เสียโควต้า) — สำหรับหน้าจำลองสไตล์ Outlook
function previewTestMail() {
  setupDatabase();
  const user = getCurrentUser_();
  requireCustomer_(user);
  const m = buildTestMail_(user);
  logAction_('PREVIEW_TEST_MAIL', 'OK', '');
  return jsonSafe_({ to: m.to, fromName: m.fromName, fromEmail: m.fromEmail, subject: m.subject, html: m.html });
}

// ทดสอบส่งเมลจริง — ส่งหา "อีเมลของผู้ใช้ปัจจุบันเท่านั้น" เพื่อดูเนื้อหา+ตามลิงก์
// ปลอดภัย: ไม่ส่งหาผู้อื่น, ไม่ปลอมผู้ส่ง (ส่งในนามบัญชีที่รันสคริปต์), ลิงก์จบที่หน้าอบรม
// ใช้ scope script.send_mail ที่มีอยู่แล้ว (ไม่เพิ่ม scope)
function sendTestMail() {
  setupDatabase();
  const user = getCurrentUser_();
  requireCustomer_(user);
  // ความปลอดภัย: ส่งจริงได้เฉพาะ "อีเมลของบัญชีที่ล็อกอินอยู่จริง" เท่านั้น
  // ใช้ Session โดยตรง (ไม่ใช่ user.email) เพื่อให้แม้อยู่ในโหมดจำลองลูกค้า ก็ส่งเข้ากล่องตัวเองเสมอ ไม่ส่งหาผู้อื่น
  const realEmail = (Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!realEmail) throw new Error('ไม่พบอีเมลของผู้ใช้ปัจจุบัน');
  const m = buildTestMail_(user);
  MailApp.sendEmail({ to: realEmail, subject: '[ทดสอบจำลอง] ' + m.subject, htmlBody: m.html, name: 'JOJO+ Awareness (ทดสอบ)' });
  logAction_('SEND_TEST_MAIL', 'OK', realEmail);
  return jsonSafe_({ ok: true, to: realEmail });
}

function getSchedule() {
  setupDatabase();
  const user = getCurrentUser_();
  requireCustomer_(user);
  const days = rows_(SHEETS.schedule)
    .filter(function (r) { return String(r.customer_id) === user.customer_id; })
    .map(function (r) {
      return {
        date: String(r.date),
        count: Number(r.count) || 0,
        status: String(r.status || ''),
        emails: String(r.emails || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean)
      };
    });
  return jsonSafe_({
    days: days,
    today: todayStr_(),
    isAdmin: user.role === 'admin',
    trigger: triggerStatus_()
  });
}

// ตั้ง/ลบ การส่งของวันหนึ่ง (count=0 = ลบ) — upsert ในชีต
function setScheduleDay(payload) {
  setupDatabase();
  const user = getCurrentUser_();
  requireCustomer_(user);
  const date = String(payload && payload.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('วันที่ไม่ถูกต้อง');
  // รายชื่ออีเมลที่เลือกส่งวันนั้น (ถ้าส่งมา) — count = จำนวนอีเมลที่เลือก
  const emails = (payload && Array.isArray(payload.emails))
    ? payload.emails.map(function (e) { return String(e).trim(); }).filter(Boolean)
    : [];
  const emailsCsv = emails.join(',');
  const count = emails.length ? emails.length : Math.max(0, Number(payload && payload.count) || 0);

  const sheet = sheet_(SHEETS.schedule);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const ci = headers.indexOf('customer_id');
  const di = headers.indexOf('date');
  const emi = headers.indexOf('emails');
  let foundRow = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][ci]) === user.customer_id && String(values[i][di]) === date) { foundRow = i + 1; break; }
  }
  if (count <= 0) {
    if (foundRow > 0) sheet.deleteRow(foundRow);
  } else if (foundRow > 0) {
    sheet.getRange(foundRow, headers.indexOf('count') + 1).setValue(count);
    sheet.getRange(foundRow, headers.indexOf('status') + 1).setValue('scheduled');
    if (emi >= 0) sheet.getRange(foundRow, emi + 1).setValue(emailsCsv);
  } else {
    sheet.appendRow([user.customer_id, date, count, 'scheduled', new Date(), emailsCsv]);
  }
  logAction_('SET_SCHEDULE_DAY', 'OK', date + '=' + count + (emails.length ? ' emails=' + emails.length : ''));
  return getSchedule();
}

// เป้าหมายของ trigger — รันทุกวัน: หา schedule ของ "วันนี้" แล้วสร้างคิวให้แต่ละหน่วยงาน
function runDailySchedule() {
  setupDatabase();
  const today = todayStr_();
  const sheet = sheet_(SHEETS.schedule);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const ci = headers.indexOf('customer_id');
  const di = headers.indexOf('date');
  const cnt = headers.indexOf('count');
  const st = headers.indexOf('status');
  const emi = headers.indexOf('emails');
  let done = 0;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][di]) !== today) continue;
    if (String(values[i][st]).toLowerCase() === 'done') continue;
    const emailsList = emi >= 0
      ? String(values[i][emi] || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean)
      : [];
    const made = createQueueForCustomer_(String(values[i][ci]), Number(values[i][cnt]) || 1, emailsList);
    sheet.getRange(i + 1, st + 1).setValue('done');
    done += made;
  }
  logAction_('RUN_DAILY_SCHEDULE', 'OK', today + ' queued=' + done);
  return { ok: true, date: today, queued: done };
}

// สร้างคิวให้หน่วยงานที่ระบุ (ใช้โดย trigger — ไม่อิง getCurrentUser_) เคารพโควต้า
function createQueueForCustomer_(customerId, count, emailsList) {
  const quota = computeQuota_({ customer_id: customerId });
  if (quota.available <= 0) return 0;
  const active = rows_(SHEETS.emailList).filter(function (r) {
    return String(r.customer_id) === String(customerId) && String(r.status).toLowerCase() === 'active';
  });
  let targets;
  if (emailsList && emailsList.length) {
    // เลือกตามรายชื่อที่กำหนด — รักษาลำดับที่เลือก (ตามคิว) ไม่สุ่ม
    const want = {};
    emailsList.forEach(function (e) { want[String(e).toLowerCase().trim()] = true; });
    targets = active.filter(function (r) { return want[String(r.email).toLowerCase().trim()]; });
  } else {
    targets = shuffle_(active); // ไม่ระบุ = สุ่ม
  }
  const n = Math.min(targets.length, Math.max(1, Number(count) || 1), quota.available);
  const topics = shuffle_(listTopics());
  const sheet = sheet_(SHEETS.queue);
  const add = [];
  const now = new Date();
  targets.slice(0, n).forEach(function (t, i) {
    const topic = topics.length ? topics[i % topics.length] : null;
    add.push([customerId, t.email, topic ? topic.topic : 'Awareness Training',
      new Date(now.getTime() + randomInt_(5, 180) * 60000), 'queued', 0, '']);
  });
  if (add.length) sheet.getRange(sheet.getLastRow() + 1, 1, add.length, HEADERS.Queue.length).setValues(add);
  return add.length;
}

// ===== จัดการ Google time-based trigger (admin เท่านั้น) =====
const TRIGGER_FN = 'runDailySchedule';

function triggerStatus_() {
  try {
    const on = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === TRIGGER_FN; });
    return { installed: on };
  } catch (e) {
    return { installed: false, error: String(e && e.message || e) };
  }
}

function installDailyTrigger() {
  setupDatabase();
  requireAdmin_(getCurrentUser_());
  removeDailyTrigger_();
  ScriptApp.newTrigger(TRIGGER_FN).timeBased().everyDays(1).atHour(8).create();
  logAction_('INSTALL_TRIGGER', 'OK', 'daily 08:00');
  return jsonSafe_(triggerStatus_());
}

function removeDailyTrigger() {
  setupDatabase();
  requireAdmin_(getCurrentUser_());
  removeDailyTrigger_();
  logAction_('REMOVE_TRIGGER', 'OK', '');
  return jsonSafe_(triggerStatus_());
}

function removeDailyTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === TRIGGER_FN) ScriptApp.deleteTrigger(t);
  });
}

/* ===== Email List: เพิ่ม/แก้/ลบ/เลื่อน (แบบตาราง Excel) ===== */

function addEmailRow(data) {
  setupDatabase();
  const user = getCurrentUser_();
  requireCustomer_(user);

  const email = String(data && data.email || '').toLowerCase().trim();
  if (!isValidEmail_(email)) throw new Error('อีเมลไม่ถูกต้อง: ' + email);

  const customer = getCustomer_(user.customer_id);
  const allowedDomains = splitCsv_(customer.allowed_domains);
  const domain = email.split('@')[1] || '';
  if (allowedDomains.length && allowedDomains.indexOf(domain) === -1) {
    throw new Error('โดเมนไม่ได้รับอนุญาต: ' + domain);
  }
  const dup = rows_(SHEETS.emailList).some(function (r) {
    return r.customer_id === user.customer_id && String(r.email).toLowerCase() === email;
  });
  if (dup) throw new Error('อีเมลซ้ำ: ' + email);

  sheet_(SHEETS.emailList).appendRow([
    user.customer_id, email, '', 'active', false, false, false, '',
    String(data.fullname || ''), String(data.department || '')
  ]);
  logAction_('ADD_EMAIL_ROW', 'OK', email);
  return jsonSafe_({ emailList: listEmailTargets(), dashboard: getDashboardData() });
}

function updateEmailRow(data) {
  setupDatabase();
  const user = getCurrentUser_();
  requireCustomer_(user);

  const sheet = sheet_(SHEETS.emailList);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const r = Number(data && data.row_index);
  if (!(r >= 2 && r <= values.length)) throw new Error('แถวไม่ถูกต้อง');
  const ci = headers.indexOf('customer_id');
  if (user.role !== 'admin' && String(values[r - 1][ci]) !== user.customer_id) {
    throw new Error('ไม่มีสิทธิ์แก้แถวนี้');
  }
  const setCol = function (col, val) {
    const i = headers.indexOf(col);
    if (i >= 0) sheet.getRange(r, i + 1).setValue(val);
  };
  if (data.email !== undefined) {
    const email = String(data.email).toLowerCase().trim();
    if (!isValidEmail_(email)) throw new Error('อีเมลไม่ถูกต้อง');
    setCol('email', email);
  }
  if (data.fullname !== undefined) setCol('fullname', String(data.fullname));
  if (data.department !== undefined) setCol('department', String(data.department));
  if (data.status !== undefined) setCol('status', String(data.status));

  logAction_('UPDATE_EMAIL_ROW', 'OK', String(data.email || r));
  return jsonSafe_({ emailList: listEmailTargets(), dashboard: getDashboardData() });
}

function deleteEmailRow(rowIndex) {
  setupDatabase();
  const user = getCurrentUser_();
  requireCustomer_(user);

  const sheet = sheet_(SHEETS.emailList);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const r = Number(rowIndex);
  if (!(r >= 2 && r <= values.length)) throw new Error('แถวไม่ถูกต้อง');
  const ci = headers.indexOf('customer_id');
  if (user.role !== 'admin' && String(values[r - 1][ci]) !== user.customer_id) {
    throw new Error('ไม่มีสิทธิ์ลบแถวนี้');
  }
  sheet.deleteRow(r);
  logAction_('DELETE_EMAIL_ROW', 'OK', String(rowIndex));
  return jsonSafe_({ emailList: listEmailTargets(), dashboard: getDashboardData() });
}

function moveEmailRow(data) {
  setupDatabase();
  const user = getCurrentUser_();
  requireCustomer_(user);

  const sheet = sheet_(SHEETS.emailList);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const ci = headers.indexOf('customer_id');
  const r = Number(data && data.row_index);
  const step = (data && data.direction === 'up') ? -1 : 1;
  if (!(r >= 2 && r <= values.length)) throw new Error('แถวไม่ถูกต้อง');

  // หาแถวถัดไปที่เป็นของ customer เดียวกัน (admin = แถวติดกันได้เลย)
  let t = r + step;
  while (t >= 2 && t <= values.length) {
    if (user.role === 'admin' || String(values[t - 1][ci]) === user.customer_id) break;
    t += step;
  }
  if (t >= 2 && t <= values.length) swapRows_(sheet, r, t);

  logAction_('MOVE_EMAIL_ROW', 'OK', r + '->' + t);
  return jsonSafe_({ emailList: listEmailTargets(), dashboard: getDashboardData() });
}

/* ===== Email List: import จากภายนอก (CSV ที่ client แปลง / ลิงก์ Google Sheet) ===== */

function importEmails(payload) {
  setupDatabase();
  const user = getCurrentUser_();
  requireCustomer_(user);
  return jsonSafe_(importEmailRows_((payload && payload.rows) || [], user));
}

function importEmailsFromSheet(url) {
  setupDatabase();
  const user = getCurrentUser_();
  requireCustomer_(user);
  let ss;
  try {
    ss = SpreadsheetApp.openByUrl(String(url || ''));
  } catch (e) {
    throw new Error('เปิดลิงก์ Google Sheet ไม่ได้ — ตรวจสิทธิ์การเข้าถึง/ลิงก์');
  }
  const data = ss.getSheets()[0].getDataRange().getValues();
  if (data.length < 1) throw new Error('ชีตไม่มีข้อมูล');
  const head = data[0].map(function (h) { return String(h).toLowerCase().trim(); });
  let ei = head.indexOf('email'), ni = head.indexOf('fullname'), di = head.indexOf('department');
  let start = 1;
  if (ei < 0) { ei = 0; ni = 1; di = 2; start = 0; } // ไม่มีหัวคอลัมน์ = ใช้ตำแหน่ง
  const rowsIn = [];
  for (let i = start; i < data.length; i++) {
    const r = data[i];
    const email = String(r[ei] || '').trim();
    if (!email) continue;
    rowsIn.push({ email: email, fullname: ni >= 0 ? String(r[ni] || '').trim() : '', department: di >= 0 ? String(r[di] || '').trim() : '' });
  }
  return jsonSafe_(importEmailRows_(rowsIn, user));
}

// ตัวกลาง: ตรวจโดเมน/ซ้ำ/เพดาน แล้ว append เป็นชุด
function importEmailRows_(rowsIn, user) {
  const customer = getCustomer_(user.customer_id);
  const allowedDomains = splitCsv_(customer.allowed_domains);
  const existingRows = rows_(SHEETS.emailList).filter(function (row) { return row.customer_id === user.customer_id; });
  const existing = {};
  existingRows.forEach(function (row) { existing[String(row.email).toLowerCase()] = true; });
  const maxTargets = Number(getSettingValue_('max_target_emails', APP.defaults.maxTargetEmails));

  const toAdd = [];
  const errors = [];
  rowsIn.forEach(function (item, i) {
    const email = String(item && item.email || '').toLowerCase().trim();
    const domain = email.split('@')[1] || '';
    if (!isValidEmail_(email)) { errors.push('แถว ' + (i + 1) + ': อีเมลไม่ถูกต้อง'); return; }
    if (allowedDomains.length && allowedDomains.indexOf(domain) === -1) { errors.push('แถว ' + (i + 1) + ': โดเมนไม่อนุญาต (' + domain + ')'); return; }
    if (existing[email]) { errors.push('แถว ' + (i + 1) + ': ซ้ำ (' + email + ')'); return; }
    if (existingRows.length + toAdd.length >= maxTargets) { errors.push('แถว ' + (i + 1) + ': เกินจำนวนสูงสุด'); return; }
    existing[email] = true;
    toAdd.push([user.customer_id, email, '', 'active', false, false, false, '', String(item.fullname || ''), String(item.department || '')]);
  });

  if (toAdd.length) {
    const sheet = sheet_(SHEETS.emailList);
    sheet.getRange(sheet.getLastRow() + 1, 1, toAdd.length, HEADERS.EmailList.length).setValues(toAdd);
  }
  logAction_('IMPORT_EMAILS', 'OK', 'added=' + toAdd.length + ' err=' + errors.length);
  return { added: toAdd.length, errors: errors, emailList: listEmailTargets(), dashboard: getDashboardData() };
}

/* ===== Topics: เพิ่ม/แก้/ลบ/เลื่อน (admin เท่านั้น เพราะเป็นข้อมูลกลาง) ===== */

function addTopicRow(data) {
  setupDatabase();
  requireAdmin_(getCurrentUser_());
  sheet_(SHEETS.mailTopics).appendRow([
    String(data && data.topic || 'หัวข้อใหม่'),
    String(data && data.context || ''),
    String(data && data.category || 'general'),
    true,
    new Date(),
    String(data && data.question || ''),
    String(data && data.choices || ''),
    Number(data && data.correct) || 0,
    String(data && data.explain || '')
  ]);
  logAction_('ADD_TOPIC_ROW', 'OK', String(data && data.topic || ''));
  return jsonSafe_({ topics: rows_(SHEETS.mailTopics) });
}

function updateTopicRow(data) {
  setupDatabase();
  requireAdmin_(getCurrentUser_());
  const sheet = sheet_(SHEETS.mailTopics);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const r = Number(data && data.row_index);
  if (!(r >= 2 && r <= values.length)) throw new Error('แถวไม่ถูกต้อง');
  const setCol = function (col, val) {
    const i = headers.indexOf(col);
    if (i >= 0) sheet.getRange(r, i + 1).setValue(val);
  };
  ['topic', 'context', 'category', 'active', 'question', 'choices', 'correct', 'explain'].forEach(function (col) {
    if (data[col] !== undefined) setCol(col, col === 'correct' ? (Number(data[col]) || 0) : data[col]);
  });
  logAction_('UPDATE_TOPIC_ROW', 'OK', String(data.topic || r));
  return jsonSafe_({ topics: rows_(SHEETS.mailTopics) });
}

function deleteTopicRow(rowIndex) {
  setupDatabase();
  requireAdmin_(getCurrentUser_());
  const sheet = sheet_(SHEETS.mailTopics);
  const r = Number(rowIndex);
  if (!(r >= 2 && r <= sheet.getLastRow())) throw new Error('แถวไม่ถูกต้อง');
  sheet.deleteRow(r);
  logAction_('DELETE_TOPIC_ROW', 'OK', String(rowIndex));
  return jsonSafe_({ topics: rows_(SHEETS.mailTopics) });
}

function moveTopicRow(data) {
  setupDatabase();
  requireAdmin_(getCurrentUser_());
  const sheet = sheet_(SHEETS.mailTopics);
  const last = sheet.getLastRow();
  const r = Number(data && data.row_index);
  const t = r + ((data && data.direction === 'up') ? -1 : 1);
  if (r >= 2 && r <= last && t >= 2 && t <= last) swapRows_(sheet, r, t);
  logAction_('MOVE_TOPIC_ROW', 'OK', r + '->' + t);
  return jsonSafe_({ topics: rows_(SHEETS.mailTopics) });
}

function swapRows_(sheet, r1, r2) {
  if (r1 === r2) return;
  const lastCol = sheet.getLastColumn();
  const a = sheet.getRange(r1, 1, 1, lastCol).getValues()[0];
  const b = sheet.getRange(r2, 1, 1, lastCol).getValues()[0];
  sheet.getRange(r1, 1, 1, lastCol).setValues([b]);
  sheet.getRange(r2, 1, 1, lastCol).setValues([a]);
}

function recordTrainingAction(payload) {
  setupDatabase();
  const action = payload && payload.action ? String(payload.action) : 'trained';
  const email = payload && payload.email ? String(payload.email).toLowerCase() : '';
  const customerId = payload && payload.customer_id ? String(payload.customer_id) : '';
  const topic = payload && payload.topic ? String(payload.topic) : 'Training Page';
  const score = payload && payload.score !== undefined ? Number(payload.score) : '';

  sheet_(SHEETS.results).appendRow([customerId, email, action, new Date(), topic, score]);
  logAction_('RECORD_TRAINING_ACTION', 'OK', action);
  return { ok: true };
}

function exportLogsText() {
  setupDatabase();
  const user = getCurrentUser_();
  const logs = listLogs(5000);
  const lines = ['timestamp\tcustomer_id\tuser_email\trole\taction\tresult\terror_message'];
  logs.forEach(function (row) {
    lines.push([
      row.timestamp,
      row.customer_id,
      row.user_email,
      row.role,
      row.action,
      row.result,
      row.error_message
    ].join('\t'));
  });
  logAction_('EXPORT_LOGS_TXT', 'OK', APP.logFileName);
  return { fileName: APP.logFileName, content: lines.join('\n'), user: user.email };
}

// หมายเหตุ: ฟังก์ชันสำรองข้อมูลเป็น Excel (exportDataXlsx + xlsx*_) ย้ายไปไฟล์ Backup.gs แล้ว

function logClientAction(action, result, message) {
  setupDatabase();
  logAction_(String(action || 'CLIENT_ACTION'), String(result || 'OK'), String(message || ''));
  return { ok: true };
}

// memo ระดับ execution — กันการ resolve user + อ่านชีต Customers ซ้ำหลายรอบต่อ request
// ตรวจอีเมลทุกครั้งเพื่อความปลอดภัย (Apps Script อาจ reuse instance ข้าม request/ผู้ใช้)
var _userMemo = null;

function getCurrentUser_() {
  const email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  if (_userMemo && _userMemo.email === email) return _userMemo;
  _userMemo = resolveUser_(email);
  return _userMemo;
}

// แปลงอีเมลที่ล็อกอินเป็น user object — admin = เจ้าของชีต/ผู้พัฒนา, ไม่งั้น mail_user (เข้าได้เฉพาะหน้า training)
function resolveUser_(email) {
  const customers = rows_(SHEETS.customers);
  let customer = customers.filter(function (row) {
    return String(row.login_email).toLowerCase() === email && row.status === 'active';
  })[0];

  if (!customer && email && (email === developerEmail_() || ADMIN_EMAILS.indexOf(email) !== -1 || email === ownerEmail_())) {
    customer = {
      customer_id: 'ADMIN',
      login_email: email,
      role: 'admin',
      allowed_domains: '',
      max_send_day: APP.defaults.maxSendDay,
      status: 'active'
    };
  }

  if (!customer) {
    customer = {
      customer_id: '',
      login_email: email,
      role: 'mail_user',
      allowed_domains: '',
      max_send_day: 0,
      status: email ? 'limited' : 'anonymous'
    };
  }

  if (email) updateLastLogin_(email);
  return {
    email: email,
    customer_id: customer.customer_id,
    role: String(customer.role || 'mail_user').toLowerCase(),
    allowed_domains: customer.allowed_domains || '',
    max_send_day: Number(customer.max_send_day || 0),
    status: customer.status || 'limited',
    isAdmin: String(customer.role || '').toLowerCase() === 'admin'
  };
}

function requireCustomer_(user) {
  if (!user.email || (user.role !== 'admin' && user.role !== 'customer')) {
    throw new Error('Access denied. Google account is not registered as admin/customer.');
  }
}

function requireAdmin_(user) {
  if (!user.email || user.role !== 'admin') {
    throw new Error('ต้องเป็นผู้ดูแลระบบ (admin) เท่านั้น');
  }
}

function getCustomer_(customerId) {
  return rows_(SHEETS.customers).filter(function (row) {
    return row.customer_id === customerId;
  })[0] || {};
}

function scopeRows_(data, field, user) {
  if (user.role === 'admin') return data;
  return data.filter(function (row) { return row[field] === user.customer_id; });
}

function ensureHeaders_(sheet, headers) {
  if (!headers || !headers.length) return;
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const needsHeader = headers.some(function (header, index) { return firstRow[index] !== header; });
  if (needsHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function seedSettings_() {
  const settings = rows_(SHEETS.settings);
  const existing = {};
  settings.forEach(function (row) { existing[row.key] = true; });
  const defaults = [
    ['max_domains', APP.defaults.maxDomains, 'Default domains allowed per customer'],
    ['max_target_emails', APP.defaults.maxTargetEmails, 'Default target emails per customer'],
    ['max_send_day', APP.defaults.maxSendDay, 'Default sends per customer per day'],
    ['auto_reduce_sequence', '10,5,1,pause', 'Daily quota reduction when delivery risk occurs'],
    ['platform_daily_cap', QUOTA_DEFAULTS.platformDailyCap, 'Platform-wide send cap per day (Gmail free = 100)'],
    ['customer_daily_cap', QUOTA_DEFAULTS.customerDailyCap, 'Max sends per customer per day (fair-share ceiling)'],
    ['monthly_repeat', 'false', 'Phase 1 setting only']
  ].filter(function (row) { return !existing[row[0]]; });
  if (defaults.length) sheet_(SHEETS.settings).getRange(sheet_(SHEETS.settings).getLastRow() + 1, 1, defaults.length, 3).setValues(defaults);
}

function seedAdmin_() {
  const dev = developerEmail_(); // เจ้าของชีต (หรือ CONFIG.developerEmail ถ้าตั้งไว้)
  if (!dev) return; // หาเจ้าของไม่ได้ → ข้าม (getCurrentUser_ ยัง promote เจ้าของเป็น admin อยู่ดี)
  const rows = rows_(SHEETS.customers);
  const exists = rows.some(function (row) { return String(row.login_email).toLowerCase() === dev; });
  if (!exists) {
    sheet_(SHEETS.customers).appendRow(['ADMIN', dev, 'admin', '', APP.defaults.maxSendDay, 'active', new Date(), '']);
  }
}

// ข้อมูลจำลองสำหรับให้เจ้าของดูผลลัพธ์ — ส่งจำลองไปยัง mis@tfpthailand.com / mis@tfpoem.com
// เจ้าของ/ลูกค้า = sunart.srisumal@gmail.com (customer_id 'SUNART'); idempotent: ข้ามถ้ามีแล้ว
function seedDemoSimulation_() {
  const CID = 'SUNART';
  const customers = rows_(SHEETS.customers);
  if (customers.some(function (r) { return String(r.customer_id) === CID; })) return; // มีแล้ว ข้าม
  const now = new Date();
  const today = Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd');
  const topic = 'Link Safety';

  // ลูกค้า/เจ้าของ
  sheet_(SHEETS.customers).appendRow([CID, 'sunart.srisumal@gmail.com', 'customer', 'tfpthailand.com,tfpoem.com', 10, 'active', now, '']);

  // รายชื่อเป้าหมาย 2 คน  (EmailList: customer_id,email,description,status,clicked,replied,trained,last_sent,fullname,department)
  const emails = [
    ['mis@tfpthailand.com', 'MIS TFP Thailand'],
    ['mis@tfpoem.com', 'MIS TFP OEM']
  ];
  const emSheet = sheet_(SHEETS.emailList);
  emails.forEach(function (e) {
    emSheet.appendRow([CID, e[0], '', 'active', '', '', '', '', e[1], 'MIS']);
  });

  // คิว (Queue: customer_id,email,topic,send_date,status,retry_count,last_error) — สถานะ sent (จำลอง)
  const qSheet = sheet_(SHEETS.queue);
  emails.forEach(function (e) {
    qSheet.appendRow([CID, e[0], topic, today, 'sent', 0, '']);
  });

  // ผลลัพธ์ (Results: customer_id,email,action,action_time,topic,score) — ให้เห็น funnel คลิก/อบรม/ผ่าน
  const rSheet = sheet_(SHEETS.results);
  rSheet.appendRow([CID, 'mis@tfpthailand.com', 'clicked', now, topic, '']);
  rSheet.appendRow([CID, 'mis@tfpthailand.com', 'passed', now, topic, 3]);
  rSheet.appendRow([CID, 'mis@tfpoem.com', 'clicked', now, topic, '']);
  rSheet.appendRow([CID, 'mis@tfpoem.com', 'trained', now, topic, 2]);
}

// ข้อมูลสาธิตเพื่อ "ยืนยันการแยกข้อมูลระหว่างลูกค้า 2 ราย" (idempotent — รัน setup ซ้ำได้)
//   A = SUNART (sunart.srisumal@gmail.com)  เจ้าของโดเมน tfpthailand/tfpoem/tfpcar
//   B = TFP    (ai.sunart.srisumal@gmail.com) มีรายชื่อ/ผลคนละชุด
// แต่ละฝ่ายมี customer_id ของตัวเอง → scopeRows_ กรองตาม customer_id ฝ่ายหนึ่งจึงไม่เห็นข้อมูลอีกฝ่าย
function seedIsolationDemo_() {
  const topic = 'Link Safety';
  const today = todayStr_();

  // ลูกค้า A: เติมโดเมนที่สาม (tfpcar.com) + เป้าหมายของ tfpcar ให้กับ SUNART ที่มีอยู่เดิม
  setCustomerDomains_('SUNART', 'tfpthailand.com,tfpoem.com,tfpcar.com');
  if (ensureTarget_('SUNART', 'mis@tfpcar.com', 'MIS TFP Car', 'MIS')) {
    sheet_(SHEETS.queue).appendRow(['SUNART', 'mis@tfpcar.com', topic, today, 'sent', 0, '']);
  }
  ensureResult_('SUNART', 'mis@tfpcar.com', 'passed', topic, 3);

  // ลูกค้า B (TFP = ai.sunart.srisumal): ตามคำสั่งเจ้าของ ให้เป็นลูกค้า "ว่าง" — ไม่มี email/โดเมน
  // ลบข้อมูลที่เคย seed ไว้ + ล้างโดเมน "ครั้งเดียว" (guard ด้วย ScriptProperties)
  // กันไม่ให้ลบซ้ำทุกครั้งที่ setupDatabase รันใหม่หลัง cache หมดอายุ
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('tfp_emptied_v1')) {
    clearCustomerData_('TFP');
    props.setProperty('tfp_emptied_v1', '1');
  }
}

// ลบรายชื่อ/คิว/ผลของลูกค้ารายหนึ่งทั้งหมด แล้วล้างโดเมน (รีเซ็ตลูกค้าให้ว่าง)
function clearCustomerData_(customerId) {
  ['emailList', 'queue', 'results'].forEach(function (k) {
    deleteRowsWhere_(SHEETS[k], 'customer_id', customerId);
  });
  setCustomerDomains_(customerId, '');
}

// ลบทุกแถวในชีตที่ค่าในคอลัมน์ field เท่ากับ value (ลบจากล่างขึ้นบนกัน index เลื่อน)
function deleteRowsWhere_(sheetName, field, value) {
  const sh = sheet_(sheetName);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return;
  const idx = values[0].indexOf(field);
  if (idx === -1) return;
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][idx]) === value) sh.deleteRow(i + 1);
  }
}

// ตั้งค่า allowed_domains ของลูกค้ารายหนึ่งในชีต Customers (อัปเดต cell ตรง ๆ; ข้ามถ้าตรงอยู่แล้ว)
function setCustomerDomains_(customerId, domains) {
  const sh = sheet_(SHEETS.customers);
  const values = sh.getDataRange().getValues();
  const header = values[0];
  const cidIdx = header.indexOf('customer_id');
  const domIdx = header.indexOf('allowed_domains');
  if (cidIdx === -1 || domIdx === -1) return;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][cidIdx]) === customerId) {
      if (String(values[i][domIdx]) !== domains) sh.getRange(i + 1, domIdx + 1).setValue(domains);
      return;
    }
  }
}

// เพิ่มเป้าหมายใน EmailList ถ้ายังไม่มี (คืน true เมื่อเพิ่งเพิ่ม) — กันซ้ำตาม (customer_id,email)
function ensureTarget_(customerId, email, fullname, dept) {
  const exists = rows_(SHEETS.emailList).some(function (r) {
    return String(r.customer_id) === customerId && String(r.email).toLowerCase() === String(email).toLowerCase();
  });
  if (exists) return false;
  sheet_(SHEETS.emailList).appendRow([customerId, email, '', 'active', '', '', '', '', fullname, dept]);
  return true;
}

// เพิ่มผลลัพธ์ใน Results ถ้ายังไม่มีแถวเดียวกัน — กันซ้ำตาม (customer_id,email,action)
function ensureResult_(customerId, email, action, topic, score) {
  const exists = rows_(SHEETS.results).some(function (r) {
    return String(r.customer_id) === customerId &&
      String(r.email).toLowerCase() === String(email).toLowerCase() &&
      String(r.action) === action;
  });
  if (exists) return;
  sheet_(SHEETS.results).appendRow([customerId, email, action, new Date(), topic, score]);
}

function seedInitialCustomers_() {
  const initialCustomers = [
    ['TFP', 'ai.sunart.srisumal@gmail.com', 'customer', 'tfpcar.com,tfpthailand.com,tfpoem.com', 100, 'active']
  ];
  const rows = rows_(SHEETS.customers);
  const existing = {};
  rows.forEach(function (row) {
    existing[String(row.customer_id).toLowerCase() + '|' + String(row.login_email).toLowerCase()] = true;
  });

  initialCustomers.forEach(function (customer) {
    const key = String(customer[0]).toLowerCase() + '|' + String(customer[1]).toLowerCase();
    if (!existing[key]) {
      sheet_(SHEETS.customers).appendRow([customer[0], customer[1], customer[2], customer[3], customer[4], customer[5], new Date(), '']);
    }
  });
}

// แหล่งข้อมูลหัวข้อ/คำถามเดียว — ใช้ทั้งตอน seed และตอน upgradeMailTopics()
// choices = ตัวเลือกคั่นด้วย "|"  |  correct = เลขข้อที่ถูก (เริ่มนับที่ 1)
function topicSeed_() {
  return [
    {
      topic: 'Password Safety',
      context: 'Recognize credential-harvesting indicators without entering passwords.',
      category: 'awareness',
      question: 'อีเมลขอให้คุณกรอกรหัสผ่านผ่านลิงก์ด่วน ควรทำอย่างไร?',
      choices: 'กรอกทันทีเพราะเร่งด่วน|ไม่กรอก และตรวจสอบผ่านช่องทางที่เชื่อถือได้',
      correct: 2,
      explain: 'อย่ากรอกรหัสผ่านจากลิงก์ในอีเมล ให้เข้าเว็บทางการเองและยืนยันผ่านช่องทางที่รู้จัก'
    },
    {
      topic: 'Invoice Check',
      context: 'Verify unexpected payment or attachment requests through a known channel.',
      category: 'finance',
      question: 'ได้รับใบแจ้งหนี้/คำขอชำระเงินที่ไม่คาดคิดพร้อมไฟล์แนบ ควรทำอย่างไร?',
      choices: 'เปิดไฟล์และโอนเงินตามที่ระบุ|ยืนยันกับผู้ส่งผ่านเบอร์/ช่องทางที่รู้จักก่อน',
      correct: 2,
      explain: 'คำขอชำระเงินที่ไม่คาดคิดควรยืนยันกับผู้เกี่ยวข้องผ่านช่องทางที่รู้จักก่อนเสมอ'
    },
    {
      topic: 'Link Safety',
      context: 'Inspect links and report suspicious messages before clicking.',
      category: 'general',
      question: 'ข้อความมีลิงก์ที่ดูแปลก ควรทำอย่างไรก่อนคลิก?',
      choices: 'คลิกทันทีเพื่อดูว่าคืออะไร|ตรวจดูโดเมนของลิงก์ และรายงานถ้าน่าสงสัย',
      correct: 2,
      explain: 'ตรวจสอบโดเมนของลิงก์ก่อนเสมอ หากไม่ตรงหรือน่าสงสัยให้รายงานโดยไม่ต้องคลิก'
    }
  ];
}

function seedTopics_() {
  if (rows_(SHEETS.mailTopics).length) return;
  const now = new Date();
  const values = topicSeed_().map(function (t) {
    return [t.topic, t.context, t.category, true, now, t.question, t.choices, t.correct, t.explain];
  });
  sheet_(SHEETS.mailTopics).getRange(2, 1, values.length, HEADERS.MailTopics.length).setValues(values);
}

// หัวข้อเพิ่มเติม 10 เรื่อง (โรงงาน/ลูกค้า/scammer) — เติมแบบ idempotent: เพิ่มเฉพาะชื่อที่ยังไม่มี
function seedExtraTopics_() {
  const existing = {};
  rows_(SHEETS.mailTopics).forEach(function (r) { existing[String(r.topic).trim().toLowerCase()] = true; });
  const add = extraTopicSeed_().filter(function (t) { return !existing[t.topic.trim().toLowerCase()]; });
  if (!add.length) return;
  const now = new Date();
  const values = add.map(function (t) {
    return [t.topic, t.context, t.category, true, now, t.question, t.choices, t.correct, t.explain];
  });
  const sh = sheet_(SHEETS.mailTopics);
  sh.getRange(sh.getLastRow() + 1, 1, values.length, HEADERS.MailTopics.length).setValues(values);
}

function extraTopicSeed_() {
  const t = function (topic, category, question, choices, explain) {
    return { topic: topic, category: category, context: '', question: question, choices: choices, correct: 2, explain: explain };
  };
  return [
    // ===== โรงงาน (factory) =====
    t('Supplier Bank Change', 'factory', 'ได้อีเมลจากซัพพลายเออร์แจ้งเปลี่ยนเลขบัญชีรับเงินกะทันหัน ควรทำอย่างไร?', 'โอนตามเลขบัญชีใหม่ทันที|โทรยืนยันกับซัพพลายเออร์ด้วยเบอร์เดิมที่มีอยู่ก่อน', 'การเปลี่ยนเลขบัญชีกะทันหันเป็นกล BEC ยอดฮิต ต้องยืนยันด้วยช่องทางเดิมก่อนเสมอ'),
    t('Production Line Alert', 'factory', 'อีเมลอ้างระบบควบคุมเครื่องจักรขัดข้อง ให้กดลิงก์ติดตั้งอัปเดตด่วน ควรทำอย่างไร?', 'กดติดตั้งทันทีกันสายการผลิตหยุด|แจ้ง IT/วิศวกรตรวจสอบก่อน ไม่กดลิงก์เอง', 'การขู่ว่าระบบผลิตจะหยุดเป็นกลกดดันให้รีบกดลิงก์ติดมัลแวร์'),
    t('Safety Audit File', 'factory', 'ได้ไฟล์แนบ "รายงานตรวจความปลอดภัยโรงงาน" จากผู้ส่งไม่รู้จัก ให้เปิดมาโคร ควรทำอย่างไร?', 'เปิดและกด Enable Macro|ไม่เปิดมาโคร และยืนยันกับฝ่ายความปลอดภัยก่อน', 'มาโครในไฟล์เอกสารเป็นช่องทางฝังมัลแวร์ที่พบบ่อย'),
    t('Logistics Fee', 'factory', 'อีเมลขนส่งแจ้งวัตถุดิบติดด่าน ให้จ่ายค่าธรรมเนียมผ่านลิงก์ด่วน ควรทำอย่างไร?', 'จ่ายผ่านลิงก์ทันที|ตรวจสอบกับบริษัทขนส่งทางการก่อนจ่าย', 'ค่าธรรมเนียมปลอมผ่านลิงก์เป็นกลหลอกเอาเงิน/ข้อมูลบัตร'),
    // ===== ลูกค้า (customer) =====
    t('Rush Purchase Order', 'customer', 'ลูกค้าใหม่ส่งใบสั่งซื้อยอดสูงพร้อมเร่งจัดส่งก่อนชำระเงิน ควรระวังอะไร?', 'รีบจัดส่งกันเสียลูกค้า|ตรวจสอบตัวตนลูกค้าและเงื่อนไขชำระเงินก่อน', 'ออเดอร์ด่วนยอดสูงก่อนจ่ายเป็นรูปแบบฉ้อโกงที่พบบ่อย'),
    t('Customer Complaint Link', 'customer', 'อีเมลอ้างเป็นลูกค้าร้องเรียน แนบลิงก์ "ดูหลักฐาน" ที่โดเมนแปลก ควรทำอย่างไร?', 'กดดูหลักฐานทันที|ตรวจโดเมนก่อน และติดต่อลูกค้าผ่านช่องทางจริง', 'อ้างเป็นลูกค้าโกรธเพื่อเร่งให้กดลิงก์ปลอมเป็นกลที่พบบ่อย'),
    t('Customer Data Request', 'customer', 'มีคนอ้างเป็นลูกค้า ขอให้ส่งข้อมูลส่วนตัว/ฐานข้อมูลทางอีเมล ควรทำอย่างไร?', 'ส่งให้เพราะเป็นลูกค้า|ยืนยันตัวตนและทำตามขั้นตอน PDPA ก่อนเสมอ', 'การส่งข้อมูลส่วนบุคคลต้องยืนยันตัวตนและเป็นไปตาม PDPA'),
    // ===== scammer =====
    t('Fake CEO Transfer', 'scammer', 'อีเมลอ้างเป็น CEO สั่งให้คุณโอนเงินด่วนและห้ามบอกใคร ควรทำอย่างไร?', 'ทำตามทันทีเพราะเป็นคำสั่งผู้บริหาร|ยืนยันตัวตน CEO ด้วยช่องทางอื่นก่อน', 'การสั่งโอนด่วน+ห้ามบอกใครคือสัญญาณชัดของกลโกง CEO ปลอม'),
    t('Gift Card Scam', 'scammer', 'หัวหน้า (ทางแชต) ขอให้ซื้อบัตรของขวัญแล้วส่งรหัสด้านหลังมาให้ ควรทำอย่างไร?', 'ซื้อและส่งรหัสให้ทันที|ยืนยันตัวตนหัวหน้าแบบโทร/เจอหน้าก่อน', 'การขอบัตรของขวัญแล้วเอารหัสหลังบัตรคือกลโกงที่แพร่หลาย'),
    t('Prize Fee Scam', 'scammer', 'ได้แจ้งว่าถูกรางวัลใหญ่ แต่ต้องโอนค่าภาษี/ค่าธรรมเนียมก่อนรับ ควรทำอย่างไร?', 'โอนเพื่อรับรางวัล|ไม่โอน เพราะรางวัลจริงไม่เก็บเงินล่วงหน้า', 'การเรียกเก็บเงินล่วงหน้าเพื่อรับรางวัลคือสัญญาณหลอกลวง')
  ];
}

// คลังคำถามกลาง 5 กลุ่ม × 21 ข้อ = 105 ข้อ (ภาษาไทย) — seed เฉพาะตอนชีต Questions ว่าง
function seedQuestions_() {
  if (rows_(SHEETS.questions).length) return;
  const now = new Date();
  const values = questionSeed_().map(function (q) {
    return ['GLOBAL', q.g, q.q, q.c, q.k, q.e, true, 'seed', now];
  });
  sheet_(SHEETS.questions).getRange(2, 1, values.length, HEADERS.Questions.length).setValues(values);
}

// คำถามจากคลังเมลฟิชชิงจริง (โฟลเดอร์ "อบรม Cyber Virus") — 18 ข้อจาก 8 กลุ่มสแกม
// เพิ่มเข้าคลังกลาง (GLOBAL) source='scam2026' · idempotent: ข้ามถ้าเคยเพิ่มแล้ว
function seedScamQuestions_() {
  const all = rows_(SHEETS.questions);
  if (all.some(function (r) { return String(r.source) === 'scam2026'; })) return;
  const now = new Date();
  const values = scamQuestionSeed_().map(function (q) {
    return ['GLOBAL', q.g, q.q, q.c, q.k, q.e, true, 'scam2026', now];
  });
  const sh = sheet_(SHEETS.questions);
  sh.getRange(sh.getLastRow() + 1, 1, values.length, HEADERS.Questions.length).setValues(values);
}

function scamQuestionSeed_() {
  const q = function (g, q, c, k, e) { return { g: g, q: q, c: c, k: k, e: e }; };
  return [
    // กลุ่ม cred — บัญชีอีเมลถูกระงับ/โควต้า/ยืนยัน/รีล็อกอิน/แจ้งส่งล้มเหลว (เจอบ่อยสุดในคลังจริง)
    q('cred', 'ได้อีเมล "บัญชีถูกล็อก ข้อมูลจะถูกลบใน 24 ชม. คลิกเพื่อปลดล็อก" จากผู้ส่งโดเมนแปลก ควรทำอย่างไร?', 'กดลิงก์ปลดล็อกทันทีกันข้อมูลถูกลบ|ไม่กด เข้าอีเมลทางช่องทางปกติ แล้วแจ้ง IT', 2, 'ผู้ให้บริการจริงไม่ขู่ลบข้อมูลใน 24 ชม. ผ่านลิงก์ ผู้ส่งเป็นโดเมนบริษัทอื่นและลิงก์พาไปหน้าปลอม'),
    q('cred', 'อีเมลแจ้ง "กล่องเมลเต็มโควต้า (Mail Quota Exceeded) กดเพื่อเพิ่มพื้นที่/ยืนยัน" ควรทำอย่างไร?', 'กดลิงก์เพิ่มพื้นที่ทันที|ตรวจพื้นที่จากการตั้งค่าเมลเองโดยไม่กดลิงก์', 2, 'คำขู่เมลเต็มเป็นกลพาไปหน้าล็อกอินปลอมเพื่อเก็บรหัสผ่าน'),
    q('cred', 'อีเมลให้ "เข้าสู่ระบบใหม่/ยืนยันเซสชัน (Re-login)" โดยกดลิงก์ในอีเมล ควรทำอย่างไร?', 'กดลิงก์แล้วล็อกอินยืนยัน|พิมพ์ที่อยู่เว็บเมลเอง หรือใช้บุ๊กมาร์ก ไม่กดลิงก์', 2, 'ลิงก์ยืนยันเซสชันมักเป็นหน้าล็อกอินปลอม ให้เข้าเว็บเมลด้วยช่องทางที่เชื่อถือได้'),
    q('cred', 'อีเมลอ้าง "ต้องยืนยันอีเมลกับ ICANN ไม่งั้นบัญชีถูกปิด" ควรคิดอย่างไร?', 'รีบยืนยันตามลิงก์|สงสัยไว้ก่อน ICANN ไม่ยืนยันอีเมลผู้ใช้รายบุคคล นี่คือของปลอม', 2, 'ICANN ดูแลโดเมนระดับโครงสร้าง ไม่ติดต่อยืนยันกล่องเมลผู้ใช้ทั่วไป'),
    q('cred', 'อีเมล "ส่งเมลล้มเหลว มี 3 ข้อความค้างในเซิร์ฟเวอร์ กดเพื่อกู้คืน" ควรทำอย่างไร?', 'กดลิงก์กู้ข้อความที่ค้าง|ไม่กด ตรวจกล่องเมลจริงเอง คำแจ้งค้างเป็นกลล่อ', 2, 'การอ้างมีเมลค้างเป็นเหยื่อล่อให้กดลิงก์ไปหน้าเก็บรหัส'),
    q('cred', 'อีเมลแจ้ง "บัญชีละเมิดเงื่อนไขการใช้งาน จะถูกปิด กดยืนยันเพื่อปลดบล็อก" ควรทำอย่างไร?', 'กดยืนยันทันทีกันบัญชีถูกปิด|ไม่กด ตรวจสอบกับฝ่าย IT ผ่านช่องทางภายในก่อน', 2, 'การขู่ปิดบัญชีเรื่องละเมิดเงื่อนไขเป็นกลกดดันให้รีบกดลิงก์ปลอม'),
    // กลุ่ม link — พื้นที่ Cloud/ไฟล์จะถูกลบ + เอกสารขนส่ง + โดเมนผู้ส่งไม่ตรง
    q('link', 'อีเมล "พื้นที่ Cloud ค้างชำระ ข้อมูลจะถูกลบวันนี้ กด RENEW NOW" ลิงก์ไปโดเมนแปลก ควรทำอย่างไร?', 'กดจ่ายทันทีกันไฟล์หาย|ตรวจสอบสถานะพื้นที่จากแอป/เว็บผู้ให้บริการเองโดยตรง', 2, 'กลขู่ให้รีบจ่าย ผู้ส่งไม่ใช่ผู้ให้บริการจริงและลิงก์ไม่ใช่หน้าเรียกเก็บเงินจริง'),
    q('link', 'อีเมลอ้าง "บัญชีไม่ใช้งาน พบไฟล์รูป 4,203 ไฟล์จะถูกลบถาวร กดเพื่อรักษาไฟล์" ควรทำอย่างไร?', 'กดลิงก์เพื่อรักษาไฟล์ไว้|ไม่กด ตรวจจากบัญชีจริงเอง ตัวเลขไฟล์เป็นการขู่ให้ตกใจ', 2, 'ตัวเลขไฟล์ถูกกุขึ้นเพื่อสร้างความตกใจ และลิงก์ชี้ไปพื้นที่จัดเก็บแปลกปลอม'),
    q('link', 'อีเมล DHL แนบ "เอกสารการขนส่ง (AWB)" ให้กดลิงก์ดู ทั้งที่ไม่ได้สั่งของ ควรทำอย่างไร?', 'กดเปิดเอกสารดูว่าของอะไร|ไม่กด ตรวจสถานะพัสดุที่เว็บ DHL ทางการเอง', 2, 'อีเมลขนส่งปลอมพาไปหน้าล็อกอิน/ดาวน์โหลดมัลแวร์ ให้เข้าเว็บผู้ให้บริการเอง'),
    q('link', 'อีเมลอ้างเป็นผู้ให้บริการ Cloud แต่ผู้ส่งเป็นโดเมนบริษัทอื่น (เช่นร้านอะไหล่รถ) บ่งบอกอะไร?', 'บังเอิญใช้เมลร่วมกัน ไม่แปลก|เป็นสัญญาณของผู้ส่งปลอม ไม่ควรเชื่อหรือกดลิงก์', 2, 'โดเมนผู้ส่งที่ไม่เกี่ยวกับบริการที่อ้างถึง คือสัญญาณการปลอมแปลงที่ชัดเจน'),
    // กลุ่ม finance — ใบแจ้งหนี้/Statement/PO/สัญญา/SWIFT-TT
    q('finance', 'ได้ "สำเนาใบแจ้งหนี้" ที่ไม่คาดคิด ให้เปิดไฟล์/กดลิงก์เพื่อดูยอดและชำระ ควรทำอย่างไร?', 'เปิดไฟล์แล้วดำเนินการจ่ายตามที่ระบุ|ยืนยันกับคู่ค้าผ่านเบอร์/ช่องทางที่รู้จักก่อน', 2, 'ใบแจ้งหนี้ที่ไม่คาดคิดควรยืนยันกับคู่ค้าก่อนเสมอ อาจเป็นกลโกงเปลี่ยนผู้รับเงิน'),
    q('finance', 'ซัพพลายเออร์อีเมลแจ้ง "เปลี่ยนเลขบัญชีรับเงินใหม่" กะทันหัน ควรทำอย่างไร?', 'โอนตามเลขบัญชีใหม่ทันที|โทรยืนยันกับซัพพลายเออร์ด้วยเบอร์เดิมที่มีก่อนโอน', 2, 'การเปลี่ยนเลขบัญชีกะทันหันคือกล BEC ต้องยืนยันด้วยช่องทางเดิมก่อนเสมอ'),
    q('finance', 'อีเมล "URGENT T/T ADVICE / SWIFT transfer" แนบไฟล์ให้เปิดเพื่อยืนยันการโอน ควรระวังอะไร?', 'เปิดไฟล์ยืนยันการโอนทันที|ระวังไฟล์แนบอันตราย ตรวจกับฝ่ายการเงิน/ธนาคารก่อน', 2, 'เอกสารโอนเงินด่วนพร้อมไฟล์แนบมักแฝงมัลแวร์หรือหลอกให้โอนผิดบัญชี'),
    q('finance', 'ลูกค้า/คู่ค้าใหม่ส่ง "ใบสั่งซื้อ/สัญญา" เร่งด่วนพร้อมไฟล์แนบแปลก ควรทำอย่างไร?', 'รีบดำเนินการตามเอกสารกันเสียโอกาส|ตรวจสอบตัวตนผู้ส่งและไฟล์แนบก่อนเสมอ', 2, 'ออเดอร์/สัญญาด่วนจากผู้ส่งใหม่เป็นรูปแบบหลอกลวงและช่องทางส่งมัลแวร์'),
    // กลุ่ม file — แชร์ไฟล์ WeTransfer/เอกสารแชร์ + ไฟล์แนบ/มาโคร
    q('file', 'ได้อีเมล "มีเอกสารแชร์ผ่าน WeTransfer กดเพื่อดาวน์โหลด" จากคนที่ไม่รู้จัก ควรทำอย่างไร?', 'กดดาวน์โหลดดูก่อนว่าคืออะไร|ไม่กด ยืนยันกับผู้ส่งผ่านช่องทางที่รู้จักก่อน', 2, 'ลิงก์แชร์ไฟล์ปลอมมักพาไปหน้าล็อกอินเก็บรหัสหรือไฟล์อันตราย'),
    q('file', 'ไฟล์เอกสารแนบขอให้ "Enable Macro / เปิดใช้งานเนื้อหา" จึงจะอ่านได้ ควรทำอย่างไร?', 'กดเปิดใช้งานมาโครเพื่ออ่านไฟล์|ไม่เปิดมาโคร เพราะอาจฝังมัลแวร์ ตรวจกับ IT ก่อน', 2, 'มาโครในไฟล์เอกสารเป็นช่องทางฝังมัลแวร์ที่พบบ่อยมาก'),
    // กลุ่ม social — ความเร่งด่วน + แอบอ้างตัวตน/อำนาจ
    q('social', 'อีเมลกดดันให้ "รีบทำทันทีภายใน 24 ชม. ไม่งั้นเสียหายร้ายแรง" ควรตีความอย่างไร?', 'ความเร่งด่วนแปลว่าเรื่องจริง ต้องรีบทำ|ความเร่งด่วนผิดปกติคือสัญญาณเตือนฟิชชิง ให้หยุดตรวจสอบ', 2, 'การสร้างความกดดันเรื่องเวลาเป็นเทคนิคหลักของฟิชชิงเพื่อให้เหยื่อรีบทำโดยไม่คิด'),
    q('social', 'อีเมลอ้างเป็น "ผู้ดูแลระบบ/IT/ผู้บริหาร" ขอรหัสผ่านหรือให้ทำสิ่งผิดปกติ ควรทำอย่างไร?', 'ทำตามเพราะเป็นผู้มีอำนาจ|ยืนยันตัวตนผ่านช่องทางอื่นก่อน IT จริงไม่ขอรหัสผ่าน', 2, 'การแอบอ้างผู้มีอำนาจเป็นกลกดดัน ควรยืนยันตัวตนผ่านช่องทางที่เชื่อถือได้ก่อนเสมอ')
  ];
}

// g=กลุ่ม, q=คำถาม, c=ตัวเลือก(คั่น |), k=ข้อถูก(เริ่ม 1), e=คำอธิบาย
function questionSeed_() {
  const q = function (g, q, c, k, e) { return { g: g, q: q, c: c, k: k, e: e }; };
  return [
    // ===== กลุ่ม 1: ลิงก์ & โดเมนปลอม (link) =====
    q('link', 'ได้รับ SMS ว่าพัสดุตกค้าง ให้กดลิงก์ย่อ (bit.ly) เพื่อยืนยัน ควรทำอย่างไร?', 'กดลิงก์ทันทีกันพัสดุถูกตีกลับ|ไม่กด เข้าแอป/เว็บขนส่งทางการเช็คเอง', 2, 'ลิงก์ย่อซ่อนปลายทางจริง ให้เข้าช่องทางทางการเองเสมอ'),
    q('link', 'อีเมลจากผู้ส่งโดเมน micros0ft.com (ใช้เลขศูนย์แทนตัว o) บ่งบอกอะไร?', 'เป็นโดเมนทางการของไมโครซอฟท์|เป็นโดเมนปลอมที่เลียนแบบตัวอักษร', 2, 'การสลับตัวอักษร/ตัวเลขเป็นเทคนิคปลอมโดเมน (typosquatting)'),
    q('link', 'ก่อนคลิกลิงก์ในอีเมลบนคอมพิวเตอร์ ควรทำสิ่งใดก่อน?', 'คลิกเลยเพื่อดูว่าใช่ไหม|เอาเมาส์ชี้ค้าง (hover) ดู URL ปลายทางก่อน', 2, 'การ hover ทำให้เห็นปลายทางจริงก่อนตัดสินใจคลิก'),
    q('link', 'เว็บมีรูปกุญแจ (https) แปลว่าเชื่อถือได้เสมอใช่หรือไม่?', 'ใช่ มีกุญแจคือปลอดภัยแน่นอน|ไม่ใช่ เว็บปลอมก็มี https ได้ ต้องดูโดเมนด้วย', 2, 'https บอกแค่การเข้ารหัส ไม่ได้รับรองว่าเว็บนั้นเป็นของจริง'),
    q('link', 'อีเมลธนาคารให้กดลิงก์เพื่อ "ยืนยันบัญชีด่วน" ควรทำอย่างไร?', 'กดลิงก์แล้วล็อกอินยืนยัน|เปิดแอป/เว็บธนาคารเองโดยไม่กดลิงก์', 2, 'ธนาคารจริงไม่ให้ยืนยันบัญชีผ่านลิงก์ในอีเมล ให้เข้าช่องทางเอง'),
    q('link', 'URL คือ login.yourbank.com.secure-verify.net ส่วนใดคือโดเมนจริง?', 'yourbank.com จึงปลอดภัย|secure-verify.net คือโดเมนจริง = น่าสงสัย', 2, 'โดเมนจริงคือส่วนขวาสุดก่อน path ที่นี่คือ secure-verify.net'),
    q('link', 'เจอ QR code สติกเกอร์แปะทับของเดิมที่ตู้จ่ายเงิน/ป้าย ควรทำอย่างไร?', 'สแกนได้เลยสะดวกดี|ไม่สแกน เพราะอาจถูกแปะทับด้วย QR ปลอม', 2, 'มิจฉาชีพแปะ QR ปลอมทับของจริงเพื่อพาไปเว็บหลอก'),
    q('link', 'อีเมลให้สแกน QR เพื่อ "เข้าสู่ระบบบัญชีบริษัท" ควรระวังอะไร?', 'สแกนด้วยมือถือได้ ปลอดภัยกว่า|QR พาไปหน้าล็อกอินปลอมได้เช่นกัน', 2, 'QR เป็นแค่ลิงก์รูปแบบหนึ่ง พาไปหน้าปลอมได้เหมือนลิงก์ข้อความ'),
    q('link', 'ได้ลิงก์ไฟล์เอกสารแชร์มาจากคนที่ไม่รู้จัก ควรทำอย่างไร?', 'เปิดดูก่อนว่าคืออะไร|ไม่เปิด และยืนยันกับผู้ส่งผ่านช่องทางที่รู้จัก', 2, 'ลิงก์เอกสารปลอมมักพาไปหน้าล็อกอินเก็บรหัส'),
    q('link', 'อีเมล "บัญชีจะถูกระงับใน 24 ชม. คลิกที่นี่" ใช้กลอุบายใด?', 'ให้ข้อมูลที่เป็นประโยชน์|สร้างความเร่งด่วนเพื่อให้รีบกดโดยไม่คิด', 2, 'การจำกัดเวลาเป็นกลกดดันให้เหยื่อรีบกดลิงก์'),
    q('link', 'ก่อนกรอกข้อมูลในหน้าเว็บ สิ่งสำคัญที่สุดที่ต้องตรวจคืออะไร?', 'สีและดีไซน์ของหน้าเว็บ|ชื่อโดเมนบน address bar ว่าถูกต้อง', 2, 'หน้าตาลอกเลียนได้ แต่โดเมนปลอมจะต่างจากของจริงเสมอ'),
    q('link', 'วิธีเข้าเว็บสำคัญ (ธนาคาร/อีเมลงาน) ที่ปลอดภัยที่สุดคือ?', 'กดลิงก์ที่ส่งมาในอีเมล|พิมพ์ที่อยู่เว็บเอง หรือใช้บุ๊กมาร์กที่บันทึกไว้', 2, 'พิมพ์เอง/บุ๊กมาร์กตัดความเสี่ยงจากลิงก์ปลอม'),
    q('link', 'อีเมลโฆษณามีปุ่ม "ยกเลิกการรับ (unsubscribe)" จากผู้ส่งที่ไม่รู้จัก ควร?', 'กดเพื่อเลิกรับทันที|ไม่กด เพราะอาจยืนยันว่าอีเมลเราใช้งานจริง', 2, 'การกดในสแปมที่น่าสงสัยอาจยืนยันตัวตนหรือพาไปหน้าหลอก'),
    q('link', 'โดเมนผู้ส่งคือ yourcompany.com.co แตกต่างจาก yourcompany.com อย่างไร?', 'เหมือนกัน แค่เพิ่มประเทศ|คนละโดเมน .com.co อาจเป็นของปลอม', 2, 'ส่วนต่อท้ายที่ต่างกันทำให้เป็นคนละเจ้าของโดเมน'),
    q('link', 'ไฟล์แนบ .html เปิดแล้วขึ้นหน้าให้กรอกอีเมล/รหัสผ่าน ควรทำอย่างไร?', 'กรอกเพราะหน้าตาเหมือนของบริษัท|ปิดทันที ไม่กรอก และรายงาน IT', 2, 'ไฟล์ HTML แนบเป็นเทคนิคทำหน้า login ปลอมแบบ offline'),
    q('link', 'อีเมลมีปุ่มสีเด่น "อัปเดตข้อมูลบัญชี" ควรเชื่อปุ่มหรือไม่?', 'เชื่อ เพราะปุ่มดูเป็นทางการ|ตรวจปลายทางปุ่มก่อน ปุ่มซ่อนลิงก์ปลอมได้', 2, 'ข้อความปุ่มกับลิงก์จริงอาจไม่ตรงกัน ต้องตรวจปลายทาง'),
    q('link', 'ค้นหาเว็บธนาคารใน Google แล้วเจอผลที่เป็น "โฆษณา (Ad)" ด้านบน ควร?', 'กดผลโฆษณาอันแรกเลย|ระวัง โฆษณาอาจเป็นเว็บปลอม ให้ดูโดเมนให้ชัด', 2, 'มิจฉาชีพซื้อโฆษณาเลียนแบบเว็บจริงเพื่อดักเหยื่อ'),
    q('link', 'คลิกลิงก์แล้วถูกพาเด้งหลายเว็บก่อนถึงปลายทาง บ่งบอกอะไร?', 'ปกติของเว็บใหญ่|น่าสงสัย การ redirect หลายชั้นมักใช้ซ่อนปลายทางจริง', 2, 'การเด้งหลายชั้นเป็นเทคนิคหลบการตรวจจับและซ่อนเว็บหลอก'),
    q('link', 'โดเมนสะกดเหมือนของจริงแต่ลงท้าย .xyz/.top แทน .com ควรคิดอย่างไร?', 'นามสกุลไม่สำคัญ|ระวัง อาจเป็นโดเมนปลอมที่จดด้วยนามสกุลราคาถูก', 2, 'นามสกุลโดเมนที่ผิดจากปกติเป็นสัญญาณของการปลอม'),
    q('link', 'จะเพิ่มความมั่นใจว่าเว็บที่จะกรอกข้อมูลเป็นของจริง ทำอย่างไรได้บ้าง?', 'ดูแค่ว่าหน้าเว็บสวย|ตรวจโดเมนให้ตรง และเข้าจากช่องทางที่บันทึกไว้', 2, 'ยืนยันจากโดเมนและช่องทางที่เชื่อถือได้ ไม่ใช่หน้าตาเว็บ'),
    q('link', 'หากสงสัยว่าลิงก์/อีเมลเป็นฟิชชิง สิ่งที่ควรทำคือ?', 'ลบทิ้งเงียบ ๆ|รายงานให้ฝ่าย IT เพื่อเตือนคนอื่นและตรวจสอบ', 2, 'การรายงานช่วยให้องค์กรป้องกันคนอื่นได้ทัน'),

    // ===== กลุ่ม 2: รหัสผ่าน & OTP/MFA (cred) =====
    q('cred', 'อีเมลขอให้กรอกรหัสผ่านบัญชีงานผ่านลิงก์ ควรทำอย่างไร?', 'กรอกเพราะเป็นเรื่องด่วน|ไม่กรอก และตรวจสอบผ่านช่องทางทางการ', 2, 'ระบบจริงไม่ขอรหัสผ่านผ่านลิงก์ในอีเมล'),
    q('cred', 'มีคนโทรมาอ้างเป็นเจ้าหน้าที่ ขอรหัส OTP ที่เพิ่งส่งเข้ามือถือ ควร?', 'บอกไป เพราะเขาเป็นเจ้าหน้าที่|ไม่บอกใครทั้งสิ้น OTP เป็นความลับส่วนตัว', 2, 'เจ้าหน้าที่จริงไม่มีวันขอ OTP ของคุณ'),
    q('cred', 'การใช้รหัสผ่านเดียวกันทุกเว็บมีความเสี่ยงอย่างไร?', 'ไม่เสี่ยง จำง่ายดี|ถ้าเว็บหนึ่งรั่ว บัญชีอื่นถูกเจาะตามทั้งหมด', 2, 'รหัสซ้ำทำให้เกิด credential stuffing เมื่อข้อมูลรั่ว'),
    q('cred', 'การเปิดยืนยันตัวตนสองขั้น (MFA) มีประโยชน์อย่างไร?', 'ไม่จำเป็นถ้ารหัสผ่านยาว|เพิ่มชั้นป้องกัน แม้รหัสผ่านรั่วก็ยังเข้าไม่ได้ง่าย', 2, 'MFA เพิ่มด่านที่สองทำให้ผู้ไม่หวังดีเข้าระบบยากขึ้นมาก'),
    q('cred', 'ข้อความ "ตรวจพบการเข้าสู่ระบบผิดปกติ กดยืนยันตัวตนที่นี่" ควรระวังอะไร?', 'รีบกดยืนยันทันที|อาจเป็นลิงก์ปลอม ให้เข้าตั้งค่าบัญชีเองเพื่อตรวจ', 2, 'ข้อความขู่เรื่องความปลอดภัยเป็นกลล่อให้กดลิงก์ปลอม'),
    q('cred', 'มีการแจ้งเตือน MFA เด้งขออนุมัติรัว ๆ ทั้งที่คุณไม่ได้ล็อกอิน ควรทำอย่างไร?', 'กดอนุมัติให้มันหยุดเด้ง|กดปฏิเสธทุกครั้ง และเปลี่ยนรหัสผ่านทันที', 2, 'นี่คือ MFA fatigue การกดอนุมัติเท่ากับเปิดประตูให้ผู้บุกรุก'),
    q('cred', 'การเขียนรหัสผ่านแปะไว้ที่หน้าจอหรือใต้คีย์บอร์ดเหมาะสมหรือไม่?', 'เหมาะ กันลืม|ไม่เหมาะ ใครเดินผ่านก็เห็นและนำไปใช้ได้', 2, 'รหัสที่มองเห็นได้ทางกายภาพเสี่ยงถูกขโมยง่าย'),
    q('cred', 'โปรแกรมจัดการรหัสผ่าน (password manager) ช่วยอะไร?', 'อันตราย เก็บรหัสไว้ที่เดียว|ช่วยตั้งรหัสยาว-ไม่ซ้ำ และจำแทนเราได้ปลอดภัย', 2, 'ช่วยให้ใช้รหัสที่แข็งแรงและต่างกันทุกเว็บโดยไม่ต้องจำเอง'),
    q('cred', 'หน้าล็อกอินหน้าตาเหมือนของบริษัทเป๊ะ แต่ URL ไม่ตรง ควรทำอย่างไร?', 'ล็อกอินได้เพราะหน้าตาเหมือน|ไม่ล็อกอิน เพราะอาจเป็นหน้าเก็บรหัสปลอม', 2, 'หน้าตาเลียนได้ แต่โดเมนที่ผิดบ่งบอกว่าเป็นของปลอม'),
    q('cred', 'หลักการสำคัญเรื่องรหัส OTP คือข้อใด?', 'แชร์ได้กับคนที่ไว้ใจ|ห้ามบอกใครเด็ดขาด แม้อ้างเป็นเจ้าหน้าที่', 2, 'OTP ใช้ยืนยันตัวคุณคนเดียว การบอกผู้อื่นคือการมอบสิทธิ์เข้าบัญชี'),
    q('cred', 'รหัสผ่านแบบใดแข็งแรงกว่ากัน?', 'สั้นแต่จำง่าย เช่น 1234|ยาวและผสมตัวอักษร/ตัวเลข/อักขระพิเศษ', 2, 'รหัสที่ยาวและซับซ้อนเดาและเจาะได้ยากกว่ามาก'),
    q('cred', 'อีเมล "รหัสผ่านของคุณกำลังจะหมดอายุ คลิกเพื่อต่ออายุ" ควรทำอย่างไร?', 'คลิกลิงก์แล้วตั้งรหัสใหม่|เข้าตั้งค่าบัญชีเองเพื่อตรวจ ไม่กดลิงก์', 2, 'ลิงก์ต่ออายุรหัสมักเป็นหน้าปลอมเพื่อดักรหัสเดิม'),
    q('cred', 'ระบบภายนอกที่ไม่เกี่ยวข้อง ขอให้กรอก "อีเมลและรหัสผ่านของบริษัท" ควร?', 'กรอกเพื่อความสะดวก|ไม่กรอก รหัสบริษัทใช้เฉพาะระบบทางการเท่านั้น', 2, 'การกรอกรหัสองค์กรในเว็บนอกเสี่ยงรหัสรั่วสู่บุคคลที่สาม'),
    q('cred', 'MFA แบบใดปลอดภัยกว่าโดยทั่วไป?', 'รับรหัสทาง SMS|ใช้แอป Authenticator หรือกุญแจความปลอดภัย', 2, 'SMS ถูกดัก/สลับซิมได้ แอป Authenticator ปลอดภัยกว่า'),
    q('cred', 'ทำไมไม่ควรใช้รหัสผ่านงานซ้ำกับเว็บส่วนตัวที่เคยรั่ว?', 'ไม่เป็นไร คนละระบบ|ผู้ร้ายเอารหัสที่รั่วมาลองล็อกอินระบบงาน', 2, 'credential stuffing คือการนำรหัสรั่วไปไล่ลองกับระบบอื่น'),
    q('cred', 'เพื่อนร่วมงานขอใช้บัญชี/รหัสของคุณเข้าระบบชั่วคราว ควรทำอย่างไร?', 'ให้ไปเพราะเป็นเพื่อนกัน|ไม่ให้ บัญชีเป็นความรับผิดชอบส่วนตัว แจ้งขอสิทธิ์เอง', 2, 'การแชร์บัญชีทำให้ตามรอยผู้ใช้จริงไม่ได้และเสี่ยงถูกสวมรอย'),
    q('cred', 'เมื่อลุกจากโต๊ะทำงานชั่วคราว ควรทำอย่างไรกับคอมพิวเตอร์?', 'เปิดทิ้งไว้ เดี๋ยวก็กลับมา|ล็อกหน้าจอทุกครั้ง (Win+L)', 2, 'การล็อกหน้าจอกันคนอื่นเข้าถึงบัญชีที่เปิดค้างไว้'),
    q('cred', 'อีเมลอ้างเป็น Microsoft 365 ให้ "ยืนยันตัวตนเพื่อไม่ให้บัญชีถูกลบ" ควร?', 'ยืนยันผ่านลิงก์ในอีเมล|เข้าพอร์ทัล Microsoft เองเพื่อตรวจสถานะ', 2, 'อีเมลขู่ลบบัญชีพร้อมลิงก์มักเป็นฟิชชิงขโมยรหัส'),
    q('cred', 'หากสงสัยว่ารหัสผ่านของคุณรั่ว ควรทำสิ่งใดเป็นอันดับแรก?', 'รอดูสถานการณ์ก่อน|เปลี่ยนรหัสทันที และแจ้ง IT', 2, 'การเปลี่ยนรหัสเร็วช่วยตัดสิทธิ์ผู้บุกรุกก่อนเกิดความเสียหาย'),
    q('cred', 'มีคนขอให้คุณบอกรหัสผ่านหรือ OTP ไม่ว่าด้วยเหตุผลใด ควร?', 'พิจารณาเป็นกรณีไป|ปฏิเสธและรายงาน เพราะไม่มีเหตุผลที่ถูกต้องให้ต้องบอก', 2, 'ไม่มีกระบวนการที่ถูกต้องใดต้องให้คุณเปิดเผยรหัส/OTP'),

    // ===== กลุ่ม 3: การเงิน & ใบแจ้งหนี้ (finance) =====
    q('finance', 'อีเมลอ้างเป็น CEO ขอให้คุณโอนเงินด่วนและ "ห้ามบอกใคร" ควรทำอย่างไร?', 'โอนทันทีตามคำสั่งผู้บริหาร|ยืนยันตัวตนผ่านช่องทางที่รู้จักก่อนเสมอ', 2, 'ความเร่งด่วน+ความลับ คือธงแดงคลาสสิกของกลโกง CEO fraud'),
    q('finance', 'ใบแจ้งหนี้จากคู่ค้าระบุ "เปลี่ยนเลขบัญชีรับเงินใหม่" ควรทำอย่างไร?', 'โอนตามเลขใหม่ทันที|โทรยืนยันกับคู่ค้าผ่านเบอร์เดิมที่รู้จักก่อน', 2, 'การเปลี่ยนเลขบัญชีเป็นสัญญาณ BEC ต้องยืนยันก่อนโอน'),
    q('finance', 'ผู้ขายส่งอีเมลแจ้งเลขบัญชีใหม่ให้โอน คุณควรตรวจสอบอย่างไร?', 'ดูแค่ว่าอีเมลมาจากชื่อผู้ขาย|โทรกลับเบอร์ทางการเพื่อยืนยันการเปลี่ยน', 2, 'อีเมลถูกปลอม/แฮกได้ การโทรยืนยันด้วยเบอร์เดิมปลอดภัยกว่า'),
    q('finance', 'ได้อีเมลแจ้งว่าได้รับรางวัล/โบนัส ให้กรอกข้อมูลเพื่อรับเงิน ควร?', 'กรอกข้อมูลรับรางวัล|สงสัยไว้ก่อน ของรางวัลที่ไม่ได้เข้าร่วมมักเป็นกลลวง', 2, 'รางวัลลอยมาเป็นเหยื่อล่อให้กรอกข้อมูล/จ่ายค่าธรรมเนียม'),
    q('finance', 'ก่อนทำรายการโอนเงินตามคำขอทางอีเมล ขั้นตอนที่ดีที่สุดคือ?', 'ทำตามอีเมลเลยถ้าดูเป็นทางการ|ยืนยันกับผู้ขอผ่านช่องทางที่รู้จักก่อน', 2, 'การยืนยันนอกอีเมลช่วยกันการสวมรอย'),
    q('finance', 'ใบแจ้งหนี้แนบไฟล์ชื่อ invoice.zip หรือ invoice.exe ควรทำอย่างไร?', 'เปิดดูรายละเอียดก่อน|ไม่เปิด ไฟล์ลักษณะนี้มักเป็นมัลแวร์', 2, 'ใบแจ้งหนี้จริงไม่ค่อยมาเป็น .exe/.zip ที่ต้องรันโปรแกรม'),
    q('finance', 'อีเมล "เร่งจ่ายก่อนปิดงบสิ้นเดือน ไม่งั้นมีปัญหา" ใช้กลใด?', 'ให้ข้อมูลที่เป็นประโยชน์|กดดันด้วยเวลา+ผลเสีย ให้รีบจ่ายโดยไม่ตรวจสอบ', 2, 'ความเร่งด่วนถูกใช้เพื่อข้ามขั้นตอนตรวจสอบปกติ'),
    q('finance', 'การควบคุมที่ดีก่อนเปลี่ยนปลายทางการจ่ายเงินคืออะไร?', 'คนเดียวอนุมัติได้เพื่อความเร็ว|ยืนยันสองชั้น/สองคน (dual control)', 2, 'การอนุมัติหลายชั้นลดโอกาสถูกหลอกโอนผิดบัญชี'),
    q('finance', 'หัวหน้า (ทางแชต/อีเมล) ขอให้คุณซื้อบัตรของขวัญ (gift card) ด่วนแล้วส่งรหัสให้ ควร?', 'รีบซื้อและส่งรหัสไป|สงสัยทันที นี่เป็นรูปแบบหลอกที่พบบ่อย ให้ยืนยันตัวตน', 2, 'การขอ gift card เร่งด่วนเป็นสแกมยอดนิยม ควรยืนยันตัวจริงก่อน'),
    q('finance', 'อีเมลอ้างเป็นสรรพากร แจ้งคืนภาษีให้กรอกเลขบัตรเครดิตเพื่อรับเงิน ควร?', 'กรอกเพื่อรับเงินคืน|ไม่กรอก หน่วยงานจริงไม่ขอบัตรเครดิตเพื่อ "คืนเงิน"', 2, 'การคืนเงินไม่ต้องใช้เลขบัตรเครดิต นี่คือกลขโมยข้อมูลการเงิน'),
    q('finance', 'สำหรับการโอนเงินก้อนใหญ่ แนวทางที่ปลอดภัยคือ?', 'ให้คนเดียวจัดการจบ|ต้องมีการอนุมัติมากกว่าหนึ่งคน', 2, 'dual approval ช่วยตรวจทานและกันการฉ้อโกง'),
    q('finance', 'อีเมลใช้ชื่อแสดงเป็น "CFO บริษัท" แต่อีเมลจริงเป็น gmail ส่วนตัว บอกอะไร?', 'อาจเป็น CFO ใช้เมลส่วนตัว|น่าสงสัยมาก ชื่อแสดงปลอมได้ ต้องดูอีเมลจริง', 2, 'ชื่อผู้ส่ง (display name) ปลอมง่าย ให้ดูที่อยู่อีเมลจริงเสมอ'),
    q('finance', 'ลิงก์ "ชำระเงิน" ในอีเมลพาไปโดเมนแปลกที่ไม่ใช่ของผู้ขาย ควร?', 'จ่ายผ่านลิงก์เพื่อความรวดเร็ว|ไม่จ่าย เข้าระบบชำระเงินทางการเอง', 2, 'หน้า payment ปลอมเก็บข้อมูลบัตร/บัญชีของคุณ'),
    q('finance', 'ได้รับใบเสนอราคา/ใบแจ้งหนี้สำหรับสินค้าที่บริษัทไม่เคยสั่ง ควรทำอย่างไร?', 'จ่ายไปก่อนกันมีปัญหา|ตรวจสอบกับฝ่ายจัดซื้อ อย่าเพิ่งจ่าย', 2, 'ใบแจ้งหนี้ลวงสำหรับของที่ไม่ได้สั่งเป็นกลโกงที่พบบ่อย'),
    q('finance', 'คู่ค้าขู่ว่าจะตัดบริการถ้าไม่จ่ายภายในวันนี้ ทั้งที่ผิดปกติ ควร?', 'รีบจ่ายตามที่ขู่|ตั้งสติ ยืนยันผ่านช่องทางทางการก่อนตัดสินใจ', 2, 'การข่มขู่+เร่งด่วนคือเทคนิคบีบให้จ่ายโดยไม่ตรวจสอบ'),
    q('finance', 'ในเรื่องเกี่ยวกับการเงิน สิ่งที่ควรตรวจทุกครั้งก่อนดำเนินการคือ?', 'แค่เนื้อหาว่าน่าเชื่อไหม|ที่อยู่อีเมลผู้ส่งจริงและช่องทางยืนยัน', 2, 'การตรวจโดเมนผู้ส่งช่วยจับการปลอมตัวในเรื่องเงิน'),
    q('finance', 'อีเมลภายในขอ "ข้อมูลเงินเดือน/สลิปพนักงานทั้งหมด" ด่วน ควรทำอย่างไร?', 'ส่งให้เพราะเป็นเมลภายใน|ยืนยันตัวผู้ขอก่อน ข้อมูลนี้อ่อนไหวมาก', 2, 'การขอข้อมูล payroll จำนวนมากเป็นเป้าหมายของ BEC'),
    q('finance', 'ก่อนแก้ไขข้อมูลบัญชีผู้รับเงินในระบบ ควรมีขั้นตอนใด?', 'แก้ตามอีเมลที่แจ้งมา|callback verification ยืนยันกับผู้รับจริงก่อน', 2, 'การโทรยืนยันก่อนเปลี่ยนบัญชีกัน BEC ได้ดี'),
    q('finance', 'ข้อความ "เราโอนเงินเข้าบัญชีคุณผิด ช่วยโอนคืนด่วน" ควรระวังอะไร?', 'รีบโอนคืนตามจำนวน|ตรวจกับธนาคารเองก่อน อาจเป็นกลลวง/เงินปลอม', 2, 'สแกมโอนผิดหลอกให้คุณคืนเงินจากเงินที่ไม่มีจริง'),
    q('finance', 'เมื่อพบคำขอโอน/จ่ายเงินที่ผิดปกติ สิ่งที่ควรทำคือ?', 'จัดการเองเงียบ ๆ|รายงานหัวหน้า/ฝ่ายการเงินและ IT ทันที', 2, 'การรายงานช่วยหยุดธุรกรรมและเตือนทั้งองค์กร'),

    // ===== กลุ่ม 4: ไฟล์แนบ & อุปกรณ์ (file) =====
    q('file', 'ไฟล์ Word แนบมาพร้อมข้อความ "กดเปิดใช้งานมาโคร (Enable Macro) เพื่อดูเนื้อหา" ควร?', 'กดเปิดมาโครเพื่อดู|ไม่เปิด มาโครเป็นช่องทางฝังมัลแวร์ยอดนิยม', 2, 'การหลอกให้ Enable Macro เป็นเทคนิคติดตั้งมัลแวร์ที่พบบ่อย'),
    q('file', 'ไฟล์ชื่อ invoice.pdf.exe บอกอะไรกับคุณ?', 'เป็นไฟล์ PDF ปกติ|จริง ๆ เป็นไฟล์ .exe (โปรแกรม) ปลอมเป็น PDF', 2, 'นามสกุลซ้อนท้าย .exe คือไฟล์รันโปรแกรม = อันตราย'),
    q('file', 'เจอ USB แปลกปลอมตกอยู่ในลานจอดรถบริษัท ควรทำอย่างไร?', 'เสียบดูว่าเป็นของใคร|ไม่เสียบ ส่งให้ IT เพราะอาจเป็นกับดักมัลแวร์', 2, 'USB ล่อ (baiting) เป็นวิธีแพร่มัลแวร์เข้าสู่องค์กร'),
    q('file', 'ได้รับไฟล์แนบจากผู้ส่งที่ไม่รู้จักเลย ควรทำอย่างไร?', 'เปิดดูก่อนว่าคืออะไร|ไม่เปิด ลบหรือส่ง IT ตรวจสอบ', 2, 'ไฟล์จากคนแปลกหน้าเสี่ยงเป็นมัลแวร์'),
    q('file', 'ไฟล์ .zip ใส่รหัสผ่านพร้อมรหัสในอีเมล ทำไมจึงน่าสงสัย?', 'สะดวกดี ปลอดภัยขึ้น|รหัสใช้เลี่ยงการสแกนไวรัสของระบบเมล', 2, 'zip ใส่รหัสมักใช้ซ่อนมัลแวร์จากตัวสแกนอีเมล'),
    q('file', 'ลิงก์ไฟล์ Drive/OneDrive แชร์ "ด่วน" จากชื่อที่ดูคุ้น แต่ไม่ได้นัดหมาย ควร?', 'เปิดเพราะชื่อคุ้น|ยืนยันกับผู้ส่งก่อน ลิงก์แชร์ปลอมพาไปหน้าหลอกได้', 2, 'การแชร์ไฟล์ปลอมมักพาไปหน้าเก็บรหัส'),
    q('file', 'ขณะเปิดเว็บมี pop-up เด้งว่า "ซอฟต์แวร์ล้าสมัย กดอัปเดตที่นี่" ควร?', 'กดอัปเดตตาม pop-up|ปิดไป แล้วอัปเดตจากแหล่งทางการของโปรแกรมเอง', 2, 'pop-up อัปเดตปลอมเป็นช่องทางหลอกติดตั้งมัลแวร์'),
    q('file', 'เสียบสายชาร์จมือถือกับพอร์ต USB สาธารณะ (สนามบิน/ห้าง) เสี่ยงอะไร?', 'ไม่เสี่ยง แค่ชาร์จไฟ|เสี่ยง juice jacking ขโมยข้อมูล/ฝังมัลแวร์ได้', 2, 'พอร์ต USB สาธารณะอาจถ่ายโอนข้อมูล ไม่ใช่แค่จ่ายไฟ'),
    q('file', 'การเสียบอุปกรณ์ USB ที่ไม่รู้ที่มากับคอมพิวเตอร์บริษัท ควร?', 'เสียบได้ถ้าจำเป็น|หลีกเลี่ยง และให้ IT ตรวจก่อนใช้งาน', 2, 'อุปกรณ์ที่ไม่รู้ที่มาอาจมีมัลแวร์หรือเป็น USB ปลอมตัว'),
    q('file', 'ไฟล์แนบ .html เปิดแล้วเป็นฟอร์มให้ล็อกอิน บ่งบอกอะไร?', 'เป็นเอกสารปกติ|เป็นหน้าฟิชชิงแบบไฟล์ ไม่ควรกรอกข้อมูล', 2, 'HTML แนบใช้ทำหน้า login ปลอมเพื่อดักรหัส'),
    q('file', 'เมื่อสงสัยว่าไฟล์แนบอาจอันตราย ควรทำอย่างไรก่อนเปิด?', 'เปิดในเครื่องตัวเองดูก่อน|ส่งให้ IT ตรวจ หรือสแกนก่อนเสมอ', 2, 'การให้ผู้เชี่ยวชาญตรวจก่อนลดความเสี่ยงติดมัลแวร์'),
    q('file', 'คู่ค้าใหม่ส่งไฟล์ Excel ที่ต้องเปิดมาโครเพื่อ "คำนวณราคา" ควร?', 'เปิดมาโครเพราะเป็นคู่ค้า|ระวัง ยืนยันความจำเป็นและที่มาก่อนเปิด', 2, 'มาโครจากแหล่งใหม่ควรตรวจสอบก่อน เป็นช่องทางมัลแวร์'),
    q('file', 'การดาวน์โหลดโปรแกรมเถื่อน/ตัว crack มีความเสี่ยงอย่างไร?', 'ประหยัดเงิน ไม่เสี่ยง|มักมีมัลแวร์แฝงและทำให้ระบบติดเชื้อ', 2, 'ซอฟต์แวร์ละเมิดลิขสิทธิ์เป็นแหล่งแพร่มัลแวร์ใหญ่'),
    q('file', 'แนวทางที่ดีในการลดความเสี่ยงจากช่องโหว่ของระบบคือ?', 'ปิดการอัปเดตเพื่อความเสถียร|อัปเดตระบบปฏิบัติการ/แอนติไวรัสสม่ำเสมอ', 2, 'การอัปเดตอุดช่องโหว่ที่ผู้โจมตีใช้'),
    q('file', 'ไฟล์ชื่อ report.doc.scr ที่ส่งมาทางอีเมล ควรทำอย่างไร?', 'เปิดเพราะดูเป็นเอกสาร|ไม่เปิด .scr คือไฟล์รันโปรแกรม อันตราย', 2, 'นามสกุลซ้อน (.scr/.exe/.bat) บ่งชี้ไฟล์โปรแกรมที่อันตราย'),
    q('file', 'ควรดาวน์โหลดแอป/โปรแกรมจากที่ใดจึงปลอดภัยที่สุด?', 'เว็บไหนก็ได้ที่ค้นเจอ|เว็บทางการ/สโตร์อย่างเป็นทางการเท่านั้น', 2, 'แหล่งทางการลดโอกาสได้ไฟล์ที่ถูกฝังมัลแวร์'),
    q('file', 'เมื่อ Office เปิดไฟล์ในโหมด "Protected View" คุณควรทำอย่างไร?', 'กดเปิดการแก้ไขทันที|คงโหมดป้องกันไว้จนแน่ใจว่าไฟล์ปลอดภัย', 2, 'Protected View กันมาโคร/โค้ดอันตรายทำงานก่อนคุณยืนยัน'),
    q('file', 'การนำอุปกรณ์ส่วนตัวมาต่อเครือข่าย/ระบบบริษัท (BYOD) ควร?', 'ต่อได้เลยสะดวกดี|ปฏิบัติตามนโยบายบริษัทและให้ IT ดูแลก่อน', 2, 'อุปกรณ์ส่วนตัวที่ไม่ได้ตรวจอาจนำมัลแวร์เข้าสู่เครือข่าย'),
    q('file', 'มัลแวร์เรียกค่าไถ่ (ransomware) มักเริ่มต้นการโจมตีจากช่องทางใดบ่อยที่สุด?', 'การอัปเดต Windows|ไฟล์แนบ/ลิงก์อันตรายในอีเมล', 2, 'อีเมลแนบไฟล์อันตรายเป็นจุดเริ่มของ ransomware ส่วนใหญ่'),
    q('file', 'แนวทางที่ช่วยให้กู้ข้อมูลคืนได้หากถูก ransomware คือ?', 'ไม่ต้องทำอะไรล่วงหน้า|สำรองข้อมูลสำคัญสม่ำเสมอและแยกที่เก็บ', 2, 'การสำรองข้อมูลที่ดีช่วยกู้คืนโดยไม่ต้องจ่ายค่าไถ่'),

    // ===== กลุ่ม 5: Social Engineering (social) =====
    q('social', 'มีคนโทรมาอ้างเป็นฝ่าย IT ขอ "รีโมตเข้าเครื่อง" เพื่อแก้ปัญหาด่วน ควร?', 'ให้เข้าเลยเพราะเป็น IT|ยืนยันตัวตนผ่านช่องทางทางการก่อนเสมอ', 2, 'ผู้แอบอ้างเป็น IT เป็นกลโกงเข้าควบคุมเครื่องที่พบบ่อย'),
    q('social', 'อีเมล/ข้อความที่เร่งด่วนและกดดันผิดปกติ เป็นสัญญาณของอะไร?', 'ความใส่ใจของผู้ส่ง|ธงแดงของฟิชชิง/วิศวกรรมสังคม', 2, 'ความเร่งด่วนถูกใช้เพื่อให้เหยื่อรีบทำโดยไม่ทันคิด'),
    q('social', 'คนแปลกหน้าขอให้คุณ "เปิดประตูพนักงานให้หน่อย" (ไม่มีบัตร) ควร?', 'เปิดให้เพราะดูสุภาพ|ไม่เปิด ให้ติดต่อผ่านจุดลงทะเบียน/รปภ.', 2, 'การตามเข้าประตู (tailgating) เป็นการบุกรุกทางกายภาพ'),
    q('social', 'มีอีเมลอ้างเป็น "ผู้บริหารใหม่" ขอข้อมูลภายในด่วน ทั้งที่คุณไม่รู้จัก ควร?', 'ส่งให้เพราะเป็นผู้บริหาร|ตรวจสอบตัวตนผ่านช่องทางทางการก่อน', 2, 'การอ้างตำแหน่งสูงเป็นกลกดดันให้ทำตามโดยไม่ตรวจสอบ'),
    q('social', 'อีเมลอ้างเป็น HR เรื่องสวัสดิการ ให้คลิกกรอกข้อมูลส่วนตัวด่วน ควร?', 'กรอกตามเพราะเป็นเรื่อง HR|ยืนยันกับ HR ผ่านช่องทางที่รู้จักก่อน', 2, 'การปลอมเป็น HR เพื่อล้วงข้อมูลส่วนบุคคลพบได้บ่อย'),
    q('social', 'มีสายโทรเข้าขอข้อมูลส่วนตัว/ข้อมูลบริษัททางโทรศัพท์ (vishing) ควร?', 'ให้ข้อมูลถ้าเขารู้ชื่อเรา|ไม่ให้ และโทรกลับเบอร์ทางการเพื่อยืนยัน', 2, 'ผู้โจมตีหาข้อมูลพื้นฐานมาก่อนเพื่อสร้างความน่าเชื่อถือ'),
    q('social', 'ได้รับสายที่ "เสียงเหมือนหัวหน้า" สั่งให้ทำธุรกรรมด่วน ควรระวังอะไร?', 'ทำตามเพราะเสียงคุ้น|เสียงปลอมด้วย AI ได้ ให้ยืนยันอีกช่องทาง', 2, 'AI voice/deepfake เลียนเสียงได้ ต้องยืนยันด้วยช่องทางที่สอง'),
    q('social', 'มีคนนอกขอให้คุณเปิดเผยข้อมูลส่วนบุคคลของลูกค้า ควรคำนึงถึงอะไร?', 'ให้ได้ถ้าเขาต้องการจริง|ข้อมูลส่วนบุคคลได้รับการคุ้มครอง (PDPA) ห้ามเปิดเผยตามอำเภอใจ', 2, 'การเปิดเผยข้อมูลส่วนบุคคลต้องมีฐานทางกฎหมายและการอนุญาต'),
    q('social', 'แบบสอบถาม/ของฟรีออนไลน์ขอข้อมูลส่วนตัวเยอะผิดปกติ ควร?', 'กรอกเพื่อรับของฟรี|ระวัง อาจเป็นการเก็บข้อมูลเพื่อนำไปโจมตี', 2, 'ของฟรีมักแลกมาด้วยข้อมูลที่ผู้ร้ายนำไปใช้ต่อ'),
    q('social', 'การโพสต์ข้อมูลภายใน/โครงสร้างทีมบริษัทบนโซเชียลมีเดียเสี่ยงอย่างไร?', 'ไม่เสี่ยง เป็นเรื่องทั่วไป|ช่วยให้ผู้โจมตีวางแผนวิศวกรรมสังคมได้ง่ายขึ้น', 2, 'ข้อมูลองค์กรที่เปิดเผยถูกใช้สร้างเรื่องหลอก (pretext)'),
    q('social', 'มีโปรไฟล์ "เพื่อนร่วมงาน/ผู้บริหาร" ใน LinkedIn ขอ connect แต่ดูแปลก ควร?', 'รับเลยเผื่อรู้จัก|ตรวจสอบตัวตนก่อน โปรไฟล์ปลอมใช้สร้างความน่าเชื่อถือ', 2, 'บัญชีปลอมใช้สร้างความสัมพันธ์ก่อนหลอกในภายหลัง'),
    q('social', 'มีคนอ้างเป็นตำรวจ/ราชการ โทรมาขู่ค่าปรับและให้โอนเงินด่วน ควร?', 'รีบโอนกันถูกดำเนินคดี|วางสาย ตรวจสอบกับหน่วยงานจริงผ่านเบอร์ทางการ', 2, 'การข่มขู่โดยอ้างราชการเป็นกลโกงคอลเซ็นเตอร์ที่พบบ่อย'),
    q('social', 'หลักปฏิบัติที่ดีก่อนให้ข้อมูลสำคัญแก่ผู้ที่ติดต่อมาคือ?', 'เชื่อถ้าเขาดูเป็นทางการ|ยืนยันตัวตนผ่านช่องทางที่คุณรู้จักก่อนเสมอ', 2, 'การยืนยันตัวตนอิสระช่วยกันการสวมรอย'),
    q('social', 'อีเมลคำขอเร่งด่วนส่งมานอกเวลางาน/วันหยุด ควรคิดอย่างไร?', 'รีบทำเพราะด่วน|ระวังมากขึ้น ผู้โจมตีชอบใช้ช่วงที่ตรวจสอบยาก', 2, 'นอกเวลางานคนยืนยันได้ยาก ผู้ร้ายจึงฉวยโอกาส'),
    q('social', 'การที่ผู้โจมตี "สร้างเรื่องราวให้น่าเชื่อ" เพื่อหลอกเอาข้อมูล เรียกว่าอะไร?', 'phishing เท่านั้น|pretexting (การปั้นเรื่องอ้างเหตุผล)', 2, 'pretexting คือการสร้างสถานการณ์ปลอมเพื่อให้เหยื่อร่วมมือ'),
    q('social', 'มีคนขอให้คุณ "ข้ามขั้นตอนปกติ" โดยอ้างว่าเป็นกรณีพิเศษเร่งด่วน ควร?', 'ช่วยข้ามให้เพราะสงสาร|ยึดขั้นตอน และยืนยันก่อน การข้ามขั้นตอนคือธงแดง', 2, 'การกดดันให้ข้ามกระบวนการตรวจสอบเป็นสัญญาณการหลอก'),
    q('social', 'เหตุใดข้อมูลพนักงาน (เบอร์/อีเมล/ตำแหน่ง) ที่เปิดเผยจึงควรระวัง?', 'ไม่สำคัญ ใคร ๆ ก็มี|เป็นวัตถุดิบให้ผู้โจมตีเจาะจงเป้าหมาย', 2, 'ข้อมูลเหล่านี้ช่วยให้การโจมตีแบบเจาะจง (spear phishing) แนบเนียน'),
    q('social', 'การล่อเหยื่อด้วยสิ่งที่อยากได้ (เช่น USB/ของรางวัล) เพื่อหลอก เรียกว่าอะไร?', 'tailgating|baiting (การวางเหยื่อล่อ)', 2, 'baiting อาศัยความอยากได้ของเหยื่อเป็นช่องทางโจมตี'),
    q('social', 'เมื่อรู้สึกว่ามีบางอย่างผิดปกติกับคำขอที่ได้รับ ควรทำอย่างไร?', 'ทำตามไปก่อนเพื่อไม่ให้เสียมารยาท|หยุด และตรวจสอบกับหัวหน้า/IT ก่อน', 2, 'สัญชาตญาณที่ผิดปกติคือเครื่องเตือน ให้หยุดตรวจสอบก่อน'),
    q('social', 'นโยบาย "no-shame" ในการรายงานเหตุความปลอดภัยหมายความว่าอย่างไร?', 'ใครพลาดจะถูกลงโทษ|รายงานได้โดยไม่ต้องอาย ยิ่งเร็วยิ่งลดความเสียหาย', 2, 'การรายงานเร็วสำคัญกว่าการกลัวผิด องค์กรจึงไม่ลงโทษผู้แจ้ง')
  ];
}

// Migration: เติม question/choices/correct/explain ให้แถวเดิมในชีต MailTopics
// ที่ seed ไว้ก่อนมีคอลัมน์ใหม่ (จะไม่เขียนทับแถวที่กรอกคำถามไว้แล้ว)
// รันครั้งเดียวจาก editor หลังวางโค้ดใหม่ แล้วลบทิ้งได้ถ้าต้องการ
function upgradeMailTopics() {
  setupDatabase(); // เพิ่มหัวคอลัมน์ใหม่ให้ก่อน
  const sheet = sheet_(SHEETS.mailTopics);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach(function (h, i) { col[h] = i; });

  const byTopic = {};
  topicSeed_().forEach(function (t) { byTopic[t.topic.toLowerCase().trim()] = t; });

  let updated = 0;
  for (let r = 1; r < data.length; r++) {
    const name = String(data[r][col.topic] || '').toLowerCase().trim();
    const seed = byTopic[name];
    if (!seed) continue;
    if (String(data[r][col.question] || '').trim()) continue; // มีคำถามแล้ว ไม่ทับ
    sheet.getRange(r + 1, col.question + 1).setValue(seed.question);
    sheet.getRange(r + 1, col.choices + 1).setValue(seed.choices);
    sheet.getRange(r + 1, col.correct + 1).setValue(seed.correct);
    sheet.getRange(r + 1, col.explain + 1).setValue(seed.explain);
    updated++;
  }
  logAction_('UPGRADE_MAIL_TOPICS', 'OK', 'updated=' + updated);
  Logger.log('upgradeMailTopics: updated ' + updated + ' row(s)');
  return { ok: true, updated: updated };
}

function updateLastLogin_(email) {
  if (!email) return;
  // throttle: ข้ามการอ่าน+เขียนชีต Customers ถ้าเพิ่งอัปเดต last_login ไปไม่นาน (เร็วขึ้นมากทุกการโหลด)
  const cache = CacheService.getScriptCache();
  const key = 'll_' + email;
  if (cache.get(key)) return;
  cache.put(key, '1', 1800); // 30 นาที
  const sheet = sheet_(SHEETS.customers);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailIndex = headers.indexOf('login_email');
  const lastLoginIndex = headers.indexOf('last_login');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][emailIndex]).toLowerCase() === email) {
      sheet.getRange(i + 1, lastLoginIndex + 1).setValue(new Date());
      return;
    }
  }
}

function logAction_(action, result, errorMessage) {
  const email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  let role = 'unknown';
  let customerId = '';
  try {
    const customers = rows_(SHEETS.customers);
    const customer = customers.filter(function (row) { return String(row.login_email).toLowerCase() === email; })[0];
    if (customer) {
      role = customer.role;
      customerId = customer.customer_id;
    }
  } catch (err) {
    role = 'unknown';
  }
  sheet_(SHEETS.logs).appendRow([new Date(), customerId, email, role, action, result, errorMessage || '']);
}

// บังคับให้ payload เป็น JSON ที่ปลอดภัยก่อนส่งข้ามไป client
// (กัน google.script.run คืน null เงียบ ๆ เมื่อมี Date เสีย/ค่าที่ serialize ไม่ได้)
// Date จะกลายเป็น string ISO ซึ่งฝั่ง client (formatDate) รองรับอยู่แล้ว
function jsonSafe_(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// cache การอ่านชีตชั่วคราว — เปิดเฉพาะระหว่าง getBootstrap (อ่านอย่างเดียว) เพื่อกันการอ่านชีตซ้ำ
// ปิด (null) เป็นค่าปริยาย เพื่อไม่ให้ฟังก์ชันที่มีการเขียนได้ค่าที่ค้าง (stale)
var _rowsCache = null;
function rows_(sheetName) {
  if (_rowsCache && Object.prototype.hasOwnProperty.call(_rowsCache, sheetName)) return _rowsCache[sheetName];
  const sheet = sheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  const out = [];
  if (values.length >= 2) {
    const headers = values[0];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (!row.some(function (cell) { return cell !== ''; })) continue;
      const item = {};
      headers.forEach(function (header, index) { item[header] = row[index]; });
      item.row_index = i + 1; // เลขแถวจริงในชีต (1-based) ไว้สำหรับแก้/ลบ
      out.push(item);
    }
  }
  if (_rowsCache) _rowsCache[sheetName] = out;
  return out;
}

function activeSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
}

// URL จริงของเว็บแอป (/exec) — hardcode deployment ที่เราใช้ตายตัว (ใช้ deployment id เดิมตลอด)
// เหตุผล: client รันใน iframe sandbox (googleusercontent.com) จึงใช้ location.href ไม่ได้
// และ ScriptApp.getService().getUrl() บางครั้งคืนค่าว่าง/URL ของ sandbox → ลิงก์ training เปิดไม่ได้
// (ขึ้นหน้า error ของ Google ไดรฟ์) จึง fix ค่านี้ไว้ให้ชัวร์
const WEBAPP_URL = CONFIG.webAppUrl;

// URL ของ deployment "เปิด public แบบไม่ต้องล็อกอิน" สำหรับหน้า training โดยเฉพาะ (มาจาก CONFIG)
// (deployment แยก: Execute as = Me, Who has access = Anyone — ตั้งใน Apps Script UI เพราะ clasp ตั้ง anonymous ไม่ได้)
// ปล่อยว่าง = fallback ใช้ deployment admin เดิม (พฤติกรรมเดิม ต้องล็อกอิน)
const TRAINING_WEBAPP_URL = CONFIG.trainingWebAppUrl;

function getAppUrl_() {
  // พอร์เทเบิล: ถ้าติดตั้งบนบัญชี/สคริปต์อื่น ใช้ URL /exec ของที่นั่นเองอัตโนมัติ
  // (รับเฉพาะ URL ที่เป็น /exec จริง เพื่อกันค่าว่าง/URL ของ sandbox ที่เคยทำลิงก์พัง)
  try {
    const u = ScriptApp.getService().getUrl();
    if (u && u.indexOf('/macros/') !== -1 && /\/exec$/.test(u)) return u;
  } catch (e) {}
  return WEBAPP_URL || ''; // fallback: ค่าที่ pin ไว้ของ deployment นี้
}

// URL สำหรับสร้างลิงก์หน้า training — ใช้ deployment anonymous ถ้าตั้งไว้, ไม่งั้น fallback เป็น admin app
function getTrainingUrl_() {
  return TRAINING_WEBAPP_URL || getAppUrl_();
}

// หา/สร้างชีตแบบทนทาน — กันกรณีชื่อชีตจริงมีช่องว่างหัวท้ายหรือพิมพ์เล็ก/ใหญ่ต่างกัน
// (getSheetByName เทียบแบบเป๊ะ แต่ insertSheet กลับมองว่า "ชื่อซ้ำ" → เคยทำให้ setupDatabase ล้ม)
// ถ้าเจอตัวที่เพี้ยน จะ rename กลับเป็นชื่อ canonical เพื่อให้โค้ดส่วนอื่นที่ใช้ชื่อเป๊ะทำงานได้
function getOrCreateSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  const want = String(name).trim().toLowerCase();
  const match = function () {
    const all = ss.getSheets();
    for (let i = 0; i < all.length; i++) {
      if (String(all[i].getName()).trim().toLowerCase() === want) {
        if (all[i].getName() !== name) all[i].setName(name);
        return all[i];
      }
    }
    return null;
  };
  sheet = match();
  if (sheet) return sheet;
  try {
    return ss.insertSheet(name);
  } catch (e) {
    sheet = ss.getSheetByName(name) || match();
    if (sheet) return sheet;
    throw e;
  }
}

// อีเมลเจ้าของชีต (cache ไว้) — ใช้เลื่อนเป็น admin อัตโนมัติ
function ownerEmail_() {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get('owner_email');
    if (cached) return cached;
    const owner = activeSpreadsheet_().getOwner();
    const email = owner ? String(owner.getEmail() || '').toLowerCase() : '';
    if (email) cache.put('owner_email', email, 21600);
    return email;
  } catch (e) {
    return '';
  }
}

// อีเมลผู้พัฒนา-admin หลัก: ใช้ค่าใน CONFIG ถ้าตั้งไว้, ไม่งั้นใช้เจ้าของชีตอัตโนมัติ
// (ทำให้ "ก๊อปไปลงบัญชีไหน บัญชีนั้นเป็น admin + ชื่อผู้พัฒนา" โดยไม่ต้องแก้โค้ด)
function developerEmail_() {
  return (CONFIG.developerEmail || ownerEmail_() || '').toLowerCase();
}

function sheet_(name) {
  const ss = activeSpreadsheet_();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Missing sheet: ' + name);
  return sheet;
}

function getSettingValue_(key, fallback) {
  const row = rows_(SHEETS.settings).filter(function (item) { return item.key === key; })[0];
  return row ? row.value : fallback;
}

function parseEmailText_(text) {
  const seen = {};
  return text.split(/\r?\n|,|;/).map(function (line) {
    const parts = String(line).trim().split(/\s+/);
    return { email: (parts[0] || '').trim(), description: parts.slice(1).join(' ') };
  }).filter(function (item) {
    if (!item.email) return false;
    const key = item.email.toLowerCase();
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function splitCsv_(value) {
  return String(value || '').split(',').map(function (item) {
    return item.trim().toLowerCase();
  }).filter(Boolean);
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function shuffle_(items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

function randomInt_(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function ping() {
  setupDatabase();
  const user = getCurrentUser_();
  const result = {
    ok: true,
    time: new Date(),
    email: user.email || '(no visible email)',
    role: user.role,
    customer_id: user.customer_id
  };
  Logger.log(JSON.stringify(result));
  return result;
}
