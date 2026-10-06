// Live Jira progress (counts only, no titles). Credentials live in the Vercel env, never in the browser.
// Responses are cached at the edge for 60s so visitors cannot hammer the Jira API.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method' })
  const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } = process.env
  const project = process.env.JIRA_PROJECT_KEY?.trim() || 'KAN'
  if (!JIRA_BASE_URL?.trim() || !JIRA_EMAIL?.trim() || !JIRA_API_TOKEN?.trim()) return res.status(503).json({ error: 'not-configured' })

  // only live while the site shows Jira progress for some project (rows exist in site.jira_progress:*); hidden projects close it
  try {
    const su = process.env.NEXT_PUBLIC_SUPABASE_URL, sk = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const g = await fetch(`${su}/rest/v1/site?key=like.jira_progress:*&select=key&limit=1`, { headers: { apikey: sk, ...(sk?.startsWith('eyJ') && { Authorization: `Bearer ${sk}` }) } })
    if (!g.ok || !(await g.json()).length) return res.status(404).json({ error: 'disabled' })
  } catch {
    return res.status(404).json({ error: 'disabled' })
  }

  const base = JIRA_BASE_URL.trim().replace(/\/$/, '')
  const headers = {
    Authorization: 'Basic ' + Buffer.from(`${JIRA_EMAIL.trim()}:${JIRA_API_TOKEN.trim()}`).toString('base64'),
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
  try {
    // wrong email/token/base URL makes Jira treat the request as anonymous: searches then "succeed" with 0 issues.
    // Check who we are first so that case is an error (never cached, never shown as 0%).
    const me = await fetch(`${base}/rest/api/3/myself`, { headers })
    if (!me.ok || !(await me.json()).accountId) return res.status(502).json({ error: 'jira-auth' })

    const issues = []
    let next
    do {
      const r = await fetch(`${base}/rest/api/3/search/jql`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jql: `project = ${project}`, fields: ['summary', 'status'], maxResults: 100, ...(next && { nextPageToken: next }) })
      })
      if (!r.ok) return res.status(502).json({ error: 'jira' })
      const d = await r.json()
      issues.push(...d.issues)
      next = d.nextPageToken
    } while (next)

    const zero = () => ({ total: 0, done: 0, doing: 0, todo: 0 })
    const all = zero()
    const weeks = {}
    for (const i of issues) {
      const cat = i.fields.status?.statusCategory?.key
      const k = cat === 'done' ? 'done' : cat === 'indeterminate' ? 'doing' : 'todo'
      const w = /^\[(W\d+)\]/.exec(i.fields.summary ?? '')?.[1] ?? 'etc'
      for (const c of [all, (weeks[w] ||= zero())]) { c.total++; c[k]++ }
    }
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
    return res.status(200).json({ ...all, weeks, updated: new Date().toISOString(), live: true })
  } catch {
    return res.status(502).json({ error: 'jira' })
  }
}
