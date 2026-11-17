// Issues a fresh "turn the tile" challenge for the contact form.
const { issue } = require('./_tile');

module.exports = (req, res) => {
  const secret = process.env.CAPTCHA_SECRET;
  res.setHeader('Cache-Control', 'no-store');
  if (!secret) return res.status(500).json({ ok: false });
  const { angle, start, token } = issue(secret);
  res.status(200).json({ ok: true, angle, start, token });
};
