import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// rendered with react-markdown: raw HTML in the source is not executed
export default function Md({ children }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}
