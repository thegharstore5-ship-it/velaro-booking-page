// Vercel serverless function: forwards browser events to Meta Conversions API.
// Env vars (Vercel → Settings → Environment Variables): META_CAPI_TOKEN, optional META_TEST_EVENT_CODE.
const crypto = require('crypto');
const PIXEL_ID = '1003865172502336';
const sha = (v) => v ? crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex') : undefined;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return res.status(500).json({ error: 'META_CAPI_TOKEN not set' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const u = b.user || {};
  const [fn, ...rest] = (u.name || '').trim().split(/\s+/);
  const phone = (u.phone || '').replace(/\D/g, '');
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
  const user_data = {
    client_ip_address: ip,
    client_user_agent: req.headers['user-agent'],
    fbp: b.fbp || undefined,
    fbc: b.fbc || undefined,
    em: u.email ? [sha(u.email)] : undefined,
    ph: phone ? [sha(phone)] : undefined,
    fn: fn ? [sha(fn)] : undefined,
    ln: rest.length ? [sha(rest.join(' '))] : undefined,
    country: [sha('us')],
  };
  const payload = {
    data: [{
      event_name: b.event_name, event_id: b.event_id,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website', event_source_url: b.event_source_url,
      user_data, custom_data: b.custom || undefined,
    }],
  };
  if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE;
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    res.status(r.status).json(await r.json());
  } catch (e) { res.status(502).json({ error: 'capi_failed' }); }
};
