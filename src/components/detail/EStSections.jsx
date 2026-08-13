import { useState } from 'react'

// ════════════════════════════════════════════════════════════════════════════
// Einkommensteuer-Auftrag – gekapselte, in sich geschlossene Bausteine.
// Rein additiv: alle Felder liegen am Auftrag unter est* (bzw. geteilt: eilig,
// eiligBis, frist). Verlauf & Honorar werden weiterhin in AuftraegeTab gerendert.
// ════════════════════════════════════════════════════════════════════════════

const labelStyle = { fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }
const inputStyle = { padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', width: '100%', boxSizing: 'border-box' }

function fmtShortDate(iso) {
  if (!iso) return '–'
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
}

// ── Eigene ESt-Statuskette (getrennt vom Jahresabschluss) ─────────────────────
export const EST_WORKFLOW_STATUS = {
  neu:                    { label: 'Neu',                          icon: '🆕', color: '#64748b', bg: 'rgba(100,116,139,0.1)',  border: 'rgba(100,116,139,0.3)' },
  unterlagen_angefordert: { label: 'Unterlagen angefordert',       icon: '📥', color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.3)'  },
  unterlagen_erhalten:    { label: 'Unterlagen erhalten',          icon: '📬', color: '#16a34a', bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.3)'   },
  in_bearbeitung:         { label: 'In Bearbeitung',               icon: '🔧', color: '#2563eb', bg: 'rgba(37,99,235,0.08)',   border: 'rgba(37,99,235,0.3)'   },
  rueckfragen_offen:      { label: 'Rückfragen offen',             icon: '⏳', color: '#d97706', bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.3)'   },
  entwurf_erstellt:       { label: 'Entwurf erstellt',             icon: '📝', color: '#0891b2', bg: 'rgba(8,145,178,0.08)',  border: 'rgba(8,145,178,0.3)'   },
  an_mandant:             { label: 'An Mandant gesendet',          icon: '📨', color: '#0f766e', bg: 'rgba(15,118,110,0.08)', border: 'rgba(15,118,110,0.3)'  },
  warte_unterschrift:     { label: 'Warte auf Vollmacht/Unterschrift', icon: '✍️', color: '#d97706', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.3)' },
  an_finanzamt:           { label: 'An Finanzamt übermittelt (ELSTER)', icon: '🏛', color: '#2563eb', bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.3)' },
  bescheid_geprueft:      { label: 'Bescheid geprüft',             icon: '🔎', color: '#0f766e', bg: 'rgba(15,118,110,0.08)', border: 'rgba(15,118,110,0.3)'  },
  abgeschlossen:          { label: 'Abgeschlossen',                icon: '✅', color: '#16a34a', bg: 'rgba(22,163,74,0.1)',   border: 'rgba(22,163,74,0.3)'   },
}

const EST_STATUS_CUSTOM_KEY = 'est-status-custom'
const EST_FARBEN = ['#2563eb', '#0891b2', '#16a34a', '#f97316', '#d97706', '#7c3aed', '#dc2626', '#0f766e', '#64748b']
function loadCustomEstStatus() {
  try { const arr = JSON.parse(localStorage.getItem(EST_STATUS_CUSTOM_KEY) || '[]'); return Array.isArray(arr) ? arr.filter(t => t && t.key && t.label) : [] } catch { return [] }
}
function saveCustomEstStatus(list) { try { localStorage.setItem(EST_STATUS_CUSTOM_KEY, JSON.stringify(list)) } catch {} }

// ── Fachliche Stammlisten ─────────────────────────────────────────────────────
const EST_EINKUNFTSARTEN = ['Nichtselbständige Arbeit','Gewerbebetrieb','Selbständige Arbeit','Vermietung und Verpachtung','Kapitalvermögen','Renten / Sonstige Einkünfte','Land- und Forstwirtschaft']
// Anlagen-Katalog: jede Anlage ist ein eigenes „Menü" mit spezifischen Eingaben.
// kind: 'positionen' (Bezeichnung + Betrag, aufsummiert) oder 'kinder' (Kinder anlegen).
// kategorien: Schnell-Zeilen für die Positionen-Eingabe.
const ANLAGE_KATALOG = [
  { key: 'N',        label: 'Anlage N',        icon: '💼', hint: 'Nichtselbständige Arbeit', kind: 'positionen',
    kategorien: ['Entfernungspauschale / Fahrten', 'Arbeitsmittel', 'Fortbildung', 'Beiträge Berufsverbände', 'Häusliches Arbeitszimmer', 'Doppelte Haushaltsführung', 'Reisekosten', 'Bewerbungskosten', 'Kontoführungsgebühren'] },
  { key: 'S',        label: 'Anlage S',        icon: '🧑‍💻', hint: 'Selbständige / freiberufliche Arbeit', kind: 'positionen',
    kategorien: ['Betriebseinnahmen', 'Betriebsausgaben', 'Abschreibungen (AfA)'] },
  { key: 'G',        label: 'Anlage G',        icon: '🏭', hint: 'Gewerbebetrieb', kind: 'positionen',
    kategorien: ['Gewinn/Verlust lt. EÜR', 'Gewerbesteuer-Anrechnung'] },
  { key: 'EUER',     label: 'Anlage EÜR',      icon: '📊', hint: 'Einnahmen-Überschussrechnung', kind: 'positionen',
    kategorien: ['Betriebseinnahmen', 'Wareneinkauf', 'Personalkosten', 'Raumkosten', 'Kfz-Kosten', 'Abschreibungen (AfA)', 'Sonstige Betriebsausgaben'] },
  { key: 'V',        label: 'Anlage V',        icon: '🏠', hint: 'Vermietung & Verpachtung', kind: 'positionen',
    kategorien: ['Mieteinnahmen (kalt)', 'Umlagen / Nebenkosten', 'AfA Gebäude', 'Schuldzinsen', 'Erhaltungsaufwand', 'Grundsteuer', 'Versicherungen', 'Verwaltungskosten'] },
  { key: 'KAP',      label: 'Anlage KAP',      icon: '💹', hint: 'Kapitalvermögen', kind: 'positionen',
    kategorien: ['Kapitalerträge gesamt', 'Anrechenbare Kapitalertragsteuer', 'Anrechenbarer SolZ', 'Sparer-Pauschbetrag'] },
  { key: 'VORSORGE', label: 'Anlage Vorsorgeaufwand', icon: '🛡️', hint: 'Versicherungen / Altersvorsorge', kind: 'positionen',
    kategorien: ['Krankenversicherung', 'Pflegeversicherung', 'Rentenversicherung', 'Arbeitslosenversicherung', 'Haftpflicht / Unfall', 'Rürup / Riester'] },
  { key: 'KIND',     label: 'Anlage Kind',     icon: '🧒', hint: 'je Kind – mit Berücksichtigungsgrund ab 18', kind: 'kinder' },
  { key: 'AGB',      label: 'Außergewöhnliche Belastungen', icon: '🏥', hint: 'z. B. Krankheitskosten', kind: 'positionen',
    kategorien: ['Krankheitskosten', 'Pflegekosten', 'Kurkosten', 'Bestattungskosten', 'Behinderungsbedingte Aufwendungen', 'Unterhalt bedürftige Personen'] },
  { key: 'HAUSH',    label: 'Haushaltsnahe Aufwendungen (§35a)', icon: '🧹', hint: 'Dienstleistungen & Handwerker', kind: 'positionen',
    kategorien: ['Haushaltsnahe Dienstleistungen', 'Handwerkerleistungen (Lohnanteil)', 'Minijob im Haushalt', 'Pflege-/Betreuungsleistungen'] },
  { key: 'SONDER',   label: 'Sonderausgaben',  icon: '📑', hint: 'Spenden, Kirchensteuer …', kind: 'positionen',
    kategorien: ['Spenden', 'Kirchensteuer', 'Kinderbetreuungskosten', 'Ausbildungskosten', 'Unterhaltsleistungen (Anlage U)'] },
]
const ANLAGE_BY_LABEL = Object.fromEntries(ANLAGE_KATALOG.map(a => [a.label, a]))

const BERUECKSICHTIGUNG = [
  'In Berufsausbildung', 'Studium', 'Übergangszeit (max. 4 Monate)', 'Freiwilligendienst (FSJ/BFD)',
  'Ausbildungsplatz suchend', 'Ohne Ausbildungsplatz', 'Behinderung', 'Kein Grund – nicht berücksichtigt',
]
const EST_VERANLAGUNGSART = [
  { k: 'einzel',          l: 'Einzelveranlagung' },
  { k: 'zusammen',        l: 'Zusammenveranlagung' },
  { k: 'einzel_ehegatten',l: 'Einzelveranlagung bei Ehegatten' },
]
const EST_UEBERMITTLUNG = ['ELSTER', 'Vollmachtsdatenbank', 'Bescheiddatenabruf']

function eurFmt(n) { return (Math.round(n * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function parseBetrag(v) { const n = parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n }
function calcAlter(geburtISO, stichjahr) {
  if (!geburtISO) return null
  const g = new Date(geburtISO + 'T12:00:00'); if (isNaN(g.getTime())) return null
  const ref = new Date((stichjahr || new Date().getFullYear()) + '-12-31T12:00:00')
  let a = ref.getFullYear() - g.getFullYear()
  if (ref.getMonth() < g.getMonth() || (ref.getMonth() === g.getMonth() && ref.getDate() < g.getDate())) a--
  return a
}
function newId(p) { return p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }

const chip = active => ({ display:'inline-flex', alignItems:'center', gap:'5px', fontSize:'11px', padding:'4px 10px', borderRadius:'20px', cursor:'pointer', border:`1px solid ${active ? '#4f46e5' : 'var(--border)'}`, background: active ? 'rgba(79,70,229,0.1)' : 'var(--surface)', color: active ? '#4f46e5' : 'var(--text-muted)', fontWeight: active ? 700 : 500, userSelect:'none' })

// ── Stammdaten Einkommensteuer (ein-/ausklappbar) ─────────────────────────────
const EST_STAMM_OPEN_KEY = 'est-stammdaten-open'
function loadEstStammOpen() { try { return localStorage.getItem(EST_STAMM_OPEN_KEY) === '1' } catch { return false } }
function saveEstStammOpen(v) { try { localStorage.setItem(EST_STAMM_OPEN_KEY, v ? '1' : '0') } catch {} }

function EStStammdatenBlock({ au, onUpdate }) {
  const [open, setOpen] = useState(loadEstStammOpen)
  const toggleOpen = () => { const n = !open; setOpen(n); saveEstStammOpen(n) }
  const eink   = Array.isArray(au.estEinkunftsarten) ? au.estEinkunftsarten : []
  const uebm   = Array.isArray(au.estUebermittlung) ? au.estUebermittlung : []
  const art    = au.estVeranlagungsart ?? 'einzel'
  const ergArt = au.estErgebnis?.art ?? ''
  const ergBtr = au.estErgebnis?.betrag ?? ''
  const toggleEink = a => onUpdate({ estEinkunftsarten: eink.includes(a) ? eink.filter(x => x !== a) : [...eink, a] })
  const toggleUebm = a => onUpdate({ estUebermittlung: uebm.includes(a) ? uebm.filter(x => x !== a) : [...uebm, a] })
  const setErgebnis = patch => onUpdate({ estErgebnis: { art: ergArt, betrag: ergBtr, ...patch } })

  return (
    <div style={{ marginBottom:'14px', padding:'12px 14px', background:'var(--surface2)', borderRadius:'10px', border:'1px solid var(--border-strong, var(--border))' }}>
      <div onClick={toggleOpen} title={open ? 'Einklappen' : 'Ausklappen'}
        style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', userSelect:'none', marginBottom: open ? '12px' : 0, flexWrap:'wrap' }}>
        <span style={{ fontSize:'14px' }}>🧑‍💼</span>
        <span style={{ fontSize:'12px', fontWeight:700, color:'var(--text)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Stammdaten Einkommensteuer</span>
        {!open && (
          <span style={{ display:'flex', gap:'6px', alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:'10px', fontWeight:700, color:'#4f46e5', background:'rgba(79,70,229,0.1)', border:'1px solid rgba(79,70,229,0.25)', borderRadius:'8px', padding:'1px 7px' }}>
              VZ {au.estVeranlagungsjahr ?? new Date().getFullYear() - 1}
            </span>
            {au.eilig && (
              <span style={{ fontSize:'10px', fontWeight:700, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'8px', padding:'1px 7px' }}>
                🔥 Eilig{au.eiligBis ? ` · bis ${fmtShortDate(au.eiligBis)}` : ''}
              </span>
            )}
          </span>
        )}
        <span style={{ marginLeft:'auto', fontSize:'13px', color:'var(--text-muted)', transition:'transform 0.15s', transform: open ? 'rotate(90deg)' : 'none', lineHeight:1 }}>▸</span>
      </div>

      {open && (<>
        {/* Eilig-Markierung (geteilte Felder eilig / eiligBis) */}
        <div style={{ marginBottom:'12px', padding:'10px 12px', borderRadius:'8px',
          background: au.eilig ? 'rgba(239,68,68,0.08)' : 'var(--surface)',
          border:`1px solid ${au.eilig ? 'rgba(239,68,68,0.4)' : 'var(--border)'}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
            <label style={{ display:'inline-flex', alignItems:'center', gap:'7px', cursor:'pointer', userSelect:'none' }}>
              <input type="checkbox" checked={!!au.eilig} onChange={e => onUpdate({ eilig: e.target.checked })}
                style={{ width:'16px', height:'16px', accentColor:'#ef4444', cursor:'pointer', flexShrink:0 }} />
              <span style={{ fontSize:'13px', fontWeight:700, color: au.eilig ? '#ef4444' : 'var(--text)' }}>🔥 Eilig</span>
            </label>
            {au.eilig && (
              <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
                <span style={{ ...labelStyle, color:'#ef4444' }}>Fertigstellung bis</span>
                <input type="date" value={au.eiligBis ?? ''} onChange={e => onUpdate({ eiligBis: e.target.value })}
                  style={{ ...inputStyle, width:'160px', borderColor:'rgba(239,68,68,0.35)', fontWeight:700, color:'#ef4444' }} />
              </div>
            )}
          </div>
        </div>

        <div style={{ display:'flex', gap:'14px', flexWrap:'wrap', marginBottom:'12px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
            <span style={{ ...labelStyle, color:'#4f46e5' }}>📅 Veranlagungsjahr</span>
            <input type="number" min="2010" max="2035" value={au.estVeranlagungsjahr ?? new Date().getFullYear() - 1}
              onChange={e => onUpdate({ estVeranlagungsjahr: parseInt(e.target.value) || au.estVeranlagungsjahr })}
              style={{ ...inputStyle, width:'90px', fontWeight:700, fontSize:'16px', textAlign:'center', color:'#4f46e5', borderColor:'rgba(79,70,229,0.3)', background:'rgba(79,70,229,0.06)' }} />
          </div>
          <div style={{ flex:1, minWidth:'180px', display:'flex', flexDirection:'column', gap:'4px' }}>
            <span style={labelStyle}>Abgabefrist / geplante Fertigstellung</span>
            <input type="date" value={au.frist ?? ''} onChange={e => onUpdate({ frist: e.target.value })} style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom:'12px' }}>
          <span style={{ ...labelStyle, display:'block', marginBottom:'5px' }}>Veranlagungsart</span>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            {EST_VERANLAGUNGSART.map(v => (
              <span key={v.k} onClick={() => onUpdate({ estVeranlagungsart: v.k })} style={chip(art === v.k)}>
                <span>{art === v.k ? '●' : '○'}</span> {v.l}
              </span>
            ))}
          </div>
        </div>

        {art === 'zusammen' && (
          <div style={{ display:'flex', gap:'14px', flexWrap:'wrap', marginBottom:'12px' }}>
            <div style={{ flex:1, minWidth:'180px', display:'flex', flexDirection:'column', gap:'4px' }}>
              <span style={labelStyle}>Ehepartner/in – Name</span>
              <input value={au.estEhepartner?.name ?? ''} onChange={e => onUpdate({ estEhepartner: { ...(au.estEhepartner ?? {}), name: e.target.value } })}
                placeholder="Vor- und Nachname" style={inputStyle} />
            </div>
            <div style={{ flex:1, minWidth:'160px', display:'flex', flexDirection:'column', gap:'4px' }}>
              <span style={labelStyle}>Ehepartner/in – Steuer-IdNr.</span>
              <input value={au.estEhepartner?.idNr ?? ''} onChange={e => onUpdate({ estEhepartner: { ...(au.estEhepartner ?? {}), idNr: e.target.value } })}
                placeholder="11-stellige IdNr." style={inputStyle} />
            </div>
          </div>
        )}

        <div style={{ display:'flex', gap:'14px', flexWrap:'wrap', marginBottom:'12px' }}>
          <div style={{ flex:1, minWidth:'160px', display:'flex', flexDirection:'column', gap:'4px' }}>
            <span style={labelStyle}>Steuer-IdNr.</span>
            <input value={au.estSteuerId ?? ''} onChange={e => onUpdate({ estSteuerId: e.target.value })} placeholder="11-stellige IdNr." style={inputStyle} />
          </div>
          <div style={{ flex:1, minWidth:'160px', display:'flex', flexDirection:'column', gap:'4px' }}>
            <span style={labelStyle}>Steuernummer (Finanzamt)</span>
            <input value={au.estSteuernummer ?? ''} onChange={e => onUpdate({ estSteuernummer: e.target.value })} placeholder="z. B. 12/345/67890" style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom:'12px' }}>
          <span style={{ ...labelStyle, display:'block', marginBottom:'5px' }}>Einkunftsarten (Mehrfachauswahl)</span>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {EST_EINKUNFTSARTEN.map(a => (
              <span key={a} onClick={() => toggleEink(a)} style={chip(eink.includes(a))}>
                <span>{eink.includes(a) ? '✓' : '+'}</span> {a}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', gap:'14px', flexWrap:'wrap', marginBottom:'12px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
            <span style={labelStyle}>Erwartetes Ergebnis</span>
            <div style={{ display:'flex', gap:'6px' }}>
              {[{ k:'erstattung', l:'Erstattung', c:'#16a34a' }, { k:'nachzahlung', l:'Nachzahlung', c:'#dc2626' }].map(o => (
                <span key={o.k} onClick={() => setErgebnis({ art: ergArt === o.k ? '' : o.k })}
                  style={{ ...chip(ergArt === o.k), borderColor: ergArt === o.k ? o.c : 'var(--border)', color: ergArt === o.k ? o.c : 'var(--text-muted)', background: ergArt === o.k ? o.c + '18' : 'var(--surface)' }}>
                  {o.l}
                </span>
              ))}
            </div>
          </div>
          <div style={{ flex:1, minWidth:'140px', display:'flex', flexDirection:'column', gap:'4px' }}>
            <span style={labelStyle}>Betrag (€, optional)</span>
            <input type="number" value={ergBtr} onChange={e => setErgebnis({ betrag: e.target.value })} placeholder="0,00" style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom:'12px' }}>
          <span style={{ ...labelStyle, display:'block', marginBottom:'5px' }}>Übermittlung / Zugänge</span>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {EST_UEBERMITTLUNG.map(a => (
              <span key={a} onClick={() => toggleUebm(a)} style={chip(uebm.includes(a))}>
                <span>{uebm.includes(a) ? '✓' : '+'}</span> {a}
              </span>
            ))}
          </div>
        </div>

        <div>
          <span style={{ ...labelStyle, display:'block', marginBottom:'5px' }}>Allgemeine Hinweise / freie Notiz</span>
          <textarea value={au.estNotiz ?? ''} onChange={e => onUpdate({ estNotiz: e.target.value })} rows={3}
            placeholder="Besonderheiten: Wegzug/Zuzug, DBA Deutschland–Dänemark, Erstberatung, Sonderfälle…"
            style={{ ...inputStyle, minHeight:'60px', resize:'vertical' }} />
        </div>
      </>)}
    </div>
  )
}

// ── Status-Sektion Einkommensteuer (eigene Kette + eigene Buttons) ────────────
function ESTStatusSection({ au, onUpdate }) {
  const [customStatus, setCustomStatus] = useState(loadCustomEstStatus)
  const [showForm, setShowForm] = useState(false)
  const [cLabel, setCLabel] = useState('')
  const [cIcon,  setCIcon]  = useState('🏷️')
  const [cColor, setCColor] = useState(EST_FARBEN[0])
  const statusInput = { padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', outline: 'none' }

  const customMap = Object.fromEntries(customStatus.map(t => [t.key, { ...t, bg: t.color + '18', border: t.color + '55' }]))
  const STATUS_MAP = { ...EST_WORKFLOW_STATUS, ...customMap }
  const current    = au.estWorkflowStatus ?? 'neu'
  const currentCfg = STATUS_MAP[current] ?? au.estStatusSnap ?? EST_WORKFLOW_STATUS.neu
  const statusDatum = au.estWorkflowStatusDatum ?? ''

  function setStatus(key) {
    const cfg = STATUS_MAP[key] ?? EST_WORKFLOW_STATUS.neu
    onUpdate({ estWorkflowStatus: key, estWorkflowStatusDatum: new Date().toISOString().slice(0,10), estStatusSnap: { label: cfg.label, icon: cfg.icon, color: cfg.color, bg: cfg.bg, border: cfg.border } })
  }
  function addCustom() {
    const label = cLabel.trim()
    if (!label) return
    const key = 'custom_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
    const next = [...customStatus, { key, label, icon: (cIcon || '🏷️').trim().slice(0, 3), color: cColor }]
    setCustomStatus(next); saveCustomEstStatus(next)
    setCLabel(''); setCIcon('🏷️'); setCColor(EST_FARBEN[0]); setShowForm(false)
  }
  function deleteCustom(key) {
    const next = customStatus.filter(t => t.key !== key)
    setCustomStatus(next); saveCustomEstStatus(next)
  }

  return (
    <div style={{ marginBottom: '16px', padding: '12px 14px', background: currentCfg.bg, borderRadius: '8px', border: `1px solid ${currentCfg.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Status</span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: currentCfg.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
          {currentCfg.icon} {currentCfg.label}
        </span>
        {statusDatum && <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>seit {fmtShortDate(statusDatum)}</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
        {Object.entries(STATUS_MAP).map(([key, cfg]) => {
          const isCustom = !!customMap[key]
          return (
            <span key={key} style={{ position: 'relative', display: 'inline-flex' }}>
              <button onClick={() => setStatus(key)} title={cfg.label} style={{
                padding: isCustom ? '3px 20px 3px 9px' : '3px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: key === current ? 700 : 400, cursor: 'pointer',
                border: `1px solid ${key === current ? cfg.color : 'var(--border)'}`,
                background: key === current ? cfg.bg : 'transparent',
                color: key === current ? cfg.color : 'var(--text-muted)',
              }}>
                {cfg.icon} {cfg.label}
              </button>
              {isCustom && (
                <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Eigenen Status „${cfg.label}" entfernen? Aufträge mit diesem Status behalten ihre Anzeige.`)) deleteCustom(key) }}
                  title="Eigenen Status entfernen"
                  style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1, padding: '1px' }}>✕</button>
              )}
            </span>
          )
        })}
        <button onClick={() => setShowForm(v => !v)} style={{
          padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
          border: `1px dashed ${showForm ? '#4f46e5' : 'var(--border)'}`, background: 'transparent', color: showForm ? '#4f46e5' : 'var(--text-muted)',
        }}>＋ Eigener Status</button>
      </div>

      {showForm && (
        <div style={{ marginTop: '10px', padding: '10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Icon</label>
            <input value={cIcon} onChange={e => setCIcon(e.target.value)} maxLength={3} style={{ ...statusInput, width: '48px', textAlign: 'center', fontSize: '15px' }} />
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Bezeichnung</label>
            <input value={cLabel} onChange={e => setCLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCustom() }} placeholder="z. B. Belege unvollständig" style={{ ...statusInput, width: '100%', boxSizing: 'border-box' }} autoFocus />
          </div>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Farbe</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              {EST_FARBEN.map(c => (
                <button key={c} onClick={() => setCColor(c)} title={c} style={{ width: '18px', height: '18px', borderRadius: '50%', background: c, cursor: 'pointer', border: cColor === c ? '2px solid var(--text)' : '2px solid transparent' }} />
              ))}
            </div>
          </div>
          <button onClick={addCustom} disabled={!cLabel.trim()} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: cLabel.trim() ? cColor : 'var(--border)', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: cLabel.trim() ? 'pointer' : 'not-allowed' }}>Status speichern</button>
          <div style={{ width: '100%', fontSize: '10px', color: 'var(--text-muted)' }}>Eigene ESt-Status gelten kanzleiweit (für alle Einkommensteuer-Aufträge) und werden lokal gespeichert.</div>
        </div>
      )}
    </div>
  )
}

// ── Unter-Editoren je Anlage ──────────────────────────────────────────────────
const subHead = { fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--text-muted)', marginBottom:'6px', display:'flex', alignItems:'center', gap:'6px' }
const miniInput = { ...inputStyle, padding:'5px 8px', fontSize:'12px' }
const addBtn = active => ({ padding:'5px 10px', borderRadius:'6px', border:'none', background: active ? '#4f46e5' : 'var(--border)', color:'#fff', fontSize:'11px', fontWeight:700, cursor: active ? 'pointer' : 'not-allowed', whiteSpace:'nowrap' })

// Eingaben: Positionen (Bezeichnung + Betrag, aufsummiert) mit Vorschlags-Kategorien
function PositionenEditor({ data, def, onPatch }) {
  const rows = Array.isArray(data.positionen) ? data.positionen : []
  const sum = rows.reduce((s, r) => s + parseBetrag(r.betrag), 0)
  const addRow = (label = '') => onPatch({ positionen: [...rows, { id: newId('p'), label, betrag: '' }] })
  const setRow = (id, patch) => onPatch({ positionen: rows.map(r => r.id === id ? { ...r, ...patch } : r) })
  const delRow = id => onPatch({ positionen: rows.filter(r => r.id !== id) })
  const offeneKats = (def?.kategorien ?? []).filter(k => !rows.some(r => r.label === k))
  return (
    <div>
      <div style={subHead}>🧮 Eingaben / Positionen</div>
      {offeneKats.length > 0 && (
        <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', marginBottom:'8px' }}>
          {offeneKats.map(k => (
            <span key={k} onClick={() => addRow(k)} style={{ ...chip(false), fontSize:'10px', padding:'3px 8px' }}>+ {k}</span>
          ))}
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'5px', marginBottom:'6px' }}>
          {rows.map(r => (
            <div key={r.id} style={{ display:'flex', gap:'6px', alignItems:'center' }}>
              <input value={r.label} onChange={e => setRow(r.id, { label: e.target.value })} placeholder="Bezeichnung"
                style={{ ...miniInput, flex:1 }} />
              <input value={r.betrag} onChange={e => setRow(r.id, { betrag: e.target.value })} placeholder="0,00" inputMode="decimal"
                style={{ ...miniInput, width:'110px', textAlign:'right' }} />
              <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>€</span>
              <button onClick={() => delRow(r.id)} title="Entfernen" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'12px' }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        <button onClick={() => addRow('')} style={{ ...chip(false), fontSize:'11px' }}>+ Position</button>
        {rows.length > 0 && (
          <span style={{ marginLeft:'auto', fontSize:'12px', fontWeight:700, color:'#4f46e5' }}>Summe: {eurFmt(sum)} €</span>
        )}
      </div>
    </div>
  )
}

// Eingaben: Kinder anlegen (mit Berücksichtigungsgrund ab 18)
function KinderEditor({ data, onPatch, stichjahr }) {
  const kinder = Array.isArray(data.kinder) ? data.kinder : []
  const add = () => onPatch({ kinder: [...kinder, { id: newId('k'), name: '', geburt: '', steuerId: '', kindergeld: false, grund: '' }] })
  const set = (id, patch) => onPatch({ kinder: kinder.map(k => k.id === id ? { ...k, ...patch } : k) })
  const del = id => onPatch({ kinder: kinder.filter(k => k.id !== id) })
  return (
    <div>
      <div style={subHead}>🧒 Kinder</div>
      <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'8px' }}>
        {kinder.map((k, i) => {
          const alter = calcAlter(k.geburt, stichjahr)
          const ueber18 = alter != null && alter >= 18
          return (
            <div key={k.id} style={{ border:'1px solid var(--border)', borderRadius:'8px', padding:'8px 10px', background:'var(--surface)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'6px' }}>
                <span style={{ fontSize:'11px', fontWeight:700, color:'#4f46e5' }}>Kind {i + 1}</span>
                {alter != null && (
                  <span style={{ fontSize:'10px', color: ueber18 ? '#d97706' : 'var(--text-muted)', fontWeight:600 }}>{alter} Jahre{ueber18 ? ' · über 18' : ''}</span>
                )}
                <button onClick={() => del(k.id)} title="Kind entfernen" style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'12px' }}>✕</button>
              </div>
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                <input value={k.name} onChange={e => set(k.id, { name: e.target.value })} placeholder="Name" style={{ ...miniInput, flex:2, minWidth:'120px' }} />
                <input type="date" value={k.geburt ?? ''} onChange={e => set(k.id, { geburt: e.target.value })} title="Geburtsdatum" style={{ ...miniInput, flex:1, minWidth:'130px' }} />
                <input value={k.steuerId} onChange={e => set(k.id, { steuerId: e.target.value })} placeholder="Steuer-IdNr." style={{ ...miniInput, flex:1, minWidth:'120px' }} />
              </div>
              <label style={{ display:'inline-flex', alignItems:'center', gap:'6px', marginTop:'6px', fontSize:'11px', color:'var(--text)', cursor:'pointer' }}>
                <input type="checkbox" checked={!!k.kindergeld} onChange={e => set(k.id, { kindergeld: e.target.checked })} style={{ accentColor:'#4f46e5', cursor:'pointer' }} />
                Kindergeld bezogen
              </label>
              {ueber18 && (
                <div style={{ marginTop:'6px' }}>
                  <span style={{ ...labelStyle, color:'#d97706', display:'block', marginBottom:'3px' }}>Berücksichtigungsgrund (ab 18)</span>
                  <select value={k.grund ?? ''} onChange={e => set(k.id, { grund: e.target.value })} style={{ ...miniInput, width:'100%' }}>
                    <option value="">— bitte wählen —</option>
                    {BERUECKSICHTIGUNG.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <button onClick={add} style={{ ...chip(false), fontSize:'11px' }}>+ Kind hinzufügen</button>
    </div>
  )
}

// Rückfragen an den Mandanten (offen/erledigt)
function RueckfragenEditor({ data, onPatch }) {
  const [neu, setNeu] = useState('')
  const items = Array.isArray(data.rueckfragen) ? data.rueckfragen : []
  const add = () => { const v = neu.trim(); if (!v) return; onPatch({ rueckfragen: [...items, { id: newId('rf'), text: v, erledigt: false }] }); setNeu('') }
  const set = (id, patch) => onPatch({ rueckfragen: items.map(r => r.id === id ? { ...r, ...patch } : r) })
  const del = id => onPatch({ rueckfragen: items.filter(r => r.id !== id) })
  return (
    <div>
      <div style={subHead}>❓ Rückfragen an den Mandanten</div>
      <div style={{ display:'flex', flexDirection:'column', gap:'5px', marginBottom:'6px' }}>
        {items.map(r => (
          <div key={r.id} style={{ display:'flex', gap:'8px', alignItems:'flex-start' }}>
            <input type="checkbox" checked={!!r.erledigt} onChange={() => set(r.id, { erledigt: !r.erledigt })} title="erledigt" style={{ accentColor:'#16a34a', cursor:'pointer', marginTop:'6px' }} />
            <textarea value={r.text} onChange={e => set(r.id, { text: e.target.value })} rows={1}
              style={{ ...miniInput, flex:1, resize:'vertical', textDecoration: r.erledigt ? 'line-through' : 'none', opacity: r.erledigt ? 0.6 : 1 }} />
            <button onClick={() => del(r.id)} title="Entfernen" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'12px', marginTop:'6px' }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:'6px' }}>
        <input value={neu} onChange={e => setNeu(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} placeholder="Neue Rückfrage…" style={{ ...miniInput, flex:1 }} />
        <button onClick={add} disabled={!neu.trim()} style={addBtn(!!neu.trim())}>+ Frage</button>
      </div>
    </div>
  )
}

// Fehlende Unterlagen zur Anlage
function FehlendEditor({ data, onPatch }) {
  const [neu, setNeu] = useState('')
  const items = Array.isArray(data.fehlend) ? data.fehlend : []
  const add = () => { const v = neu.trim(); if (!v) return; onPatch({ fehlend: [...items, { id: newId('fu'), label: v, checked: false }] }); setNeu('') }
  const set = (id, patch) => onPatch({ fehlend: items.map(f => f.id === id ? { ...f, ...patch } : f) })
  const del = id => onPatch({ fehlend: items.filter(f => f.id !== id) })
  return (
    <div>
      <div style={subHead}>📥 Fehlende Unterlagen</div>
      <div style={{ display:'flex', flexDirection:'column', gap:'5px', marginBottom:'6px' }}>
        {items.map(f => (
          <div key={f.id} style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            <input type="checkbox" checked={!!f.checked} onChange={() => set(f.id, { checked: !f.checked })} title="erhalten" style={{ accentColor:'#16a34a', cursor:'pointer' }} />
            <input value={f.label} onChange={e => set(f.id, { label: e.target.value })}
              style={{ ...miniInput, flex:1, textDecoration: f.checked ? 'line-through' : 'none', opacity: f.checked ? 0.6 : 1 }} />
            <button onClick={() => del(f.id)} title="Entfernen" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'12px' }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:'6px' }}>
        <input value={neu} onChange={e => setNeu(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} placeholder="Fehlende Unterlage…" style={{ ...miniInput, flex:1 }} />
        <button onClick={add} disabled={!neu.trim()} style={addBtn(!!neu.trim())}>+ Beleg</button>
      </div>
    </div>
  )
}

// ── Eine Anlage als aufklappbares Menü ────────────────────────────────────────
function AnlageItem({ label, def, data, onPatch, onRemove, expanded, onToggle, stichjahr }) {
  const kind = def?.kind ?? 'positionen'
  const rueckOffen = (data.rueckfragen ?? []).filter(r => !r.erledigt).length
  const fehlOffen  = (data.fehlend ?? []).filter(f => !f.checked).length
  const hatHinweis = !!(data.hinweise && data.hinweise.trim())
  const sum = (data.positionen ?? []).reduce((s, r) => s + parseBetrag(r.betrag), 0)
  const kinderN = (data.kinder ?? []).length
  return (
    <div style={{ border:`1px solid ${expanded ? 'rgba(79,70,229,0.4)' : 'var(--border)'}`, borderRadius:'8px', overflow:'hidden', background:'var(--surface)' }}>
      <div onClick={onToggle} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 10px', cursor:'pointer', background: expanded ? 'rgba(79,70,229,0.06)' : 'transparent', userSelect:'none' }}>
        <span style={{ fontSize:'15px' }}>{def?.icon ?? '📄'}</span>
        <span style={{ fontSize:'13px', fontWeight:700, color:'var(--text)' }}>{label}</span>
        <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', alignItems:'center' }}>
          {rueckOffen > 0 && <span style={{ fontSize:'10px', fontWeight:700, color:'#d97706', background:'rgba(217,119,6,0.1)', border:'1px solid rgba(217,119,6,0.3)', borderRadius:'8px', padding:'1px 6px' }}>❓ {rueckOffen}</span>}
          {fehlOffen > 0 && <span style={{ fontSize:'10px', fontWeight:700, color:'#dc2626', background:'rgba(220,38,38,0.1)', border:'1px solid rgba(220,38,38,0.3)', borderRadius:'8px', padding:'1px 6px' }}>📥 {fehlOffen}</span>}
          {hatHinweis && <span title="Hinweis vom Mandant vorhanden" style={{ fontSize:'10px' }}>💬</span>}
          {kind === 'positionen' && sum > 0 && <span style={{ fontSize:'10px', fontWeight:700, color:'#4f46e5' }}>{eurFmt(sum)} €</span>}
          {kind === 'kinder' && kinderN > 0 && <span style={{ fontSize:'10px', fontWeight:700, color:'#4f46e5' }}>{kinderN} Kind{kinderN !== 1 ? 'er' : ''}</span>}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'8px' }}>
          <button onClick={e => { e.stopPropagation(); if (window.confirm(`Anlage „${label}" entfernen? Die erfassten Eingaben gehen verloren.`)) onRemove() }}
            title="Anlage entfernen" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'12px' }}>✕</button>
          <span style={{ fontSize:'12px', color:'var(--text-muted)', transform: expanded ? 'rotate(90deg)' : 'none', transition:'transform 0.15s' }}>▸</span>
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop:'1px solid var(--border)', padding:'12px', display:'flex', flexDirection:'column', gap:'14px' }}>
          {def?.hint && <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'-2px' }}>{def.hint}</div>}
          {kind === 'kinder'
            ? <KinderEditor data={data} onPatch={onPatch} stichjahr={stichjahr} />
            : <PositionenEditor data={data} def={def} onPatch={onPatch} />}
          <RueckfragenEditor data={data} onPatch={onPatch} />
          <FehlendEditor data={data} onPatch={onPatch} />
          <div>
            <div style={subHead}>💬 Info &amp; Hinweise vom Mandant</div>
            <textarea value={data.hinweise ?? ''} onChange={e => onPatch({ hinweise: e.target.value })} rows={2}
              placeholder="Anmerkungen, Besonderheiten, mündliche Infos zu dieser Anlage…" style={{ ...miniInput, width:'100%', resize:'vertical', minHeight:'44px' }} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Anlagen-Akkordeon (aktive Anlagen als Menü + Hinzufügen) ──────────────────
function EStAnlagenAkkordeon({ au, onUpdate }) {
  const [openLabel, setOpenLabel] = useState(null)
  const [neu, setNeu] = useState('')
  const aktiv = Array.isArray(au.estAnlagen) ? au.estAnlagen : []
  const daten = au.estAnlagenData ?? {}
  const stichjahr = au.estVeranlagungsjahr

  const patchAnlage = (label, patch) => onUpdate({ estAnlagenData: { ...daten, [label]: { ...(daten[label] ?? {}), ...patch } } })
  const addAnlage = label => { if (!label || aktiv.includes(label)) return; onUpdate({ estAnlagen: [...aktiv, label] }); setOpenLabel(label) }
  const removeAnlage = label => {
    const nd = { ...daten }; delete nd[label]
    onUpdate({ estAnlagen: aktiv.filter(l => l !== label), estAnlagenData: nd })
    if (openLabel === label) setOpenLabel(null)
  }
  const addFrei = () => { const v = neu.trim(); if (!v) return; addAnlage(v); setNeu('') }
  const verfuegbar = ANLAGE_KATALOG.filter(a => !aktiv.includes(a.label))

  return (
    <div style={{ marginBottom:'16px', padding:'12px 14px', background:'var(--surface2)', borderRadius:'10px', border:'1px solid var(--border)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
        <span style={{ fontSize:'14px' }}>📎</span>
        <span style={{ fontSize:'12px', fontWeight:700, color:'var(--text)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Anlagen</span>
        {aktiv.length > 0 && <span style={{ marginLeft:'auto', fontSize:'11px', color:'var(--text-muted)' }}>{aktiv.length} aktiv · zum Öffnen anklicken</span>}
      </div>

      {aktiv.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'12px' }}>
          {aktiv.map(label => (
            <AnlageItem key={label} label={label} def={ANLAGE_BY_LABEL[label]} data={daten[label] ?? {}}
              onPatch={patch => patchAnlage(label, patch)} onRemove={() => removeAnlage(label)}
              expanded={openLabel === label} onToggle={() => setOpenLabel(openLabel === label ? null : label)} stichjahr={stichjahr} />
          ))}
        </div>
      )}

      <div style={{ fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--text-muted)', marginBottom:'6px' }}>Anlage hinzufügen</div>
      <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'8px' }}>
        {verfuegbar.map(a => (
          <span key={a.key} onClick={() => addAnlage(a.label)} title={a.hint} style={{ ...chip(false), fontSize:'11px' }}>
            <span>{a.icon}</span> + {a.label}
          </span>
        ))}
      </div>
      <div style={{ display:'flex', gap:'6px' }}>
        <input value={neu} onChange={e => setNeu(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addFrei() }}
          placeholder="Eigene Anlage (Freitext) – z. B. Anlage AUS, N-AUS, R…" style={{ ...inputStyle, flex:1 }} />
        <button onClick={addFrei} disabled={!neu.trim()} style={addBtn(!!neu.trim())}>+ Anlage</button>
      </div>
    </div>
  )
}

// ── Gebündelter ESt-Block (Stammdaten · Status · Anlagen-Akkordeon) ───────────
export default function EStAuftragSections({ au, onUpdate }) {
  return (
    <>
      <EStStammdatenBlock au={au} onUpdate={onUpdate} />
      <ESTStatusSection au={au} onUpdate={onUpdate} />
      <EStAnlagenAkkordeon au={au} onUpdate={onUpdate} />
    </>
  )
}

// Header-Badge-Konfiguration (für die Auftrags-Kopfzeile), analog JA.
export function estHeaderCfg(au) {
  const current = au.estWorkflowStatus ?? 'neu'
  return EST_WORKFLOW_STATUS[current] ?? au.estStatusSnap ?? EST_WORKFLOW_STATUS.neu
}
