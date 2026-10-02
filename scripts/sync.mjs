// Push portfolio.config.json (+ live GitHub repo data) to Supabase.
import { readFileSync } from 'node:fs'

const cfg = JSON.parse(readFileSync(new URL('../portfolio.config.json', import.meta.url)))
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: KEY, GITHUB_TOKEN } = process.env
if (!SUPABASE_URL || !KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required')

const sb = (path, init = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates', ...init.headers },
  }).then(async (r) => { if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`) })

const gh = await fetch(`https://api.github.com/users/${cfg.github_user}/repos?per_page=100`, {
  headers: GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {},
}).then((r) => { if (!r.ok) throw new Error(`github: ${r.status}`); return r.json() })

// hand-written cards (e.g. private repos): defaults fill what the config omits
const extra = (cfg.extra_projects ?? []).map((p) => ({
  tags: [], url: null, homepage: null, stars: 0, pushed_at: null, featured: false, sort: 100, ...p,
}))

const rows = gh
  .filter((r) => !r.fork && !cfg.exclude.includes(r.name))
  .map((r) => {
    const o = cfg.overrides[r.name] ?? {}
    return {
      slug: r.name,
      title_ko: o.title_ko ?? r.name, title_en: o.title_en ?? r.name,
      summary_ko: o.summary_ko ?? r.description, summary_en: o.summary_en ?? r.description,
      tags: o.tags ?? [], url: r.html_url, homepage: r.homepage || null,
      stars: r.stargazers_count, pushed_at: r.pushed_at,
      featured: o.featured ?? false, sort: o.sort ?? 100,
    }
  })
  .concat(extra)

await sb('site?on_conflict=key', { method: 'POST', body: JSON.stringify({ key: 'profile', value: cfg.profile }) })
await sb('projects?on_conflict=slug', { method: 'POST', body: JSON.stringify(rows) })
// drop rows whose repo was removed/excluded
await sb(`projects?slug=not.in.(${rows.map((r) => `"${r.slug}"`).join(',')})`, { method: 'DELETE' })
console.log(`synced ${rows.length} projects`)
