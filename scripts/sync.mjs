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

// files shown in the detail view.
// 1) fallback: content/<project-slug>/<path> committed in this repo
const norm = (t) => t.replace(/^﻿/, '').replace(/\r\n/g, '\n')
const dir = fileURLToPath(new URL('../content/', import.meta.url))
const byProject = {}
for (const p of readdirSync(dir, { recursive: true }).map((x) => x.replaceAll('\\', '/'))) {
  if (!p.includes('/') || !statSync(dir + p).isFile()) continue
  const [project, ...rest] = p.split('/')
  ;(byProject[project] ||= {})[rest.join('/')] = norm(readFileSync(dir + p, 'utf8'))
}

// 2) source of truth: files read straight from the GitHub repos listed in cfg.sources.
//    A private repo needs SOURCE_REPO_TOKEN (read-only contents access); on any failure the fallback stays.
const fetchSource = async ({ repo, include, branch = 'main', private: isPrivate }) => {
  // public repos always use the default token, so a bad SOURCE_REPO_TOKEN cannot break them
  const token = (isPrivate && process.env.SOURCE_REPO_TOKEN?.trim()) || GITHUB_TOKEN
  const h = { Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' }
  const t = await fetch(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`, { headers: h })
  if (!t.ok) {
    // never print the token: only its kind and shape, to spot paste mistakes (public Actions log)
    const raw = process.env.SOURCE_REPO_TOKEN ?? ''
    const kind = isPrivate ? (raw.startsWith('github_pat_') ? 'fine-grained' : raw.startsWith('ghp_') ? 'classic' : raw ? 'unknown-format' : 'empty') : 'default'
    const odd = /^["']|["']$|\s/.test(raw.replace(/\r?\n$/, '')) ? ' has-quote-or-space' : ''
    throw new Error(`tree ${t.status} (token: ${kind}, ${raw.trim().length} chars${odd}; ${t.headers.get('x-accepted-github-permissions') ?? 'no perms header'})`)
  }
  const wanted = (await t.json()).tree.filter((e) =>
    e.type === 'blob' && e.size < 300000 && /\.(md|cfg|vpc|txt)$/i.test(e.path) &&
    include.some((i) => e.path === i || (i.endsWith('/') && e.path.startsWith(i))))
  if (!wanted.length) throw new Error('no matching files')
  const out = {}
  for (const e of wanted) {
    const r = await fetch(`https://api.github.com/repos/${repo}/contents/${e.path.split('/').map(encodeURIComponent).join('/')}?ref=${branch}`,
      { headers: { ...h, Accept: 'application/vnd.github.raw+json' } })
    if (!r.ok) throw new Error(`${e.path} ${r.status}`)
    out[e.path] = norm(await r.text())
  }
  return out
}
for (const s of cfg.sources ?? []) {
  try {
    byProject[s.slug] = await fetchSource(s)
    console.log(`source ${s.repo}: ${Object.keys(byProject[s.slug]).length} files from GitHub`)
  } catch (e) {
    console.warn(`source ${s.repo}: ${e.message} - keeping ${byProject[s.slug] ? 'content/ fallback' : 'existing rows'}`)
  }
}

const files = Object.entries(byProject).flatMap(([project, m]) =>
  Object.entries(m).map(([path, content]) => ({ project, path, content })))
if (files.length) await sb('project_files?on_conflict=project,path', { method: 'POST', body: JSON.stringify(files) })
for (const [project, m] of Object.entries(byProject)) {
  const keep = Object.keys(m).map((x) => `"${x}"`).join(',')
  await sb(`project_files?project=eq.${project}&path=not.in.(${keep})`, { method: 'DELETE' })
}
console.log(`synced ${rows.length} projects, ${files.length} files`)
