import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from './db.js';

export function attachUser(req, _res, next) { const token = req.cookies?.krishisetu_session; const session = token && db.prepare("SELECT s.*,u.id user_id,u.name,u.email,u.role,u.centre_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now')").get(token); if (session) req.user = { id: session.user_id, name: session.name, email: session.email, role: session.role, centreId: session.centre_id }; next(); }
export function requireAuth(req, res, next) { if (!req.user) return res.status(401).json({ error: 'Authentication required.' }); next(); }
export function requireRole(...roles) { return (req, res, next) => { if (!req.user) return res.status(401).json({ error: 'Authentication required.' }); if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'You are not authorized for this action.' }); next(); }; }
export function login(email, password) { const user = db.prepare('SELECT * FROM users WHERE email=?').get(email); if (!user || !bcrypt.compareSync(password, user.password_hash)) throw Object.assign(new Error('Invalid email or password.'), { status: 401 }); const token = crypto.randomBytes(32).toString('hex'); db.prepare("INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,datetime('now','+8 hours'))").run(token, user.id); return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role, centreId: user.centre_id } }; }
export function logout(token) { if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(token); }
