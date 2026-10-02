// Move one Jira issue to a status by name (used to test the Slack notifications). Titles are never logged.
// KEY empty -> pick the first KAN issue that has ONLY the label LABEL (so exactly one team channel should be notified).
import { readFileSync } from 'node:fs'
const project = JSON.parse(readFileSync(new URL('../portfolio.config.json', import.meta.url))).jira_import.project_key
const need = (k) => { const v = process.env[k]?.trim(); if (!v) throw new Error(`${k} required`); return v }
const base = need('JIRA_BASE_URL').replace(/\/$/, '')
const headers = { Authorization: 'Basic ' + Buffer.from(`${need('JIRA_EMAIL')}:${need('JIRA_API_TOKEN')}`).toString('base64'), Accept: 'application/json', 'Content-Type': 'application/json' }
const call = (p, init) => fetch(`${base}/rest/api/3/${p}`, { headers, ...init })
const TO = need('TO'), LABEL = process.env.LABEL?.trim() || 'network'
let key = process.env.KEY?.trim()

if (!key) {
  const others = ['network', 'cloud', 'policy'].filter((l) => l !== LABEL).map((l) => `"${l}"`).join(',')
  const r = await call('search/jql', { method: 'POST', body: JSON.stringify({ jql: `project = ${project} AND labels = ${LABEL} AND labels not in (${others}) ORDER BY key ASC`, fields: ['labels', 'status'], maxResults: 5 }) })
  if (!r.ok) throw new Error(`search ${r.status}`)
  const d = await r.json()
  if (!d.issues.length) throw new Error(`no issue with only the label ${LABEL}`)
  key = d.issues[0].key
}
const cur = await (await call(`issue/${key}?fields=status,labels`)).json()
const tr = await (await call(`issue/${key}/transitions`)).json()
const t = tr.transitions.find((x) => x.name === TO || x.to?.name === TO)
if (!t) throw new Error(`no transition to "${TO}" (available: ${tr.transitions.map((x) => x.to?.name).join(', ')})`)
const r = await call(`issue/${key}/transitions`, { method: 'POST', body: JSON.stringify({ transition: { id: t.id } }) })
if (!r.ok) throw new Error(`transition ${r.status}`)
console.log(`issue ${key} labels=[${cur.fields.labels.join(',')}]: "${cur.fields.status.name}" -> "${t.to.name}" at ${new Date().toISOString().slice(11, 19)}Z`)
