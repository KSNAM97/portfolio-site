// Read-only diagnostics for a Jira project: project style, status counts, boards and their column mapping.
// Prints structure only (no ticket titles): this repo's Actions logs are public.
import { readFileSync } from 'node:fs'
const key = JSON.parse(readFileSync(new URL('../portfolio.config.json', import.meta.url))).jira_import.project_key
const need = (k) => { const v = process.env[k]?.trim(); if (!v) throw new Error(`${k} required`); return v }
const base = need('JIRA_BASE_URL').replace(/\/$/, '')
const headers = { Authorization: 'Basic ' + Buffer.from(`${need('JIRA_EMAIL')}:${need('JIRA_API_TOKEN')}`).toString('base64'), Accept: 'application/json', 'Content-Type': 'application/json' }
const get = async (p, init) => { const r = await fetch(`${base}/rest/${p}`, { headers, ...init }); return r.ok ? r.json() : { __status: r.status } }

const pj = await get(`api/3/project/${key}`)
console.log(`project: style=${pj.style} simplified=${pj.simplified} type=${pj.projectTypeKey} issueTypes=${(pj.issueTypes ?? []).map((t) => t.name).join('/')}`)

const issues = []
let next
do {
  const d = await get('api/3/search/jql', { method: 'POST', body: JSON.stringify({ jql: `project = ${key} ORDER BY key ASC`, fields: ['status', 'issuetype'], maxResults: 100, ...(next && { nextPageToken: next }) }) })
  issues.push(...(d.issues ?? [])); next = d.nextPageToken
} while (next)
const by = {}
for (const i of issues) { const k = `${i.fields.status.name} [${i.fields.status.id}]`; by[k] = (by[k] ?? 0) + 1 }
console.log(`issues: ${issues.length} | keys ${issues[0]?.key} .. ${issues.at(-1)?.key} | by status: ${JSON.stringify(by)}`)

const boards = await get(`agile/1.0/board?projectKeyOrId=${key}`)
if (boards.__status) console.log(`boards: HTTP ${boards.__status} (agile API not available to this token)`)
for (const b of boards.values ?? []) {
  const cfg = await get(`agile/1.0/board/${b.id}/configuration`)
  const cols = (cfg.columnConfig?.columns ?? []).map((c) => `${c.name}(${(c.statuses ?? []).map((s) => s.id).join(',') || 'no statuses'})`)
  const onBoard = await get(`agile/1.0/board/${b.id}/issue?maxResults=0`)
  const backlog = b.type === 'scrum' || b.type === 'kanban' ? await get(`agile/1.0/board/${b.id}/backlog?maxResults=0`) : {}
  const sprints = b.type === 'scrum' ? await get(`agile/1.0/board/${b.id}/sprint`) : {}
  console.log(`board id=${b.id} type=${b.type} name="${b.name}" | columns: ${cols.join(' | ') || 'n/a'} | issues on board: ${onBoard.total ?? onBoard.__status} | backlog: ${backlog.total ?? backlog.__status ?? 'n/a'} | sprints: ${(sprints.values ?? []).map((s) => s.state).join(',') || (b.type === 'scrum' ? 'none' : 'n/a')}`)
}
