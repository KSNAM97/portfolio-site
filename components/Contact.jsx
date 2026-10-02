import { useState } from 'react'

const T = {
  title: '문의 / Contact',
  name: '이름 / Name',
  contact: '이메일 또는 연락처 / Email or phone',
  message: '메시지 / Message (10자 이상)',
  send: '보내기 / Send',
  ok: '전달했어요. 확인 후 연락드릴게요. / Sent. I will get back to you.',
  rate: '잠시 후 다시 시도해 주세요. / Too many messages, try again later.',
  short: '메시지를 10자 이상 입력해 주세요. / Please write at least 10 characters.',
  fail: '전송하지 못했어요. 이메일로 보내 주세요. / Could not send. Please email instead.'
}

export default function Contact() {
  const [state, setState] = useState('idle') // idle | sending | ok | rate | short | fail

  const submit = async (e) => {
    e.preventDefault()
    setState('sending')
    const f = Object.fromEntries(new FormData(e.target))
    try {
      const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
      if (r.ok) { e.target.reset(); setState('ok') }
      else setState(r.status === 429 ? 'rate' : r.status === 400 ? 'short' : 'fail')
    } catch {
      setState('fail')
    }
  }

  return (
    <form className="contact" onSubmit={submit}>
      <h3>{T.title}</h3>
      <input name="name" placeholder={T.name} maxLength={60} autoComplete="name" />
      <input name="contact" placeholder={T.contact} maxLength={100} autoComplete="email" />
      <textarea name="message" placeholder={T.message} rows={4} maxLength={1000} required />
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hp" />
      <button type="submit" disabled={state === 'sending'}>{T.send}</button>
      {state !== 'idle' && state !== 'sending' && <p role="status">{T[state]}</p>}
    </form>
  )
}
