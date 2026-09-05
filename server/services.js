import crypto from 'node:crypto';
import { db } from './db.js';

const transitions = {
  BOOKED: ['CHECKED_IN', 'CANCELLED'], CHECKED_IN: ['WAITING', 'CANCELLED'], WAITING: ['CALLED', 'NO_SHOW', 'CANCELLED'],
  CALLED: ['PROCESSING', 'SKIPPED'], PROCESSING: ['COMPLETED'], COMPLETED: [], SKIPPED: [], NO_SHOW: [], CANCELLED: []
};

export function notify(userId, title, message) { db.prepare('INSERT INTO notifications (user_id,title,message) VALUES (?,?,?)').run(userId, title, message); }
export function audit(userId, action, resource, resourceId, oldValue, newValue) { db.prepare('INSERT INTO audit_logs (user_id,action,resource,resource_id,old_value,new_value) VALUES (?,?,?,?,?,?)').run(userId, action, resource, resourceId, oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null); }
export function nextToken() { const row = db.prepare("SELECT token FROM bookings WHERE token LIKE 'KRS-%' ORDER BY id DESC LIMIT 1").get(); const number = row ? Number(row.token.slice(4)) + 1 : 1001; return `KRS-${number}`; }
export function recalculateQueue(centreId) {
  const rows = db.prepare(`SELECT b.id,b.farmer_id,b.status,c.average_processing_minutes,c.active_counters FROM bookings b JOIN centres c ON c.id=b.centre_id WHERE b.centre_id=? AND b.status IN ('BOOKED','CHECKED_IN','WAITING','CALLED','PROCESSING') ORDER BY b.created_at,b.id`).all(centreId);
  const update = db.prepare('UPDATE queue_entries SET position=?,estimated_wait_minutes=? WHERE booking_id=?');
  rows.forEach((row, index) => update.run(index + 1, Math.max(0, index * row.average_processing_minutes / row.active_counters), row.id));
  return rows;
}
export function bookingView(id) {
  return db.prepare(`SELECT b.*, u.name farmer_name, u.email farmer_email, c.name centre_name, c.district, c.state, cr.name crop_name,
    s.slot_date,s.start_time,s.end_time,q.position,q.estimated_wait_minutes,q.status queue_status,
    p.stage,p.quality_status,p.actual_quantity,p.completed_at procurement_completed_at, pay.amount,pay.status payment_status,pay.transaction_ref
    FROM bookings b JOIN users u ON u.id=b.farmer_id JOIN centres c ON c.id=b.centre_id JOIN crops cr ON cr.id=b.crop_id JOIN slots s ON s.id=b.slot_id
    JOIN queue_entries q ON q.booking_id=b.id JOIN procurements p ON p.booking_id=b.id JOIN payments pay ON pay.booking_id=b.id WHERE b.id=?`).get(id);
}
export const createBooking = db.transaction(({ farmerId, centreId, cropId, slotId, quantity, quantityUnit = 'quintals', actorId }) => {
  const slot = db.prepare('SELECT s.*, c.daily_capacity FROM slots s JOIN centres c ON c.id=s.centre_id WHERE s.id=? AND s.centre_id=?').get(slotId, centreId);
  if (!slot) throw Object.assign(new Error('Selected slot does not exist.'), { status: 400 });
  const booked = db.prepare("SELECT COUNT(*) count FROM bookings WHERE slot_id=? AND status NOT IN ('CANCELLED','NO_SHOW')").get(slotId).count;
  if (booked >= slot.capacity) throw Object.assign(new Error('Sorry, this slot is no longer available.'), { status: 409 });
  const total = db.prepare("SELECT COUNT(*) count FROM bookings WHERE centre_id=? AND status NOT IN ('CANCELLED','NO_SHOW','COMPLETED')").get(centreId).count;
  if (total >= slot.daily_capacity) throw Object.assign(new Error('This centre has reached its daily capacity.'), { status: 409 });
  const duplicate = db.prepare("SELECT id FROM bookings WHERE farmer_id=? AND slot_id=? AND status NOT IN ('CANCELLED','NO_SHOW')").get(farmerId, slotId);
  if (duplicate) throw Object.assign(new Error('You already have a booking for this slot.'), { status: 409 });
  const token = nextToken();
  const id = db.prepare('INSERT INTO bookings (farmer_id,centre_id,crop_id,slot_id,quantity,quantity_unit,token) VALUES (?,?,?,?,?,?,?)').run(farmerId, centreId, cropId, slotId, quantity, quantityUnit, token).lastInsertRowid;
  db.prepare('INSERT INTO queue_entries (booking_id,status) VALUES (?,?)').run(id, 'BOOKED'); db.prepare('INSERT INTO procurements (booking_id,stage) VALUES (?,?)').run(id, 'BOOKED'); db.prepare('INSERT INTO payments (booking_id) VALUES (?)').run(id);
  notify(farmerId, 'Slot confirmed', `Your procurement token ${token} is confirmed.`); audit(actorId, 'BOOKING_CREATED', 'booking', id, null, { token, centreId, slotId }); recalculateQueue(centreId); return bookingView(id);
});

export function transitionBooking({ bookingId, nextStatus, actorId, actualQuantity, qualityStatus }) {
  return db.transaction(() => {
    const current = db.prepare('SELECT * FROM bookings WHERE id=?').get(bookingId); if (!current) throw Object.assign(new Error('Booking not found.'), { status: 404 });
    if (!transitions[current.status]?.includes(nextStatus)) throw Object.assign(new Error(`Invalid transition from ${current.status} to ${nextStatus}.`), { status: 409 });
    const now = new Date().toISOString(); db.prepare("UPDATE bookings SET status=?,checked_in_at=CASE WHEN ?='CHECKED_IN' THEN ? ELSE checked_in_at END,completed_at=CASE WHEN ?='COMPLETED' THEN ? ELSE completed_at END WHERE id=?").run(nextStatus, nextStatus, now, nextStatus, now, bookingId);
    db.prepare("UPDATE queue_entries SET status=?,called_at=CASE WHEN ?='CALLED' THEN ? ELSE called_at END WHERE booking_id=?").run(nextStatus, nextStatus, now, bookingId);
    const proc = db.prepare('SELECT * FROM procurements WHERE booking_id=?').get(bookingId);
    const patch = nextStatus === 'CHECKED_IN' ? { stage: 'CHECKED_IN', verification_at: now } : nextStatus === 'PROCESSING' ? { stage: 'QUALITY_CHECK', quality_status: qualityStatus || 'PASSED', quality_at: now } : nextStatus === 'COMPLETED' ? { stage: 'PROCUREMENT_COMPLETED', actual_quantity: actualQuantity, weighing_at: now, completed_at: now } : {};
    if (Object.keys(patch).length) { const fields = Object.keys(patch); db.prepare(`UPDATE procurements SET ${fields.map((field) => `${field}=@${field}`).join(',')} WHERE booking_id=@bookingId`).run({ ...patch, bookingId }); }
    if (nextStatus === 'COMPLETED') { const price = db.prepare('SELECT price_per_quintal FROM crops WHERE id=?').get(current.crop_id).price_per_quintal; const amount = Number((Number(actualQuantity) * price).toFixed(2)); db.prepare("UPDATE payments SET amount=?,status='PROCESSING' WHERE booking_id=?").run(amount, bookingId); notify(current.farmer_id, 'Procurement completed', `Your produce was weighed at ${actualQuantity} quintals. Payment of ₹${amount.toLocaleString('en-IN')} is processing.`); }
    if (nextStatus !== 'COMPLETED') notify(current.farmer_id, 'Procurement update', `Your token ${current.token} is now ${nextStatus.toLowerCase().replace('_',' ')}.`);
    audit(actorId, `BOOKING_${nextStatus}`, 'booking', bookingId, { status: current.status }, { status: nextStatus, actualQuantity, qualityStatus }); recalculateQueue(current.centre_id); return bookingView(bookingId);
  })();
}

export function callNext(actorId, centreId) {
  return db.transaction(() => {
    const current = db.prepare("SELECT b.* FROM bookings b WHERE b.centre_id=? AND b.status IN ('CALLED','PROCESSING') LIMIT 1").get(centreId);
    if (current) throw Object.assign(new Error('Complete the current farmer before calling the next one.'), { status: 409 });
    const next = db.prepare("SELECT b.* FROM bookings b WHERE b.centre_id=? AND b.status IN ('CHECKED_IN','WAITING') ORDER BY b.created_at,b.id LIMIT 1").get(centreId);
    if (!next) throw Object.assign(new Error('No farmers are currently waiting.'), { status: 409 });
    const now = new Date().toISOString(); db.prepare("UPDATE bookings SET status='CALLED' WHERE id=?").run(next.id); db.prepare("UPDATE queue_entries SET status='CALLED',called_at=? WHERE booking_id=?").run(now, next.id); notify(next.farmer_id, 'You are being called', `Please proceed to the counter for token ${next.token}.`); audit(actorId, 'CALL_NEXT', 'booking', next.id, { status: next.status }, { status: 'CALLED' }); recalculateQueue(centreId); return bookingView(next.id);
  })();
}

export function recommendation(centres) { return centres.map((c) => ({ ...c, score: Math.round((100 - c.wait) + (100 - c.utilization) + (c.availableSlots * 8)) })).sort((a,b) => b.score - a.score)[0]; }
export function transactionRef() { return `KRS-TXN-${crypto.randomInt(100000, 999999)}`; }
