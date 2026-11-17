// Shared helpers for the "slide the tile" check. Challenges are signed with
// CAPTCHA_SECRET, so the server can verify them without storing anything.
const crypto = require('crypto');

const TTL = 10 * 60 * 1000;   // a challenge is valid for 10 minutes
const MIN_SOLVE = 1200;       // humans need at least ~1.2s to turn the tile
const TOLERANCE = 4;          // percent of the track

const b64 = b => Buffer.from(b).toString('base64url');
const sign = (data, secret) => crypto.createHmac('sha256', secret).update(data).digest('base64url');

function issue(secret) {
  const angle = 30 + crypto.randomInt(0, 61);             // slot position, 30..90% along the track
  const start = 0;                                        // the tile always starts at the left
  const payload = b64(JSON.stringify({ a: angle, t: Date.now(), n: crypto.randomBytes(8).toString('hex') }));
  return { angle, start, token: `${payload}.${sign(payload, secret)}` };
}

function verify(token, answer, secret) {
  if (typeof token !== 'string' || !token.includes('.')) return 'missing';
  const [payload, mac] = token.split('.');
  const good = Buffer.from(sign(payload, secret)), got = Buffer.from(String(mac));
  if (good.length !== got.length || !crypto.timingSafeEqual(good, got)) return 'bad-signature';
  let p; try { p = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { return 'bad-payload'; }
  const age = Date.now() - p.t;
  if (age > TTL) return 'expired';
  if (age < MIN_SOLVE) return 'too-fast';
  const a = Number(answer);
  if (!Number.isFinite(a)) return 'no-answer';
  return Math.abs(a - p.a) <= TOLERANCE ? null : 'wrong';
}

module.exports = { issue, verify };
