// Post the announcement text (a file in a GitHub repo) to the channels listed in portfolio.config.json (slack_announce).
// Needs SLACK_BOT_TOKEN with chat:write + channels:read; the bot must be a member of the channels (it is, for channels it created).
// MODE=dry prints channel names and length only. The text itself is never logged (it comes from a private repo; logs are public).
// Not idempotent by design: run it once, a second run posts the announcement again.
import { readFileSync } from 'node:fs'

const cfg = JSON.parse(readFileSync(new URL('../portfolio.config.json', import.meta.url))).slack_announce
const MODE = process.env.MODE === 'post' ? 'post' : 'dry'
const token = process.env.SLACK_BOT_TOKEN?.trim()
if (!token?.startsWith('xoxb-')) throw new Error('SLACK_BOT_TOKEN missing or not a bot token (xoxb-...)')

const gh = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${cfg.file}`, {
  headers: { Authorization: `Bearer ${process.env.SOURCE_REPO_TOKEN?.trim() || process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github.raw+json' },
})
if (!gh.ok) throw new Error(`announcement fetch ${gh.status}`)
const text = (await gh.text()).replace(/^﻿/, '').replace(/\r\n/g, '\n').trim()

const api = (method, params = {}) =>
  fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  }).then((r) => r.json())

const ids = new Map()
let cursor = ''
do {
  const r = await api('conversations.list', { types: 'public_channel', limit: '200', exclude_archived: 'true', cursor })
  if (!r.ok) throw new Error(`conversations.list: ${r.error}${r.needed ? ` (needs ${r.needed})` : ''}`)
  r.channels.forEach((c) => ids.set(c.name, c.id))
  cursor = r.response_metadata?.next_cursor ?? ''
} while (cursor)

console.log(`announcement: ${text.length} chars | mode ${MODE}`)
let failed = 0
for (const name of cfg.channels) {
  const id = ids.get(name)
  if (!id) { failed++; console.log(`#${name}: channel not found`); continue }
  if (MODE === 'dry') { console.log(`#${name}: would post`); continue }
  const r = await api('chat.postMessage', { channel: id, text, mrkdwn: 'true', unfurl_links: 'false' })
  if (r.ok) console.log(`#${name}: posted`)
  else { failed++; console.log(`#${name}: failed (${r.error}${r.needed ? `, needs ${r.needed}` : ''})`) }
}
if (failed) process.exit(1)
