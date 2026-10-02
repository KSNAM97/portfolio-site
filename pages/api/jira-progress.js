// Live Jira progress (counts only, no titles). Credentials live in the Vercel env, never in the browser.
// Responses are cached at the edge for 60s so visitors cannot hammer the Jira API.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method' })
  const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } = process.env
  const project = process.env.JIRA_PROJECT_KEY?.trim() || 'KAN'
  if (!JIRA_BASE_URL?.trim() || !JIRA_EMAIL?.trim() || !JIRA_API_TOKEN?.trim()) return res.status(503).json({ error: 'not-configured' })

  const base = JIRA_BASE_URL.trim().replace(/\/$/, '')
  const headers = {
    Authorization: 'Basic ' + Buffer.from(`${JIRA_EMAIL.trim()}:${JIRA_API_TOKEN.trim()}`).toString('base64'),
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
  try {
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
