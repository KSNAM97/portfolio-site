import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// absolute http(s) images (e.g. badges) are shown as is; repo-relative images are resolved against `base`
// (the raw GitHub URL of the file's folder) so captures committed next to the docs render on the site
const resolve = (src, base) => {
  if (/^https?:\/\//.test(src || '')) return src
  if (!src || !base || src.startsWith('data:') || src.startsWith('#')) return null
  try { return new URL(src, base).href } catch { return null }
}

// rendered with react-markdown: raw HTML in the source is not executed
// repo-relative links: open the file inside the detail view when it is listed, otherwise fall back to GitHub
export default function Md({ children, base, cur = '', paths = [], onNav, repo }) {
  const A = ({ href, children: kids }) => {
    if (!href) return <>{kids}</>
    if (/^(https?:|mailto:)/.test(href)) return <a href={href} target="_blank" rel="noreferrer">{kids}</a>
    if (href.startsWith('#')) return <a href={href}>{kids}</a>
    let path = ''
    try { path = decodeURIComponent(new URL(href, 'https://r/' + cur).pathname.slice(1)) } catch { return <>{kids}</> }
    if (paths.includes(path)) return <a href="#" onClick={(e) => { e.preventDefault(); onNav && onNav(path) }}>{kids}</a>
    const kind = /\.[A-Za-z0-9]+$/.test(path) ? 'blob' : 'tree' // folders (e.g. ../../scenarios/) need /tree/
    return repo ? <a href={`${repo}/${kind}/main/${path}`} target="_blank" rel="noreferrer">{kids}</a> : <>{kids}</>
  }
  const Img = ({ src, alt }) => { const u = resolve(src, base); return u ? <img src={u} alt={alt || ''} loading="lazy" /> : null }
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: Img, a: A }}>{children}</ReactMarkdown>
    </div>
  )
}
