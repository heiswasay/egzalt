// Vercel serverless function: sends contact-form enquiries to contact@egzalt.com
// through the Hostinger Mail API. Secrets come from project environment variables.

const MAX = { name: 120, company: 160, email: 200, service: 60, message: 5000 };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (v, n) => String(v ?? '').replace(/\r/g, '').trim().slice(0, n);

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Method not allowed' }); }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  // Honeypot: real visitors never fill this hidden field.
  if (body.website) return res.status(200).json({ ok: true });

  const f = {
    name: clean(body.name, MAX.name),
    company: clean(body.company, MAX.company),
    email: clean(body.email, MAX.email),
    service: clean(body.service, MAX.service),
    message: clean(body.message, MAX.message),
  };
  if (!f.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) {
    return res.status(400).json({ ok: false, error: 'Please add your name and a valid email.' });
  }

  const token = process.env.HOSTINGER_MAIL_TOKEN, mailbox = process.env.HOSTINGER_MAILBOX_ID;
  if (!token || !mailbox) return res.status(500).json({ ok: false, error: 'Mail is not configured.' });

  const subject = `New enquiry: ${f.name}${f.company ? ` (${f.company})` : ''} - ${f.service || 'General'}`.replace(/\n/g, ' ');
  const text = `New enquiry from the Egzalt website\n\nName: ${f.name}\nBusiness: ${f.company || '-'}\nEmail: ${f.email}\nNeeds help with: ${f.service || '-'}\n\nMessage:\n${f.message || '-'}\n\nReply to: ${f.email}`;
  const row = (k, v) => `<tr><td style="padding:6px 14px 6px 0;color:#6b6e75;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 0;color:#1A1B1E">${v}</td></tr>`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;max-width:560px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#C46A00">Website enquiry</p>
<h2 style="margin:0 0 16px;font-size:20px;color:#1A1B1E">${esc(f.name)}${f.company ? ` &middot; ${esc(f.company)}` : ''}</h2>
<table style="border-collapse:collapse">${row('Email', `<a href="mailto:${esc(f.email)}" style="color:#C46A00">${esc(f.email)}</a>`)}${row('Business', esc(f.company || '-'))}${row('Needs help with', esc(f.service || '-'))}</table>
<div style="margin-top:16px;padding:14px 16px;background:#f5f5f6;border-left:3px solid #F98702;white-space:pre-wrap">${esc(f.message || '-')}</div>
<p style="margin-top:18px"><a href="mailto:${esc(f.email)}?subject=${encodeURIComponent('Re: your enquiry to Egzalt')}" style="display:inline-block;background:#F98702;color:#fff;text-decoration:none;padding:9px 16px;border-radius:4px">Reply to ${esc(f.name)}</a></p>
</div>`;

  try {
    const r = await fetch(`https://api.mail.hostinger.com/api/v1/mailboxes/${encodeURIComponent(mailbox)}/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: ['contact@egzalt.com'], displayName: 'Egzalt Website', subject, text, html }),
    });
    if (!r.ok) {
      console.error('Hostinger send failed', r.status, (await r.text()).slice(0, 500));
      return res.status(502).json({ ok: false, error: 'Could not send right now.' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Hostinger send error', err);
    return res.status(502).json({ ok: false, error: 'Could not send right now.' });
  }
};
