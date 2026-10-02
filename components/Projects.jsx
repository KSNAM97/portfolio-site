import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// markdown renderer loads only when a .md file is opened
const Md = dynamic(() => import('./Md'), { ssr: false })

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
// new sb_publishable_ keys are not JWTs: apikey header only
const get = (path) =>
  fetch(`${URL_}/rest/v1/${path}`, {
    headers: { apikey: KEY, ...(KEY?.startsWith('eyJ') && { Authorization: `Bearer ${KEY}` }) }
  }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json() })

// Jira progress: numbers only (ticket titles are never stored or shown)
function Progress({ data, lang }) {
  const pct = (d, t) => (t ? Math.round((d / t) * 100) : 0)
  const bar = (c) => (
    <div className="bar" role="img" aria-label={`${pct(c.done, c.total)}%`}>
      <i className="done" style={{ width: `${pct(c.done, c.total)}%` }} />
      <i className="doing" style={{ width: `${pct(c.doing, c.total)}%` }} />
    </div>
  )
  const weeks = Object.entries(data.weeks || {}).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  return (
    <div>
      <h4 style={{ margin: '0 0 6px' }}>{lang === 'ko' ? '전체 진행률' : 'Overall'} {pct(data.done, data.total)}%</h4>
      {bar(data)}
      <p className="muted">
        {lang === 'ko' ? '완료' : 'Done'} {data.done} · {lang === 'ko' ? '진행 중' : 'In progress'} {data.doing} · {lang === 'ko' ? '할 일' : 'To do'} {data.todo} / {data.total}
      </p>
      {weeks.map(([w, c]) => (
        <div key={w} className="wk">
          <span>{w === 'etc' ? (lang === 'ko' ? '기타' : 'Other') : w}</span>
          {bar(c)}
          <span>{c.done}/{c.total}</span>
        </div>
      ))}
      <p className="muted">{lang === 'ko' ? '업데이트' : 'Updated'} {data.updated?.slice(0, 16).replace('T', ' ')} UTC</p>
    </div>
  )
}

// detail view: left table of contents (overview + files), right content.
// files come from project_files, filled by scripts/sync.mjs from content/<slug>/
function Detail({ p, t, lang }) {
  const [paths, setPaths] = useState([])
  const [sel, setSel] = useState('') // '' = overview
  const [text, setText] = useState('')
  const [jira, setJira] = useState(null)
  const q = `project_files?project=eq.${encodeURIComponent(p.slug)}`

  useEffect(() => {
    get(`${q}&select=path`).then((r) => setPaths(r.map((x) => x.path))).catch(() => setPaths([]))
  }, [p.slug])

  useEffect(() => {
    // stored value first (also tells us this project has Jira progress), then the live value if the server function is configured
    get(`site?key=eq.${encodeURIComponent('jira_progress:' + p.slug)}`)
      .then((r) => {
        const stored = r[0]?.value ?? null
        setJira(stored)
        if (stored) fetch('/api/jira-progress').then((x) => (x.ok ? x.json() : null)).then((live) => live && setJira(live)).catch(() => {})
      })
      .catch(() => setJira(null))
  }, [p.slug])

  useEffect(() => {
    if (!sel || sel === '@progress') return
    setText('…')
    get(`${q}&path=eq.${encodeURIComponent(sel)}&select=content`)
      .then((r) => setText(r[0]?.content ?? ''))
      .catch(() => setText('Failed to load file'))
  }, [sel])

  const dirOf = (x) => x.slice(0, Math.max(x.lastIndexOf('/'), 0))
  const groups = {}
  ;[...paths].sort().forEach((x) => (groups[dirOf(x)] ||= []).push(x))
  const dirs = Object.keys(groups).sort((a, b) => (a === '') - (b === '') || a.localeCompare(b))
  const rootFirst = ['', ...dirs.filter((d) => d !== '')].filter((d) => groups[d])

  return (
    <div className="files">
      <nav>
        <button className={!sel ? 'on' : ''} onClick={() => setSel('')}>
          {lang === 'ko' ? '개요' : 'Overview'}
        </button>
        {jira && (
          <button className={sel === '@progress' ? 'on' : ''} onClick={() => setSel('@progress')}>
            {lang === 'ko' ? '진행 현황' : 'Progress'}
          </button>
        )}
        {rootFirst.map((dir) => (
          <div key={dir}>
            {dir && <div className="dir" style={{ paddingLeft: 8 }}>{dir}/</div>}
            {groups[dir].map((x) => (
              <button key={x} className={x === sel ? 'on' : ''} style={dir ? { paddingLeft: 20 } : undefined} onClick={() => setSel(x)}>
                {x.slice(x.lastIndexOf('/') + 1)}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="pane">
        {sel === '@progress' ? (
          <Progress data={jira} lang={lang} />
        ) : sel ? (
          sel.endsWith('.md') ? <Md>{text}</Md> : <pre>{text}</pre>
        ) : (
          <>
            <img src={p.image} alt={t(p, 'title')} />
            <p>{t(p, 'summary')}</p>
            <ul className="tags">{p.tags.map((x) => <li key={x}>{x}</li>)}</ul>
          </>
        )}
      </div>
    </div>
  )
}

export default function Projects() {
  const [lang, setLang] = useState('ko')
  const [profile, setProfile] = useState(null)
  const [projects, setProjects] = useState([])
  const [err, setErr] = useState(null)

  useEffect(() => {
    Promise.all([get('site?key=eq.profile'), get('projects?order=featured.desc,sort.asc,pushed_at.desc')])
      .then(([s, p]) => { setProfile(s[0]?.value); setProjects(p) })
      .catch((e) => setErr(String(e)))
  }, [])

  const [open, setOpen] = useState(null)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setOpen(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const t = (o, k) => o?.[`${k}_${lang}`] ?? o?.[`${k}_ko`]
  if (err) return <p>Failed to load data ({err})</p>
  if (!profile) return <p>Loading…</p>

  return (
    <div>
      <button className="lang" onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}>
        {lang === 'ko' ? 'EN' : '한국어'}
      </button>
      <h1>{profile.name}</h1>
      <h2>{t(profile, 'role')}</h2>
      <p>{t(profile, 'bio')}</p>
      <p>
        <a href={profile.github}>GitHub</a> · <a href={profile.notion}>Notion</a> ·{' '}
        <a href={`mailto:${profile.email}`}>Email</a>
      </p>
      <ul className="tags">{profile.stack.map((s) => <li key={s}>{s}</li>)}</ul>
      <h3>{lang === 'ko' ? '프로젝트' : 'Projects'}</h3>
      <div className="grid">
        {projects.map((p) => (
          <a
            key={p.slug}
            className={`card${p.featured ? ' featured' : ''}`}
            href={p.image ? undefined : p.url || undefined}
            {...(p.image && {
              role: 'button',
              tabIndex: 0,
              onClick: () => setOpen(p),
              onKeyDown: (e) => e.key === 'Enter' && setOpen(p)
            })}
          >
            {p.image && <img src={p.image} alt={t(p, 'title')} loading="lazy" />}
            <h4>{t(p, 'title')}</h4>
            <p>{t(p, 'summary')}</p>
            <ul className="tags">{p.tags.map((x) => <li key={x}>{x}</li>)}</ul>
            {p.image && <small>{lang === 'ko' ? '클릭해서 크게 보기' : 'Click to enlarge'}</small>}
            {!p.image && p.url && <small>★ {p.stars} · {p.pushed_at?.slice(0, 10)}</small>}
          </a>
        ))}
      </div>
      {open && (
        <div className="modal" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <div className="modal-body" onClick={(e) => e.stopPropagation()}>
            <button className="modal-x" aria-label="close" onClick={() => setOpen(null)}>×</button>
            <h3>{t(open, 'title')}</h3>
            <Detail key={open.slug} p={open} t={t} lang={lang} />
          </div>
        </div>
      )}
    </div>
  )
}
