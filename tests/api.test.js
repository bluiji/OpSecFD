// Run: npm test   (uses node:test, no extra dependencies)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { __setClientFactory } from '../api/_lib/supabase.js';
import lessons from '../api/admin/lessons.js';
import users, { buildRoster } from '../api/admin/users.js';
import config from '../api/config.js';
import { validateLesson, validateQuiz } from '../api/_lib/validate.js';

process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
process.env.SUPABASE_ANON_KEY = 'anon';

// ---- tiny fake Supabase client -------------------------------------------
const ADMIN = '22222222-2222-2222-2222-222222222222';
const STUDENT = '11111111-1111-1111-1111-111111111111';
function fakeDb(state) {
  const calls = [];
  const builder = (table) => {
    const q = { table, op: 'select', filters: {}, payload: null };
    const exec = () => {
      calls.push(q);
      const rows = state[table] || [];
      const match = rows.filter((r) => Object.entries(q.filters).every(([k, v]) => r[k] === v));
      if (q.op === 'insert') return { data: { id: 99, ...q.payload }, error: null };
      if (q.op === 'update') return { data: match[0] ? { ...match[0], ...q.payload } : null, error: null };
      if (q.op === 'delete') return { data: match[0] ? { id: match[0].id } : null, error: null };
      if (q.head) return { count: rows.length, error: null };
      return { data: match, error: null };
    };
    const api = {
      select(_c, opts) { if (opts?.head) q.head = true; return api; },
      insert(p) { q.op = 'insert'; q.payload = p; return api; },
      update(p) { q.op = 'update'; q.payload = p; return api; },
      delete() { q.op = 'delete'; return api; },
      eq(k, v) { q.filters[k] = v; return api; },
      range() { return api; },
      single() { const r = exec(); return Promise.resolve({ ...r, data: Array.isArray(r.data) ? r.data[0] : r.data }); },
      maybeSingle() { return api.single(); },
      then(res, rej) { return Promise.resolve(exec()).then(res, rej); }
    };
    return api;
  };
  return {
    calls,
    auth: {
      async getUser(token) {
        if (token === 'admin-token') return { data: { user: { id: ADMIN } }, error: null };
        if (token === 'student-token') return { data: { user: { id: STUDENT } }, error: null };
        return { data: { user: null }, error: { message: 'bad jwt' } };
      }
    },
    from: builder
  };
}

function mockRes() {
  return {
    statusCode: 0, headers: {}, body: undefined,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    send(b) { this.body = JSON.parse(b); return this; },
    json(b) { this.body = b; return this; }
  };
}

const goodQuiz = [0, 1, 2].map((i) => ({ question: `Q${i}`, options: ['a', 'b'], answer: 1, explanation: 'why' }));
const goodLesson = {
  module_id: 1, lesson_order: 7, title: 'T', what_is_it: 'a', why_it_matters: 'b', how_it_works: 'c',
  real_world_scenario: 'd', how_to_protect: 'e', quiz_json: goodQuiz
};

function setup() {
  const db = fakeDb({
    profiles: [
      { id: ADMIN, role: 'admin', username: 'adm', email: 'a@x' },
      { id: STUDENT, role: 'student', username: 'stu', email: 's@x' }
    ],
    modules: [{ id: 1 }],
    lessons: [{ id: 5 }, { id: 6 }],
    user_progress: [
      { user_id: STUDENT, completed: true, quiz_score: 80 },
      { user_id: STUDENT, completed: false, quiz_score: 40 }
    ]
  });
  __setClientFactory(() => db);
  return db;
}

// ---- tests ------------------------------------------------------------------
test('config returns public keys only', () => {
  const res = mockRes();
  config({ method: 'GET' }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(Object.keys(res.body).sort(), ['supabaseAnonKey', 'supabaseUrl']);
  assert.ok(!JSON.stringify(res.body).includes('service'));
});

test('lessons: rejects missing token, bad token, and non-admins', async () => {
  setup();
  for (const [auth, code] of [[undefined, 401], ['Bearer nope', 401], ['Bearer student-token', 403]]) {
    const res = mockRes();
    await lessons({ method: 'POST', headers: auth ? { authorization: auth } : {}, body: goodLesson }, res);
    assert.equal(res.statusCode, code, `auth=${auth}`);
  }
});

test('lessons: admin can create, update, delete', async () => {
  const db = setup();
  const h = { authorization: 'Bearer admin-token' };
  let res = mockRes();
  await lessons({ method: 'POST', headers: h, body: goodLesson }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.lesson.title, 'T');

  res = mockRes();
  await lessons({ method: 'PUT', headers: h, body: { id: 5, title: 'New' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(db.calls.at(-1).payload.title, 'New');

  res = mockRes();
  await lessons({ method: 'DELETE', headers: h, query: { id: '6' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.deleted, 6);

  res = mockRes();
  await lessons({ method: 'DELETE', headers: h, query: { id: '404' } }, res);
  assert.equal(res.statusCode, 404);
});

test('lessons: validation errors return 400; wrong method 405', async () => {
  setup();
  const h = { authorization: 'Bearer admin-token' };
  let res = mockRes();
  await lessons({ method: 'POST', headers: h, body: { ...goodLesson, quiz_json: goodQuiz.slice(0, 2) } }, res);
  assert.equal(res.statusCode, 400);
  res = mockRes();
  await lessons({ method: 'GET', headers: h }, res);
  assert.equal(res.statusCode, 405);
});

test('users: roster aggregation and role update rules', async () => {
  setup();
  const h = { authorization: 'Bearer admin-token' };
  let res = mockRes();
  await users({ method: 'GET', headers: h }, res);
  assert.equal(res.statusCode, 200);
  const stu = res.body.users.find((u) => u.id === STUDENT);
  assert.equal(stu.lessons_completed, 1);
  assert.equal(stu.completion_pct, 50); // 1 of 2 lessons
  assert.equal(stu.avg_quiz_score, 60); // (80+40)/2

  res = mockRes();
  await users({ method: 'PATCH', headers: h, body: { user_id: ADMIN, role: 'student' } }, res);
  assert.equal(res.statusCode, 400, 'cannot demote self');

  res = mockRes();
  await users({ method: 'PATCH', headers: h, body: { user_id: STUDENT, role: 'admin' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.role, 'admin');

  res = mockRes();
  await users({ method: 'PATCH', headers: h, body: { user_id: STUDENT, role: 'root' } }, res);
  assert.equal(res.statusCode, 400);
});

test('validators', () => {
  assert.doesNotThrow(() => validateLesson(goodLesson));
  assert.throws(() => validateQuiz([{ question: 'q', options: ['a', 'b'], answer: 5, explanation: 'x' }]));
  assert.throws(() => validateLesson({ title: '' }, { partial: true }));
  assert.deepEqual(buildRoster([{ id: 'x' }], [], 0)[0].completion_pct, 0);
});
