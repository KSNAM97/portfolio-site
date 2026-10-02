import { useEffect, useState } from 'react'

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
// new sb_publishable_ keys are not JWTs: apikey header only
const get = (path) =>
  fetch(`${URL_}/rest/v1/${path}`, {
    headers: { apikey: KEY, ...(KEY?.startsWith('eyJ') && { Authorization: `Bearer ${KEY}` }) }
  }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json() })

// file tree + viewer for one project (rows come from project_files, filled by sync)
function Files({ slug }) {
  const [paths, setPaths] = useState(null)
  const [sel, setSel] = useState(null)
  const [text, setText] = useState('')
  const q = `project_files?project=eq.${encodeURIComponent(slug)}`

  useEffect(() => {
    get(`${q}&select=path&order=path`)
      .then((r) => { setPaths(r.map((x) => x.path)); setSel(r[0]?.path ?? null) })
      .catch(() => setPaths([]))
  }, [slug])

  useEffect(() => {
    if (!sel) return
    setText('…')
    get(`${q}&path=eq.${encodeURIComponent(sel)}&select=content`)
      .then((r) => setText(r[0]?.content ?? ''))
      .catch(() => setText('Failed to load file'))
  }, [sel])

  if (!paths) return <p>Loading…</p>
  if (!paths.length) return <p>No files.</p>
  const groups = {}
  paths.forEach((p) => {
    const i = p.lastIndexOf('/')
    ;(groups[i < 0 ? '/' : p.slice(0, i)] ||= []).push(p)
  })
  return (
    <div className="files">
      <nav>
        {Object.entries(groups).map(([dir, list]) => (
          <div key={dir}>
            <div className="dir">{dir === '/' ? '(root)' : dir + '/'}</div>
            {list.map((p) => (
              <button key={p} className={p === sel ? 'on' : ''} onClick={() => setSel(p)}>
                {p.slice(p.lastIndexOf('/') + 1)}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <pre>{text}</pre>
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
  const [view, setView] = useState('overview')
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
              onClick: () => { setOpen(p); setView('overview') },
              onKeyDown: (e) => e.key === 'Enter' && (setOpen(p), setView('overview'))
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
            <div className="tabs">
              <button className={view === 'overview' ? 'on' : ''} onClick={() => setView('overview')}>
                {lang === 'ko' ? '개요' : 'Overview'}
              </button>
              <button className={view === 'files' ? 'on' : ''} onClick={() => setView('files')}>
                {lang === 'ko' ? '파일 (컨피그·문서)' : 'Files (configs, docs)'}
              </button>
            </div>
            {view === 'overview' ? (
              <>
                <img src={open.image} alt={t(open, 'title')} />
                <p>{t(open, 'summary')}</p>
                <ul className="tags">{open.tags.map((x) => <li key={x}>{x}</li>)}</ul>
              </>
            ) : (
              <Files slug={open.slug} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
