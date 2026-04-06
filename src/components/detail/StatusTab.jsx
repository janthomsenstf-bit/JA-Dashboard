import { useState } from 'react'

function fmtDatum(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

function fmtDate(iso) {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function daysSince(iso) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function daysLabel(n) {
  if (n === null) return ''
  if (n === 0) return 'Heute'
  if (n === 1) return 'Gestern'
  return `vor ${n} Tagen`
}

const KONTAKT_ARTEN = [
  { key: 'email',       label: '📧 E-Mail' },
  { key: 'telefon',     label: '📞 Telefon' },
  { key: 'persoenlich', label: '👤 Persönlich' },
  { key: 'brief',       label: '📬 Brief / Post' },
]

// ── kleines Info-Badge (Tage) ────────────────────────────────────────────────
function DaysBadge({ iso, warnDays = 14 }) {
  const n = daysSince(iso)
  if (n === null) return null
  const isWarn = n >= warnDays
  return (
    <span style={{
      fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px',
      background: n === 0 ? 'rgba(34,197,94,0.15)' : isWarn ? 'rgba(249,115,22,0.15)' : 'rgba(37,99,235,0.1)',
      color: n === 0 ? 'var(--green)' : isWarn ? 'var(--orange)' : 'var(--accent)',
    }}>
      {daysLabel(n)}
    </span>
  )
}

// ── Block-Wrapper ────────────────────────────────────────────────────────────
function Block({ icon, title, badge, children, highlight }) {
  return (
    <div style={{
      background: highlight ? 'rgba(249,115,22,0.04)' : 'var(--surface2)',
      border: `1px solid ${highlight ? 'rgba(249,115,22,0.35)' : 'var(--border)'}`,
      borderRadius: 'var(--radius)', overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px', background: highlight ? 'rgba(249,115,22,0.08)' : 'var(--surface)',
        borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span style={{ fontSize: '15px' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>{title}</span>
        {badge}
      </div>
      <div style={{ padding: '14px' }}>{children}</div>
    </div>
  )
}

// ── Schnellauswahl-Konfiguration ─────────────────────────────────────────────
const SCHNELL_ITEMS = [
  { id: 'rueckfragenGesendet', icon: '📤', label: 'Rückfragen an Mandanten gesendet',             color: '#2563eb', bg: 'rgba(37,99,235,0.08)'  },
  { id: 'warteRueckmeldung',   icon: '⏳', label: 'Warte auf Rückmeldung vom Mandanten',           color: '#f97316', bg: 'rgba(249,115,22,0.08)'  },
  { id: 'steuerUnterschrift',  icon: '✍️', label: 'Steuererklärung zur Unterschrift an Mandant gesendet', color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
]

function fmtDatumKurz(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
}

// ── Haupt-Komponente ─────────────────────────────────────────────────────────
export default function StatusTab({ client, onUpdate }) {
  const st  = client.status ?? {}
  const lk  = st.letzterKontakt      ?? {}
  const war = st.warteAufRueckmeldung ?? { aktiv: false, seit: null, notiz: '' }
  const lb  = st.letzteBearbeitung   ?? {}
  const sq  = st.schnellauswahl      ?? {}

  function patchStatus(patch) {
    onUpdate({ status: { ...st, ...patch } })
  }

  function toggleSchnell(id) {
    const current = sq[id] ?? { aktiv: false, datum: null }
    const next = current.aktiv
      ? { aktiv: false, datum: null }
      : { aktiv: true,  datum: new Date().toISOString() }
    patchStatus({ schnellauswahl: { ...sq, [id]: next } })
  }

  function setSchnellDatum(id, datum) {
    const current = sq[id] ?? { aktiv: true, datum: null }
    patchStatus({ schnellauswahl: { ...sq, [id]: { ...current, datum: datum ? new Date(datum).toISOString() : null } } })
  }

  // ── Zuletzt in Bearbeitung ─────────────────────────────────────
  const [bearbNotiz, setBearbNotiz]   = useState(lb.notiz ?? '')
  const [bearbSaved, setBearbSaved]   = useState(false)

  function saveBearbeitung(jetzt = false) {
    patchStatus({ letzteBearbeitung: {
      datum: jetzt ? new Date().toISOString() : (lb.datum ?? new Date().toISOString()),
      notiz: bearbNotiz,
    }})
    setBearbSaved(true)
    setTimeout(() => setBearbSaved(false), 2000)
  }

  // ── Letzter Kontakt ────────────────────────────────────────────
  const [kDatum,  setKDatum]  = useState(fmtDate(lk.datum))
  const [kArt,    setKArt]    = useState(lk.art   ?? 'telefon')
  const [kNotiz,  setKNotiz]  = useState(lk.notiz ?? '')
  const [kSaved,  setKSaved]  = useState(false)

  function saveKontakt(jetzt = false) {
    patchStatus({ letzterKontakt: {
      datum: jetzt ? new Date().toISOString() : (kDatum ? new Date(kDatum).toISOString() : new Date().toISOString()),
      art:   kArt,
      notiz: kNotiz,
    }})
    if (jetzt) setKDatum(new Date().toISOString().slice(0,10))
    setKSaved(true)
    setTimeout(() => setKSaved(false), 2000)
  }

  // ── Warte auf Rückmeldung ──────────────────────────────────────
  const [warNotiz, setWarNotiz] = useState(war.notiz ?? '')
  const [warSaved, setWarSaved] = useState(false)

  function toggleWarten() {
    if (war.aktiv) {
      patchStatus({ warteAufRueckmeldung: { aktiv: false, seit: null, notiz: '' } })
      setWarNotiz('')
    } else {
      patchStatus({ warteAufRueckmeldung: { aktiv: true, seit: new Date().toISOString(), notiz: warNotiz } })
    }
  }

  function saveWarNotiz() {
    patchStatus({ warteAufRueckmeldung: { ...war, notiz: warNotiz } })
    setWarSaved(true)
    setTimeout(() => setWarSaved(false), 2000)
  }

  const inputStyle = {
    width: '100%', padding: '7px 10px', border: '1px solid var(--border)',
    borderRadius: '6px', background: 'var(--surface2)', color: 'var(--text)',
    fontSize: '12px', boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }
  const rowStyle   = { display: 'flex', gap: '8px', alignItems: 'flex-end' }

  return (
    <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Schnellauswahl ── */}
      <Block icon="⚡" title="Schnellauswahl">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {SCHNELL_ITEMS.map(item => {
            const entry  = sq[item.id] ?? { aktiv: false, datum: null }
            const aktiv  = entry.aktiv
            const datum  = entry.datum ? entry.datum.slice(0, 10) : ''
            return (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '8px',
                border: `1px solid ${aktiv ? item.color + '55' : 'var(--border)'}`,
                background: aktiv ? item.bg : 'var(--surface)',
                transition: 'all 0.15s',
              }}>
                {/* Checkbox + Label */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', flex: 1, userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={aktiv}
                    onChange={() => toggleSchnell(item.id)}
                    style={{ width: '17px', height: '17px', accentColor: item.color, cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: aktiv ? 600 : 400, color: aktiv ? item.color : 'var(--text-secondary)' }}>
                    {item.icon} {item.label}
                  </span>
                </label>

                {/* Datum – nur wenn aktiv */}
                {aktiv && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>am</span>
                    <input
                      type="date"
                      value={datum}
                      onChange={e => setSchnellDatum(item.id, e.target.value)}
                      style={{
                        padding: '3px 7px', border: `1px solid ${item.color}55`,
                        borderRadius: '6px', background: 'var(--surface2)',
                        color: item.color, fontSize: '12px', fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Block>

      {/* ── Warte auf Rückmeldung (oben, prominent wenn aktiv) ── */}
      <Block
        icon="⏳"
        title="Warte auf Rückmeldung"
        highlight={war.aktiv}
        badge={war.aktiv
          ? <span style={{ fontSize:'11px', fontWeight:600, color:'var(--orange)', padding:'2px 8px', borderRadius:'20px', background:'rgba(249,115,22,0.15)' }}>
              Seit {daysSince(war.seit)} {daysSince(war.seit) === 1 ? 'Tag' : 'Tagen'}
            </span>
          : null
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: war.aktiv ? '12px' : '0' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={war.aktiv}
              onChange={toggleWarten}
              style={{ width: '16px', height: '16px', accentColor: 'var(--orange)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '13px', fontWeight: war.aktiv ? 600 : 400, color: war.aktiv ? 'var(--orange)' : 'var(--text-secondary)' }}>
              {war.aktiv
                ? `Warte auf Rückmeldung seit ${fmtDatum(war.seit)}`
                : 'Nicht aktiv – Häkchen setzen wenn Rückmeldung aussteht'}
            </span>
          </label>
        </div>

        {war.aktiv && (
          <div>
            <label style={labelStyle}>Worauf warte ich? (optional)</label>
            <div style={rowStyle}>
              <input
                type="text"
                value={warNotiz}
                onChange={e => setWarNotiz(e.target.value)}
                placeholder="z. B. fehlende Belege 2023, Vollmacht, …"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                className={`btn btn-sm ${warSaved ? 'btn-success' : 'btn-primary'}`}
                style={{ whiteSpace: 'nowrap', fontSize: '12px' }}
                onClick={saveWarNotiz}
              >
                {warSaved ? '✓ Gespeichert' : 'Speichern'}
              </button>
            </div>
            {war.notiz && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)', padding: '6px 10px', background: 'rgba(249,115,22,0.06)', borderRadius: '6px' }}>
                📝 {war.notiz}
              </div>
            )}
          </div>
        )}
      </Block>

      {/* ── 2-Spalten: Bearbeitung + Letzter Kontakt ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Zuletzt in Bearbeitung */}
        <Block
          icon="🛠"
          title="Zuletzt in Bearbeitung"
          badge={lb.datum ? <DaysBadge iso={lb.datum} warnDays={7} /> : null}
        >
          {lb.datum ? (
            <div style={{ marginBottom: '12px', padding: '10px 12px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>{fmtDatum(lb.datum)}</div>
              {lb.notiz && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>📝 {lb.notiz}</div>}
            </div>
          ) : (
            <div style={{ marginBottom: '12px', fontSize: '12px', color: 'var(--text-muted)', padding: '10px', textAlign: 'center' }}>
              Noch kein Eintrag vorhanden.
            </div>
          )}

          <label style={labelStyle}>Notiz zur Bearbeitung (optional)</label>
          <input
            type="text"
            value={bearbNotiz}
            onChange={e => setBearbNotiz(e.target.value)}
            placeholder="z. B. SUSA geprüft, Anlagen bearbeitet…"
            style={{ ...inputStyle, marginBottom: '8px' }}
          />
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn btn-primary btn-sm"
              style={{ flex: 1, fontSize: '12px' }}
              onClick={() => saveBearbeitung(true)}
            >
              {bearbSaved ? '✓ Gespeichert' : '🕐 Jetzt eintragen'}
            </button>
          </div>
        </Block>

        {/* Letzter Kontakt */}
        <Block
          icon="📞"
          title="Letzter Kontakt"
          badge={lk.datum ? <DaysBadge iso={lk.datum} warnDays={21} /> : null}
        >
          {lk.datum ? (
            <div style={{ marginBottom: '12px', padding: '10px 12px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>{fmtDatum(lk.datum)}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--surface2)', padding: '1px 8px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  {KONTAKT_ARTEN.find(a => a.key === lk.art)?.label ?? lk.art}
                </span>
              </div>
              {lk.notiz && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>📝 {lk.notiz}</div>}
            </div>
          ) : (
            <div style={{ marginBottom: '12px', fontSize: '12px', color: 'var(--text-muted)', padding: '10px', textAlign: 'center' }}>
              Noch kein Kontakt eingetragen.
            </div>
          )}

          <label style={labelStyle}>Art des Kontakts</label>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {KONTAKT_ARTEN.map(a => (
              <button
                key={a.key}
                onClick={() => setKArt(a.key)}
                style={{
                  padding: '3px 10px', borderRadius: '20px', border: `1px solid ${kArt === a.key ? 'var(--accent)' : 'var(--border)'}`,
                  background: kArt === a.key ? 'var(--accent-dim)' : 'var(--surface)', color: kArt === a.key ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: '11px', cursor: 'pointer', fontWeight: kArt === a.key ? 600 : 400,
                }}
              >{a.label}</button>
            ))}
          </div>

          <label style={labelStyle}>Datum</label>
          <input
            type="date"
            value={kDatum}
            onChange={e => setKDatum(e.target.value)}
            style={{ ...inputStyle, marginBottom: '8px' }}
          />

          <label style={labelStyle}>Notiz (optional)</label>
          <input
            type="text"
            value={kNotiz}
            onChange={e => setKNotiz(e.target.value)}
            placeholder="Kurze Zusammenfassung…"
            style={{ ...inputStyle, marginBottom: '8px' }}
          />

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn btn-primary btn-sm"
              style={{ flex: 1, fontSize: '12px' }}
              onClick={() => saveKontakt(true)}
            >
              {kSaved ? '✓ Gespeichert' : '🕐 Heute eintragen'}
            </button>
            {kDatum && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '12px' }}
                onClick={() => saveKontakt(false)}
              >
                💾 Datum übernehmen
              </button>
            )}
          </div>
        </Block>

      </div>
    </div>
  )
}
