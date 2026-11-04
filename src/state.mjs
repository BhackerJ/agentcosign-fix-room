import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
export function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export class State {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY); CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT);',
    );
  }
  setting(key, value) {
    const row = this.db.prepare('SELECT value FROM settings WHERE key=?').get(key);
    if (row) return row.value;
    this.db.prepare('INSERT INTO settings VALUES(?,?)').run(key, String(value));
    return String(value);
  }
  setSetting(key, value) {
    this.db
      .prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run(key, String(value));
  }
  all() {
    return this.db
      .prepare('SELECT data FROM cases')
      .all()
      .map(r => JSON.parse(r.data));
  }
  get(id) {
    const r = this.db.prepare('SELECT data FROM cases WHERE id=?').get(id);
    return r ? JSON.parse(r.data) : null;
  }
  save(c) {
    this.db
      .prepare('INSERT INTO cases VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data')
      .run(c.id, JSON.stringify(c));
  }
  seen(id) {
    return !!this.db.prepare('SELECT id FROM messages WHERE id=?').get(id);
  }
  mark(id) {
    this.db.prepare('INSERT OR IGNORE INTO messages VALUES(?)').run(id);
  }
  close() {
    this.db.close();
  }
}
export function approvalAllowed(event, c, merchant, room) {
  return (
    event.room_id === room &&
    event.payload.sender === merchant &&
    event.payload.body.trim() === `approve ${c.id} v${c.version} ${c.hash}` &&
    c.state === 'proposed'
  );
}

export function factAction(c, quantity) {
  if (!c) return 'reject';
  if (c.state === 'needs_fact') return 'accept';
  return c.target === quantity ? 'duplicate' : 'reject';
}
