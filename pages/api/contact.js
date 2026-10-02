// Contact form -> Slack. The webhook URL lives only in the server env (SLACK_CONTACT_WEBHOOK_URL), never in the browser.
// Spam guards: same-origin check, honeypot field, length limits, per-IP limit (best effort: memory is per serverless instance).
const hits = new Map()
const clean = (v, n) =>
  String(v ?? '')
    .replace(/[<>&]/g, '')
    .replace(/@(channel|here|everyone)/gi, '')
    .trim()
    .slice(0, n)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' })
  const origin = req.headers.origin
  if (origin && new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'origin' })

  const { name, contact, message, website } = req.body ?? {}
  if (website) return res.status(200).json({ ok: true }) // honeypot: bots fill hidden fields

  const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown'
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600e3)
  if (recent.length >= 3) return res.status(429).json({ error: 'rate' })

  const msg = clean(message, 1000)
  if (msg.length < 10) return res.status(400).json({ error: 'short' })
  const hook = process.env.SLACK_CONTACT_WEBHOOK_URL
  if (!hook) return res.status(503).json({ error: 'not-configured' })

  hits.set(ip, [...recent, now])
  const text = `*[ksnam97.com contact]*\nName: ${clean(name, 60) || '-'}\nContact: ${clean(contact, 100) || '-'}\n${msg}`
  const r = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
  return r.ok ? res.status(200).json({ ok: true }) : res.status(502).json({ error: 'slack' })
}
