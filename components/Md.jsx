import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// only absolute http(s) images (e.g. badges) are shown; repo-relative paths do not exist on the site
const Img = ({ src, alt }) => (/^https?:\/\//.test(src || '') ? <img src={src} alt={alt || ''} loading="lazy" /> : null)

// rendered with react-markdown: raw HTML in the source is not executed
export default function Md({ children }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: Img }}>{children}</ReactMarkdown>
    </div>
  )
}
