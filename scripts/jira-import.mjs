// Create Jira issues from a CSV that lives in a GitHub repo (config: jira_import). Safe to re-run:
// issues whose summary already exists in the project are skipped. MODE=dry prints counts only.
// Logs never contain ticket titles (this repo's Actions logs are public).
import { readFileSync } from 'node:fs'

const cfg = JSON.parse(readFileSync(new URL('../portfolio.config.json', import.meta.url))).jira_import
const MODE = process.env.MODE === 'create' ? 'create' : 'dry'
const need = (k) => { const v = process.env[k]?.trim(); if (!v) throw new Error(`${k} required`); return v }
const base = need('JIRA_BASE_URL').replace(/\/$/, '')
const jira = {
  Authorization: 'Basic ' + Buffer.from(`${need('JIRA_EMAIL')}:${need('JIRA_API_TOKEN')}`).toString('base64'),
  'Content-Type': 'application/json', Accept: 'application/json',
}
const call = (path, init = {}) => fetch(`${base}/rest/api/3/${path}`, { ...init, headers: jira })

// 1) the CSV, straight from GitHub (private repos need SOURCE_REPO_TOKEN)
const token = process.env.SOURCE_REPO_TOKEN?.trim() || process.env.GITHUB_TOKEN
const gr = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${cfg.file}`, {
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.raw+json' },
})
if (!gr.ok) throw new Error(`csv fetch ${gr.status}`)
const parse = (t) => {
  const rows = []; let row = [], f = '', q = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++ } else q = false } else f += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(f); f = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); f = ''; rows.push(row); row = [] }
    else f += c
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row) }
  return rows.filter((r) => r.some((x) => x !== ''))
}
const [head, ...data] = parse((await gr.text()).replace(/^﻿/, ''))
const col = (n) => head.indexOf(n)
for (const n of ['Summary', 'Issue Type', 'Label', 'Priority', 'Description']) if (col(n) < 0) throw new Error(`csv column missing: ${n}`)
const tickets = data.map((r) => ({
  summary: r[col('Summary')].trim(), type: r[col('Issue Type')].trim(),
  labels: r[col('Label')].split(/[;\s]+/).filter(Boolean), priority: r[col('Priority')].trim(), description: r[col('Description')].trim(),
}))

// 2) what exists already, and which issue types the project offers
const existing = new Set()
let next
do {
  const r = await call('search/jql', { method: 'POST', body: JSON.stringify({ jql: `project = ${cfg.project_key}`, fields: ['summary'], maxResults: 100, ...(next && { nextPageToken: next }) }) })
  if (!r.ok) throw new Error(`search ${r.status}`)
  const d = await r.json(); d.issues.forEach((i) => existing.add(i.fields.summary)); next = d.nextPageToken
} while (next)
const tr = await call(`issue/createmeta/${cfg.project_key}/issuetypes`)
if (!tr.ok) throw new Error(`issuetypes ${tr.status}`)
const types = (await tr.json()).issueTypes ?? []
const std = types.filter((t) => !t.subtask && t.hierarchyLevel === 0)
const typeId = (name) => (types.find((t) => t.name.toLowerCase() === name.toLowerCase()) ?? std[0])?.id
const todo = tickets.filter((t) => !existing.has(t.summary))
console.log(`csv: ${tickets.length} tickets | already in ${cfg.project_key}: ${tickets.length - todo.length} | to create: ${todo.length} | mode: ${MODE}`)
if (MODE === 'dry') { console.log(`issue types offered: ${types.map((t) => t.name).join(', ')}`); process.exit(0) }

// 3) create; if the project rejects a field (e.g. priority on team-managed projects) drop it and go on
const drop = new Set()
const adf = (text) => ({ type: 'doc', version: 1, content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }] })
let created = 0, failed = 0
for (const t of todo) {
  const build = () => ({
    project: { key: cfg.project_key }, summary: t.summary, issuetype: { id: typeId(t.type) },
    ...(!drop.has('labels') && t.labels.length && { labels: t.labels }),
    ...(!drop.has('priority') && t.priority && { priority: { name: t.priority } }),
    ...(!drop.has('description') && t.description && { description: adf(t.description) }),
  })
  let r = await call('issue', { method: 'POST', body: JSON.stringify({ fields: build() }) })
  if (r.status === 400) {
    const errs = Object.keys((await r.json()).errors ?? {}).filter((k) => ['priority', 'labels', 'description'].includes(k))
    if (errs.length) { errs.forEach((k) => drop.add(k)); console.log(`field not accepted by project, dropping: ${errs.join(', ')}`); r = await call('issue', { method: 'POST', body: JSON.stringify({ fields: build() }) }) }
  }
  if (r.ok) created++; else { failed++; console.log(`create failed: HTTP ${r.status}`) }
}
console.log(`created ${created}, failed ${failed}`)
if (failed) process.exit(1)
