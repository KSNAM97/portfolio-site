// Push portfolio.config.json (+ live GitHub repo data) to Supabase.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const cfg = JSON.parse(readFileSync(new URL('../portfolio.config.json', import.meta.url)))
const { GITHUB_TOKEN } = process.env
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() // pasted secrets often carry a stray newline
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
if (!SUPABASE_URL || !KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required')

const sb = (path, init = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    // new sb_secret_ keys are not JWTs: apikey header only; legacy service_role JWT also needs Bearer
    headers: { apikey: KEY, ...(KEY.startsWith('eyJ') && { Authorization: `Bearer ${KEY}` }), 'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates', ...init.headers },
  }).then(async (r) => { if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`) })

const gh = await fetch(`https://api.github.com/users/${cfg.github_user}/repos?per_page=100`, {
  headers: GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {},
}).then((r) => { if (!r.ok) throw new Error(`github: ${r.status}`); return r.json() })

// hand-written cards (e.g. private repos): defaults fill what the config omits
const extra = (cfg.extra_projects ?? []).map((p) => ({
  tags: [], url: null, homepage: null, image: null, stars: 0, pushed_at: null, featured: false, sort: 100, ...p,
}))

const rows = gh
  .filter((r) => cfg.include.includes(r.name)) // allowlist: only repos named here get a card
  .map((r) => {
    const o = cfg.overrides[r.name] ?? {}
    return {
      slug: r.name,
      title_ko: o.title_ko ?? r.name, title_en: o.title_en ?? r.name,
      summary_ko: o.summary_ko ?? r.description, summary_en: o.summary_en ?? r.description,
      tags: o.tags ?? [], url: r.html_url, homepage: r.homepage || null, image: o.image ?? null,
      stars: r.stargazers_count, pushed_at: r.pushed_at,
      featured: o.featured ?? false, sort: o.sort ?? 100,
    }
  })
  .concat(extra)

await sb('site?on_conflict=key', { method: 'POST', body: JSON.stringify({ key: 'profile', value: cfg.profile }) })
await sb('projects?on_conflict=slug', { method: 'POST', body: JSON.stringify(rows) })
// drop rows whose repo was removed/excluded
await sb(`projects?slug=not.in.(${rows.map((r) => `"${r.slug}"`).join(',')})`, { method: 'DELETE' })

// files shown in the detail view: content/<project-slug>/<path>
const dir = fileURLToPath(new URL('../content/', import.meta.url))
const files = readdirSync(dir, { recursive: true })
  .map((p) => p.replaceAll('\\', '/'))
  .filter((p) => p.includes('/') && statSync(dir + p).isFile())
  .map((p) => {
    const [project, ...rest] = p.split('/')
    const content = readFileSync(dir + p, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n')
    return { project, path: rest.join('/'), content }
  })
await sb('project_files?on_conflict=project,path', { method: 'POST', body: JSON.stringify(files) })
for (const project of new Set(files.map((f) => f.project))) {
  const keep = files.filter((f) => f.project === project).map((f) => `"${f.path}"`).join(',')
  await sb(`project_files?project=eq.${project}&path=not.in.(${keep})`, { method: 'DELETE' })
}
console.log(`synced ${rows.length} projects, ${files.length} files`)
