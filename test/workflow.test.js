import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { db, reset } from '../server/db.js';
import { app } from '../server/index.js';

let server;
let base;
const sessions = {};

async function api(path, options = {}, role = 'farmer') {
  const headers = { 'Content-Type': 'application/json' };
  if (sessions[role]) headers.Cookie = sessions[role];
  const response = await fetch(`${base}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const body = await response.json();
  return { response, body };
}

before(async () => { reset(); server = app.listen(0); await new Promise((resolve) => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}/api`; });
after(() => server.close());

test('complete farmer to payment workflow is persisted and role protected', async () => {
  let result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'demo.farmer@example.com', password: 'demo123' }) });
  assert.equal(result.response.status, 200); sessions.farmer = result.response.headers.get('set-cookie').split(';')[0];
  result = await api('/farmer/dashboard', {}, 'farmer'); assert.equal(result.response.status, 200); assert.equal(result.body.booking.token, 'KRS-1048');

  result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'demo.operator@example.com', password: 'demo123' }) });
  sessions.operator = result.response.headers.get('set-cookie').split(';')[0];
  result = await api('/admin/analytics', {}, 'farmer'); assert.equal(result.response.status, 403);
  result = await api('/operator/bookings/1/check-in', { method: 'POST' }, 'operator'); assert.equal(result.response.status, 200); assert.equal(result.body.booking.status, 'CHECKED_IN');
  result = await api('/operator/call-next', { method: 'POST' }, 'operator'); assert.equal(result.response.status, 200); assert.equal(result.body.booking.status, 'CALLED');
  result = await api('/operator/bookings/1/advance', { method: 'POST', body: JSON.stringify({ qualityStatus: 'PASSED' }) }, 'operator'); assert.equal(result.body.booking.status, 'PROCESSING');
  result = await api('/operator/bookings/1/advance', { method: 'POST', body: JSON.stringify({ actualQuantity: 47.6, qualityStatus: 'PASSED' }) }, 'operator'); assert.equal(result.body.booking.status, 'COMPLETED'); assert.equal(result.body.booking.amount, 95200);
  result = await api('/operator/payments/1/complete', { method: 'POST' }, 'operator'); assert.equal(result.response.status, 200); assert.equal(result.body.payment.status, 'COMPLETED');
  result = await api('/farmer/dashboard', {}, 'farmer'); assert.equal(result.body.booking.status, 'COMPLETED'); assert.equal(result.body.booking.payment_status, 'COMPLETED'); assert.ok(result.body.notifications.length >= 3);
  assert.ok(db.prepare('SELECT COUNT(*) count FROM audit_logs').get().count >= 5);
});

test('registration and duplicate booking protection work', async () => {
  let result = await api('/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Test Farmer', email: 'test@example.com', password: 'secret123', mobile: '9000000010', state: 'Maharashtra', district: 'Nashik', village: 'Demo Village' }) });
  assert.equal(result.response.status, 201); assert.ok(result.body.id);
  result = await api('/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Test Farmer', email: 'test@example.com', password: 'secret123', mobile: '9000000010', state: 'Maharashtra', district: 'Nashik', village: 'Demo Village' }) });
  assert.equal(result.response.status, 409);
  result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'test@example.com', password: 'secret123' }) });
  sessions.newFarmer = result.response.headers.get('set-cookie').split(';')[0];
  result = await api('/centres', {}, 'newFarmer'); const centreId = result.body.centres[0].id;
  result = await api(`/slots?centreId=${centreId}&date=2026-09-12`, {}, 'newFarmer'); const slotId = result.body.slots.find((slot) => slot.available > 0).id;
  result = await api('/bookings', { method: 'POST', body: JSON.stringify({ centreId, cropId: 1, slotId, quantity: 12 }) }, 'newFarmer');
  assert.equal(result.response.status, 201); assert.match(result.body.booking.token, /^KRS-/);
  result = await api('/bookings', { method: 'POST', body: JSON.stringify({ centreId, cropId: 1, slotId, quantity: 12 }) }, 'newFarmer');
  assert.equal(result.response.status, 409);
});
