const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_PATH = path.join(__dirname, 'data', 'app.db');

const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    period_start TEXT,
    period_end TEXT,
    priority TEXT,
    success_criteria TEXT,
    estimated_hours REAL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    title TEXT NOT NULL,
    due_date TEXT,
    priority TEXT,
    tag TEXT,
    estimated_hours REAL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS plan_history (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    before_json TEXT NOT NULL,
    after_json TEXT NOT NULL,
    changed_at TEXT NOT NULL,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS todo_executions (
    id TEXT PRIMARY KEY,
    todo_id TEXT NOT NULL,
    exec_date TEXT NOT NULL,
    executed_at TEXT NOT NULL,
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
    UNIQUE (todo_id, exec_date)
  );

  CREATE TABLE IF NOT EXISTS retrospectives (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL UNIQUE,
    note TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
  );
`);

// ---- 자격증 일정 (고정 데이터) ----
// category: apply(원서접수) / written(필기시험) / practical(실기시험) / result(합격발표)
const CERT_EVENTS = [
  { cert: '네트워크관리사 2급', type: '필기접수', category: 'apply', start: '2026-09-29', end: '2026-10-02' },
  { cert: '네트워크관리사 2급', type: '필기시험', category: 'written', start: '2026-11-01', end: '2026-11-01' },
  { cert: '네트워크관리사 2급', type: '필기발표', category: 'result', start: '2026-11-03', end: '2026-11-03' },
  { cert: '네트워크관리사 2급', type: '실기접수', category: 'apply', start: '2026-11-03', end: '2026-11-06' },
  { cert: '네트워크관리사 2급', type: '실기시험', category: 'practical', start: '2026-12-06', end: '2026-12-06' },
  { cert: '네트워크관리사 2급', type: '실기발표', category: 'result', start: '2026-12-15', end: '2026-12-15' },

  { cert: '리눅스마스터 2급', type: '필기접수', category: 'apply', start: '2026-10-05', end: '2026-10-16' },
  { cert: '리눅스마스터 2급', type: '필기시험', category: 'written', start: '2026-10-31', end: '2026-10-31' },
  { cert: '리눅스마스터 2급', type: '필기발표', category: 'result', start: '2026-11-04', end: '2026-11-04' },
  { cert: '리눅스마스터 2급', type: '실기접수', category: 'apply', start: '2026-10-27', end: '2026-11-06' },
  { cert: '리눅스마스터 2급', type: '실기시험', category: 'practical', start: '2026-12-12', end: '2026-12-12' },
  { cert: '리눅스마스터 2급', type: '실기발표', category: 'result', start: '2026-12-31', end: '2026-12-31' },

  { cert: '정보보안산업기사 (제4회)', type: '필기접수', category: 'apply', start: '2026-08-31', end: '2026-09-03' },
  { cert: '정보보안산업기사 (제4회)', type: '필기시험', category: 'written', start: '2026-09-14', end: '2026-10-08' },
  { cert: '정보보안산업기사 (제4회)', type: '필기발표', category: 'result', start: '2026-10-16', end: '2026-10-16' },
  { cert: '정보보안산업기사 (제4회)', type: '실기접수', category: 'apply', start: '2026-10-19', end: '2026-10-22' },
  { cert: '정보보안산업기사 (제4회)', type: '실기시험', category: 'practical', start: '2026-11-14', end: '2026-11-14' },
  { cert: '정보보안산업기사 (제4회)', type: '실기발표', category: 'result', start: '2026-12-18', end: '2026-12-18' },
];

const CATEGORY_LABEL = { apply: '원서접수', written: '필기시험', practical: '실기시험', result: '합격발표' };

function expandEventsByDate(events) {
  const byDate = {};
  for (const ev of events) {
    let d = new Date(ev.start);
    const end = new Date(ev.end);
    while (d <= end) {
      const key = d.toISOString().slice(0, 10);
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push({ id: ev.id, source: ev.source, cert: ev.cert, type: ev.type, category: ev.category });
      d.setDate(d.getDate() + 1);
    }
  }
  return byDate;
}

function getAllEvents() {
  const staticEvents = CERT_EVENTS.map((ev, i) => ({ ...ev, id: 'static-' + i, source: 'static' }));
  const customRows = db.prepare('SELECT * FROM events ORDER BY start_date ASC').all();
  const customEvents = customRows.map((row) => ({
    id: row.id,
    source: 'custom',
    cert: row.title,
    type: CATEGORY_LABEL[row.category] || row.category,
    category: row.category,
    start: row.start_date,
    end: row.end_date,
  }));
  return [...staticEvents, ...customEvents];
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function rowToPlan(row) {
  return row;
}

function isBefore(a, b) {
  return new Date(a) < new Date(b);
}

function seoulToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

function isOutsideRange(date, start, end) {
  if (!date) return false;
  if (start && isBefore(date, start)) return true;
  if (end && isBefore(end, date)) return true;
  return false;
}

const PLAN_REQUIRED_FIELDS = [
  ['title', '제목'],
  ['period_start', '시작일'],
  ['period_end', '종료일'],
  ['priority', '우선순위'],
  ['estimated_hours', '예상 시간'],
  ['success_criteria', '성공 기준'],
];

const TODO_REQUIRED_FIELDS = [
  ['title', '할 일 제목'],
  ['due_date', '마감일'],
  ['priority', '우선순위'],
  ['tag', '태그'],
  ['estimated_hours', '예상 시간'],
];

function validateTodoBody(body, plan) {
  const missing = TODO_REQUIRED_FIELDS
    .filter(([key]) => body[key] === undefined || body[key] === null || String(body[key]).trim() === '')
    .map(([, label]) => label);
  if (missing.length) {
    return `다음 항목을 입력해주세요: ${missing.join(', ')}`;
  }
  if (isBefore(body.due_date, seoulToday())) {
    return '마감일은 오늘보다 이전일 수 없습니다.';
  }
  if (isOutsideRange(body.due_date, plan.period_start, plan.period_end)) {
    return '마감일은 계획 기간 안에서 정해야 합니다.';
  }
  return null;
}

function validatePlanBody(body) {
  const missing = PLAN_REQUIRED_FIELDS
    .filter(([key]) => body[key] === undefined || body[key] === null || String(body[key]).trim() === '')
    .map(([, label]) => label);
  if (missing.length) {
    return `다음 항목을 입력해주세요: ${missing.join(', ')}`;
  }
  const today = seoulToday();
  if (isBefore(body.period_start, today)) {
    return '시작일은 오늘보다 이전일 수 없습니다.';
  }
  if (isBefore(body.period_end, today)) {
    return '종료일은 오늘보다 이전일 수 없습니다.';
  }
  if (isBefore(body.period_end, body.period_start)) {
    return '종료일은 시작일보다 빠를 수 없습니다.';
  }
  return null;
}

function serveStatic(req, res, pathname) {
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;
  const method = req.method;

  try {
    let m;

    // ---- 자격증 일정 (고정 + 사용자 추가) ----
    if (pathname === '/api/certs' && method === 'GET') {
      const all = getAllEvents();
      return send(res, 200, { events: all, byDate: expandEventsByDate(all) });
    }

    // ---- 사용자가 직접 추가한 일정 ----
    if (pathname === '/api/events' && method === 'POST') {
      const body = await readBody(req);
      const title = body.title ? String(body.title).trim() : '';
      const start = body.start_date;
      const end = body.end_date || body.start_date;
      const category = body.category;
      if (!title) return send(res, 400, { error: '일정 이름은 필수입니다.' });
      if (!start) return send(res, 400, { error: '시작일은 필수입니다.' });
      if (!CATEGORY_LABEL[category]) return send(res, 400, { error: '유형이 올바르지 않습니다.' });
      if (new Date(end) < new Date(start)) return send(res, 400, { error: '종료일은 시작일보다 빠를 수 없습니다.' });

      const id = randomUUID();
      const created_at = new Date().toISOString();
      db.prepare(
        `INSERT INTO events (id, title, category, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(id, title, category, start, end, created_at);
      return send(res, 201, { id, title, category, start_date: start, end_date: end, created_at });
    }

    m = pathname.match(/^\/api\/events\/([^/]+)$/);
    if (m && method === 'DELETE') {
      db.prepare('DELETE FROM events WHERE id = ?').run(m[1]);
      return send(res, 204, {});
    }

    // ---- 계획 목록 / 생성 ----
    if (pathname === '/api/plans' && method === 'GET') {
      const rows = db.prepare('SELECT * FROM plans ORDER BY created_at DESC').all();
      return send(res, 200, rows.map(rowToPlan));
    }

    if (pathname === '/api/plans' && method === 'POST') {
      const body = await readBody(req);
      const validationError = validatePlanBody(body);
      if (validationError) return send(res, 400, { error: validationError });
      const id = randomUUID();
      const created_at = new Date().toISOString();
      db.prepare(
        `INSERT INTO plans (id, title, period_start, period_end, priority, success_criteria, estimated_hours, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        String(body.title).trim(),
        body.period_start || null,
        body.period_end || null,
        body.priority || null,
        body.success_criteria || null,
        body.estimated_hours != null ? Number(body.estimated_hours) : null,
        created_at
      );
      const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
      return send(res, 201, row);
    }

    // ---- 계획 단건 수정 / 삭제 ----
    m = pathname.match(/^\/api\/plans\/([^/]+)$/);
    if (m && method === 'PUT') {
      const id = m[1];
      const existing = db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
      if (!existing) return send(res, 404, { error: '계획을 찾을 수 없습니다.' });
      const body = await readBody(req);
      const validationError = validatePlanBody(body);
      if (validationError) return send(res, 400, { error: validationError });
      const nextValues = {
        title: String(body.title).trim(),
        period_start: body.period_start || null,
        period_end: body.period_end || null,
        priority: body.priority || null,
        success_criteria: body.success_criteria || null,
        estimated_hours: body.estimated_hours != null ? Number(body.estimated_hours) : null,
      };
      const changed = Object.keys(nextValues).some((k) => String(existing[k] ?? '') !== String(nextValues[k] ?? ''));
      db.prepare(
        `UPDATE plans SET title=?, period_start=?, period_end=?, priority=?, success_criteria=?, estimated_hours=? WHERE id=?`
      ).run(
        nextValues.title,
        nextValues.period_start,
        nextValues.period_end,
        nextValues.priority,
        nextValues.success_criteria,
        nextValues.estimated_hours,
        id
      );
      if (changed) {
        const before = {
          title: existing.title, period_start: existing.period_start, period_end: existing.period_end,
          priority: existing.priority, success_criteria: existing.success_criteria, estimated_hours: existing.estimated_hours,
        };
        db.prepare(
          `INSERT INTO plan_history (id, plan_id, before_json, after_json, changed_at) VALUES (?, ?, ?, ?, ?)`
        ).run(randomUUID(), id, JSON.stringify(before), JSON.stringify(nextValues), new Date().toISOString());
      }
      const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
      return send(res, 200, row);
    }

    if (m && method === 'DELETE') {
      const id = m[1];
      db.prepare('DELETE FROM todos WHERE plan_id = ?').run(id);
      db.prepare('DELETE FROM plans WHERE id = ?').run(id);
      return send(res, 204, {});
    }

    // ---- 할 일 목록 / 생성 (특정 계획에 속함) ----
    m = pathname.match(/^\/api\/plans\/([^/]+)\/todos$/);
    if (m && method === 'GET') {
      const planId = m[1];
      const rows = db.prepare('SELECT * FROM todos WHERE plan_id = ? ORDER BY created_at ASC').all(planId);
      return send(res, 200, rows);
    }

    if (m && method === 'POST') {
      const planId = m[1];
      const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
      if (!plan) return send(res, 404, { error: '계획을 찾을 수 없습니다.' });
      const body = await readBody(req);
      const validationError = validateTodoBody(body, plan);
      if (validationError) return send(res, 400, { error: validationError });
      const id = randomUUID();
      const created_at = new Date().toISOString();
      db.prepare(
        `INSERT INTO todos (id, plan_id, title, due_date, priority, tag, estimated_hours, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
      ).run(
        id,
        planId,
        String(body.title).trim(),
        body.due_date || null,
        body.priority || null,
        body.tag || null,
        body.estimated_hours != null ? Number(body.estimated_hours) : null,
        created_at
      );
      const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
      return send(res, 201, row);
    }

    // ---- 할 일 단건 수정 / 삭제 ----
    m = pathname.match(/^\/api\/todos\/([^/]+)$/);
    if (m && method === 'PUT') {
      const id = m[1];
      const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
      if (!existing) return send(res, 404, { error: '할 일을 찾을 수 없습니다.' });
      const body = await readBody(req);
      const next = {
        title: body.title != null ? String(body.title).trim() : existing.title,
        due_date: body.due_date !== undefined ? body.due_date : existing.due_date,
        priority: body.priority !== undefined ? body.priority : existing.priority,
        tag: body.tag !== undefined ? body.tag : existing.tag,
        estimated_hours: body.estimated_hours !== undefined
          ? (body.estimated_hours != null ? Number(body.estimated_hours) : null)
          : existing.estimated_hours,
        status: body.status !== undefined ? body.status : existing.status,
      };
      const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(existing.plan_id);
      if (plan && isOutsideRange(next.due_date, plan.period_start, plan.period_end)) {
        return send(res, 400, { error: '마감일은 계획 기간 안에서 정해야 합니다.' });
      }
      db.prepare(
        `UPDATE todos SET title=?, due_date=?, priority=?, tag=?, estimated_hours=?, status=? WHERE id=?`
      ).run(next.title, next.due_date, next.priority, next.tag, next.estimated_hours, next.status, id);
      const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
      return send(res, 200, row);
    }

    if (m && method === 'DELETE') {
      const id = m[1];
      db.prepare('DELETE FROM todos WHERE id = ?').run(id);
      return send(res, 204, {});
    }

    // ---- 계획 수정 이력 ----
    m = pathname.match(/^\/api\/plans\/([^/]+)\/history$/);
    if (m && method === 'GET') {
      const rows = db.prepare('SELECT * FROM plan_history WHERE plan_id = ? ORDER BY changed_at DESC').all(m[1]);
      return send(res, 200, rows.map((r) => ({
        id: r.id,
        changed_at: r.changed_at,
        before: JSON.parse(r.before_json),
        after: JSON.parse(r.after_json),
      })));
    }

    // ---- 할 일 실행 기록 (체크인) ----
    // 같은 날짜에 여러 번 요청해도 UNIQUE(todo_id, exec_date) 제약으로 1건만 기록됨 (idempotent)
    m = pathname.match(/^\/api\/todos\/([^/]+)\/executions$/);
    if (m && method === 'POST') {
      const todoId = m[1];
      const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(todoId);
      if (!todo) return send(res, 404, { error: '할 일을 찾을 수 없습니다.' });
      const execDate = seoulToday();
      db.prepare(
        `INSERT INTO todo_executions (id, todo_id, exec_date, executed_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(todo_id, exec_date) DO NOTHING`
      ).run(randomUUID(), todoId, execDate, new Date().toISOString());
      const rows = db.prepare('SELECT * FROM todo_executions WHERE todo_id = ? ORDER BY exec_date DESC').all(todoId);
      return send(res, 200, { exec_date: execDate, count: rows.length, executions: rows });
    }

    if (m && method === 'GET') {
      const rows = db.prepare('SELECT * FROM todo_executions WHERE todo_id = ? ORDER BY exec_date DESC').all(m[1]);
      return send(res, 200, rows);
    }

    // ---- 전체 실행 기록 (집계 화면 근거 조회용) ----
    if (pathname === '/api/executions' && method === 'GET') {
      const rows = db.prepare(`
        SELECT te.id, te.todo_id, te.exec_date, te.executed_at, t.title AS todo_title, t.plan_id, p.title AS plan_title
        FROM todo_executions te
        JOIN todos t ON t.id = te.todo_id
        JOIN plans p ON p.id = t.plan_id
        ORDER BY te.executed_at DESC
      `).all();
      return send(res, 200, rows);
    }

    // ---- 돌아보기 메모 ----
    m = pathname.match(/^\/api\/plans\/([^/]+)\/retrospective$/);
    if (m && method === 'GET') {
      const row = db.prepare('SELECT * FROM retrospectives WHERE plan_id = ?').get(m[1]);
      return send(res, 200, row || null);
    }

    if (m && method === 'PUT') {
      const planId = m[1];
      const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
      if (!plan) return send(res, 404, { error: '계획을 찾을 수 없습니다.' });
      const body = await readBody(req);
      const note = body.note != null ? String(body.note) : '';
      const now = new Date().toISOString();
      const existing = db.prepare('SELECT * FROM retrospectives WHERE plan_id = ?').get(planId);
      if (existing) {
        db.prepare('UPDATE retrospectives SET note=?, updated_at=? WHERE plan_id=?').run(note, now, planId);
      } else {
        db.prepare(
          'INSERT INTO retrospectives (id, plan_id, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        ).run(randomUUID(), planId, note, now, now);
      }
      const row = db.prepare('SELECT * FROM retrospectives WHERE plan_id = ?').get(planId);
      return send(res, 200, row);
    }

    // ---- 집계 ----
    if (pathname === '/api/stats' && method === 'GET') {
      const planCount = db.prepare('SELECT COUNT(*) AS n FROM plans').get().n;
      const todoCount = db.prepare('SELECT COUNT(*) AS n FROM todos').get().n;
      const doneCount = db.prepare("SELECT COUNT(*) AS n FROM todos WHERE status = 'done'").get().n;
      const execCount = db.prepare('SELECT COUNT(*) AS n FROM todo_executions').get().n;
      const historyCount = db.prepare('SELECT COUNT(*) AS n FROM plan_history').get().n;
      return send(res, 200, {
        plan_count: planCount,
        todo_count: todoCount,
        done_count: doneCount,
        completion_rate: todoCount ? Math.round((doneCount / todoCount) * 100) : 0,
        execution_count: execCount,
        history_count: historyCount,
      });
    }

    // ---- 전체 데이터 내보내기 ----
    if (pathname === '/api/export' && method === 'GET') {
      const data = {
        exported_at: new Date().toISOString(),
        plans: db.prepare('SELECT * FROM plans ORDER BY created_at ASC').all(),
        todos: db.prepare('SELECT * FROM todos ORDER BY created_at ASC').all(),
        events: db.prepare('SELECT * FROM events ORDER BY start_date ASC').all(),
        plan_history: db.prepare('SELECT * FROM plan_history ORDER BY changed_at ASC').all(),
        todo_executions: db.prepare('SELECT * FROM todo_executions ORDER BY executed_at ASC').all(),
        retrospectives: db.prepare('SELECT * FROM retrospectives ORDER BY updated_at ASC').all(),
      };
      const json = JSON.stringify(data, null, 2);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="plan-do-see-export.json"',
        'Content-Length': Buffer.byteLength(json),
      });
      return res.end(json);
    }

    if (pathname.startsWith('/api/')) {
      return send(res, 404, { error: 'Not found' });
    }

    // ---- 정적 파일 ----
    serveStatic(req, res, pathname);
  } catch (err) {
    console.error(err);
    send(res, 500, { error: '서버 오류' });
  }
});

server.listen(PORT, () => {
  console.log(`플랜두씨 다이어리 서버 실행 중: http://localhost:${PORT}`);
});
