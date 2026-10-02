// Back up docs/OPERATIONS.md into the locked table ops_log, one row per "## " section.
// The markdown file is the source of truth; rows for sections that no longer exist are removed.
import { readFileSync } from 'node:fs'

const AREA = 'operations'
const SUPABASE_URL = process.env.SUPABASE_URL?.trim()
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
if (!SUPABASE_URL || !KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required')

const md = readFileSync(new URL('../docs/OPERATIONS.md', import.meta.url), 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n')
const parts = md.split(/^## /m).slice(1)
const rows = parts
  .map((p) => { const i = p.indexOf('\n'); return { area: AREA, title: p.slice(0, i).trim(), body: p.slice(i + 1).trim() } })
  .filter((r) => r.title && r.body)
if (!rows.length) throw new Error('no sections found')

const sb = (path, init = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, ...(KEY.startsWith('eyJ') && { Authorization: `Bearer ${KEY}` }), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates', ...init.headers },
  }).then(async (r) => { if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`) })

await sb('ops_log?on_conflict=area,title', { method: 'POST', body: JSON.stringify(rows) })
const keep = rows.map((r) => `"${r.title.replaceAll('"', '')}"`).join(',')
await sb(`ops_log?area=eq.${AREA}&title=not.in.(${keep})`, { method: 'DELETE' })
console.log(`ops_log: ${rows.length} sections backed up (${rows.reduce((n, r) => n + r.body.length, 0)} chars)`)
