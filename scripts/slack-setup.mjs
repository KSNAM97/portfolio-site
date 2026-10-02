// Create the Slack channels listed in portfolio.config.json (slack_channels). Idempotent: existing channels are skipped.
// Needs SLACK_BOT_TOKEN (xoxb-..., scopes: channels:read, channels:manage). MODE=dry only lists what would happen.
import { readFileSync } from 'node:fs'

const channels = JSON.parse(readFileSync(new URL('../portfolio.config.json', import.meta.url))).slack_channels ?? []
const MODE = process.env.MODE === 'create' ? 'create' : 'dry'
const token = process.env.SLACK_BOT_TOKEN?.trim()
if (!token?.startsWith('xoxb-')) throw new Error('SLACK_BOT_TOKEN missing or not a bot token (xoxb-...)')

const api = (method, params = {}) =>
  fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  }).then((r) => r.json())

const have = new Set()
let cursor = ''
do {
  const r = await api('conversations.list', { types: 'public_channel', limit: '200', exclude_archived: 'true', cursor })
  if (!r.ok) {
    // token shape only (prefix + length), never the value; a doubled paste shows up as ~2x length
    const raw = process.env.SLACK_BOT_TOKEN ?? ''
    throw new Error(`conversations.list: ${r.error}${r.needed ? ` (needs ${r.needed})` : ''} [token ${raw.trim().slice(0, 5)}..., ${raw.trim().length} chars${/\s/.test(raw.trim()) ? ', has whitespace' : ''}]`)
  }
  r.channels.forEach((c) => have.add(c.name))
  cursor = r.response_metadata?.next_cursor ?? ''
} while (cursor)

let created = 0, failed = 0
for (const c of channels) {
  if (have.has(c.name)) { console.log(`#${c.name}: exists`); continue }
  if (MODE === 'dry') { console.log(`#${c.name}: would create`); continue }
  const r = await api('conversations.create', { name: c.name })
  if (!r.ok) { failed++; console.log(`#${c.name}: create failed (${r.error}${r.needed ? `, needs ${r.needed}` : ''})`); continue }
  created++; console.log(`#${c.name}: created`)
  if (c.topic) {
    const t = await api('conversations.setTopic', { channel: r.channel.id, topic: c.topic })
    if (!t.ok) console.log(`#${c.name}: topic not set (${t.error})`)
  }
}
console.log(`mode ${MODE}: ${channels.length} channels listed | created ${created} | failed ${failed}`)
if (failed) process.exit(1)
