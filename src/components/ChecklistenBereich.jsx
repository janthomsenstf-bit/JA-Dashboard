import { useState } from 'react'
import JAChecklisteV2 from './detail/JAChecklisteV2.jsx'
import { genChecklisteId } from '../utils/checklistenUebersichtStorage.js'

/*
 * Hauptmenüpunkt „Checklisten" – Übersicht eigenständiger Jahresabschluss-Checklisten.
 * Daten kommen als Prop `checklisten` (eigene Top-Level-Sammlung), Änderungen über `onUpdate`.
 * Öffnen einer Checkliste rendert die Checklisten-Fachanwendung (JAChecklisteV2),
 * die ihre Daten im Feld `jaChecklisteV2` der jeweiligen Checkliste ablegt.
 */

const FARBE = '#059669'
const STATUS = {
  offen:  ['Offen',      '#94a3b8'],
  arbeit: ['In Arbeit',  '#f59e0b'],
  review: ['Review',      '#7c3aed'],
  fertig: ['Fertig',     '#16a34a'],
}

export default function ChecklistenBereich({ clients = [], checklisten = [], onUpdate }) {
  const [offenId, setOffenId] = useState(null)
  const [neu, setNeu]         = useState(false)
  const [suche, setSuche]     = useState('')

  const save     = (list) => onUpdate?.(list)
  const updateCl = (id, patch) => save(checklisten.map(c => c.id === id ? { ...c, ...patch, geaendertAm: new Date().toISOString() } : c))
  const deleteCl = (id) => { if (!confirm('Diese Checkliste wirklich löschen?')) return; save(checklisten.filter(c => c.id !== id)); if (offenId === id) setOffenId(null) }
  const mandantOf  = (id) => clients.find(c => c.id === id)
  const fortschritt = (c) => { const p = (c.jaChecklisteV2 && c.jaChecklisteV2.punkte) || []; const done = p.filter(x => x.status === 'ok').length; return { done, total: p.length, pct: p.length ? Math.round(done / p.length * 100) : 0 } }

  // ── Detailansicht: eine geöffnete Checkliste ──
  const offen = offenId ? checklisten.find(c => c.id === offenId) : null
  if (offen) {
    const m = mandantOf(offen.mandantId)
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setOffenId(null)}>← Übersicht</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input value={offen.titel || ''} onChange={e => updateCl(offen.id, { titel: e.target.value })}
              placeholder="Titel der Checkliste"
              style={{ fontSize: '17px', fontWeight: 700, border: 'none', background: 'none', color: 'var(--text)', width: '100%', padding: 0 }} />
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {m ? `${m.name}${m.mandantennummer ? ' · ' + m.mandantennummer : ''}` : 'Kein Mandant zugeordnet'} · {offen.gewinnermittlung === 'bilanz' ? 'Bilanz' : 'EÜR'}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          <JAChecklisteV2 au={offen} client={m} onUpdate={patch => updateCl(offen.id, patch)} />
        </div>
      </div>
    )
  }

  // ── Übersicht ──
  const gefiltert = checklisten.filter(c =>
    !suche
    || (c.titel || '').toLowerCase().includes(suche.toLowerCase())
    || (mandantOf(c.mandantId)?.name || '').toLowerCase().includes(suche.toLowerCase()))

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '18px', fontWeight: 800, color: FARBE }}>✅ Checklisten</div>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{checklisten.length} Checkliste(n)</span>
        <div style={{ flex: 1 }} />
        <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Suchen (Titel / Mandant)…"
          style={{ padding: '7px 11px', border: '1px solid var(--border)', borderRadius: '7px', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: '13px' }} />
        <button className="btn btn-primary btn-sm" onClick={() => setNeu(true)}>+ Neue Checkliste</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
        {neu && (
          <NeueChecklisteForm clients={clients} onCancel={() => setNeu(false)}
            onCreate={(data) => {
              const c = { id: genChecklisteId(), titel: data.titel, mandantId: data.mandantId || null, gewinnermittlung: data.gewinnermittlung, status: 'arbeit', jaChecklisteV2: { v: 1, punkte: [] }, erstelltAm: new Date().toISOString() }
              save([c, ...checklisten]); setNeu(false); setOffenId(c.id)
            }} />
        )}

        {gefiltert.length === 0 && !neu ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '30px 0', textAlign: 'center' }}>
            Noch keine Checklisten. Lege mit „+ Neue Checkliste" die erste an – optional gleich einem Mandanten zugeordnet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {gefiltert.map(c => {
              const m = mandantOf(c.mandantId); const f = fortschritt(c); const st = STATUS[c.status] || STATUS.arbeit
              return (
                <div key={c.id} onClick={() => setOffenId(c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 16px', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--surface)', cursor: 'pointer' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: st[1], flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{c.titel || '(ohne Titel)'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {m ? `${m.name}${m.mandantennummer ? ' · ' + m.mandantennummer : ''}` : 'Kein Mandant'} · {c.gewinnermittlung === 'bilanz' ? 'Bilanz' : 'EÜR'}
                    </div>
                  </div>
                  <div style={{ minWidth: '120px' }}>
                    <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: f.pct + '%', background: FARBE }} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>{f.done}/{f.total} · {f.pct}%</div>
                  </div>
                  <span className="badge" style={{ background: st[1] + '22', color: st[1] }}>{st[0]}</span>
                  <button className="btn btn-ghost btn-xs" onClick={e => { e.stopPropagation(); deleteCl(c.id) }} title="Checkliste löschen">🗑</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function NeueChecklisteForm({ clients = [], onCreate, onCancel }) {
  const [titel, setTitel]         = useState('')
  const [mandantId, setMandantId] = useState('')
  const [gw, setGw]               = useState('euer')
  const inp = { padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '7px', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: '14px' }
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', background: 'var(--surface2)', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '560px' }}>
      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Neue Jahresabschluss-Checkliste</div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Titel
        <input value={titel} onChange={e => setTitel(e.target.value)} placeholder="z. B. Jahresabschluss 2024" style={inp} autoFocus /></label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Mandant (optional)
        <select value={mandantId} onChange={e => setMandantId(e.target.value)} style={inp}>
          <option value="">— später zuordnen —</option>
          {clients.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => (
            <option key={c.id} value={c.id}>{c.name}{c.mandantennummer ? ' · ' + c.mandantennummer : ''}</option>
          ))}
        </select></label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Gewinnermittlung
        <select value={gw} onChange={e => setGw(e.target.value)} style={inp}>
          <option value="euer">EÜR</option>
          <option value="bilanz">Bilanz</option>
        </select></label>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-primary btn-sm" onClick={() => { if (!titel.trim()) return; onCreate({ titel: titel.trim(), mandantId, gewinnermittlung: gw }) }}>Anlegen</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Abbrechen</button>
      </div>
    </div>
  )
}
