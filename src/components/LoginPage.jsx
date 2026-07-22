import { useState } from 'react'
import { supabase } from '../utils/supabaseClient.js'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(err.message)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{
        width: '340px', padding: '36px 32px', borderRadius: '16px',
        background: 'var(--surface)', border: '1px solid var(--border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}>
        {/* Logo / Titel */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>📊</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>Jan's Spielbuch</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Spielbuch</div>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
              E-Mail
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required autoFocus autoComplete="email"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                borderRadius: '8px', border: '1px solid var(--border)',
                background: 'var(--surface2)', color: 'var(--text)', fontSize: '13px',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
              Passwort
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required autoComplete="current-password"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                borderRadius: '8px', border: '1px solid var(--border)',
                background: 'var(--surface2)', color: 'var(--text)', fontSize: '13px',
              }}
            />
          </div>

          {error && (
            <div style={{
              fontSize: '12px', color: '#dc2626', padding: '8px 12px',
              background: 'rgba(220,38,38,0.07)', borderRadius: '7px',
              border: '1px solid rgba(220,38,38,0.2)',
            }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            marginTop: '4px', padding: '10px', borderRadius: '8px',
            border: 'none', background: loading ? 'var(--border)' : 'var(--accent)',
            color: '#fff', fontSize: '13px', fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'Anmeldung läuft…' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  )
}
