import { useEffect, useState } from 'react'

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
// new sb_publishable_ keys are not JWTs: apikey header only
const get = (path) =>
  fetch(`${URL_}/rest/v1/${path}`, {
    headers: { apikey: KEY, ...(KEY?.startsWith('eyJ') && { Authorization: `Bearer ${KEY}` }) }
  }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json() })

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
          <a key={p.slug} className={`card${p.featured ? ' featured' : ''}`} href={p.url || undefined}>
            {p.image && <img src={p.image} alt={t(p, 'title')} loading="lazy" />}
            <h4>{t(p, 'title')}</h4>
            <p>{t(p, 'summary')}</p>
            <ul className="tags">{p.tags.map((x) => <li key={x}>{x}</li>)}</ul>
            {p.url && <small>★ {p.stars} · {p.pushed_at?.slice(0, 10)}</small>}
          </a>
        ))}
      </div>
    </div>
  )
}
