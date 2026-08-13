import { useState, useMemo } from 'react'
import { AUFTRAGS_TYP_CFG, buildTypCfg } from './detail/AuftraegeTab.jsx'

/**
 * Leistungspool (Phase 4) – zentraler, erweiterbarer Katalog der Auftrags-/Leistungsarten.
 * - Eigene Arten anlegen/bearbeiten/entfernen (global, mit Icon & Farbe)
 * - Vorschlagsliste typischer Kanzlei-Leistungen (Ein-Klick-Aktivierung)
 * - Eingebaute Arten als Referenz (schreibgeschützt)
 * - Nutzungs-Überblick: welche Auftragsart wie oft (über alle Mandanten)
 *
 * Props: katalog (Array), onUpdate (setLeistungskatalog), clients (Array)
 * Eigene Katalog-Einträge: { key: 'eigen_<slug>', label, icon, color, bg, border }
 * Eigene Typen verhalten sich generisch wie 'freitext' (kein Spezial-Workflow).
 */

const ACCENT = '#9333ea'

// Farbpalette (color + passendes bg/border) – der Nutzer waehlt eine Farbe.
const FARBEN = [
  { color: '#2563eb', bg: 'rgba(37,99,235,0.08)',   border: 'rgba(37,99,235,0.25)' },
  { color: '#0891b2', bg: 'rgba(8,145,178,0.08)',   border: 'rgba(8,145,178,0.25)' },
  { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)',  border: 'rgba(124,58,237,0.25)' },
  { color: '#16a34a', bg: 'rgba(22,163,74,0.08)',   border: 'rgba(22,163,74,0.25)' },
  { color: '#f97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.25)' },
  { color: '#dc2626', bg: 'rgba(220,38,38,0.08)',   border: 'rgba(220,38,38,0.25)' },
  { color: '#d97706', bg: 'rgba(217,119,6,0.08)',   border: 'rgba(217,119,6,0.25)' },
  { color: '#0f766e', bg: 'rgba(15,118,110,0.08)',  border: 'rgba(15,118,110,0.25)' },
  { color: '#9333ea', bg: 'rgba(147,51,234,0.08)',  border: 'rgba(147,51,234,0.25)' },
  { color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.25)' },
]

// Kuratierte Vorschlaege typischer Kanzlei-Leistungen (Entdeckung).
const VORSCHLAEGE = [
  { label: 'Existenzgründungsberatung',      icon: '🚀', f: 0 },
  { label: 'Fördermittelberatung',           icon: '💰', f: 3 },
  { label: 'Bescheidprüfung',                icon: '🔍', f: 1 },
  { label: 'Einspruchsverfahren',            icon: '⚖️', f: 5 },
  { label: 'Betriebsprüfung-Begleitung',     icon: '🛡️', f: 6 },
  { label: 'BWA-/Controlling-Report',        icon: '📊', f: 2 },
  { label: 'Liquiditäts-/Finanzplanung',     icon: '💧', f: 1 },
  { label: 'Bankgespräch-Vorbereitung',      icon: '🏦', f: 0 },
  { label: 'Erbschaft-/Schenkungsteuer',     icon: '🏛️', f: 8 },
  { label: 'Vertragsprüfung (steuerlich)',   icon: '📜', f: 7 },
  { label: 'Selbstanzeige-Beratung',         icon: '🔐', f: 5 },
  { label: 'Reisekosten-/Bewirtung-Prüfung', icon: '🧳', f: 6 },
]

function slug(s) {
  return 'eigen_' + String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || ('eigen_' + Date.now().toString(36))
}

const card  = { border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--surface)', padding: '16px' }
const input = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '7px', background: 'var(--surface)', color: 'var(--text)', fontSize: '13px', boxSizing: 'border-box' }

export default function LeistungspoolBereich({ katalog = [], onUpdate, clients = [] }) {
  const [label, setLabel]     = useState('')
  const [icon, setIcon]       = useState('📝')
  const [farbeIdx, setFarbeIdx] = useState(8)
  const [editKey, setEditKey] = useState(null)

  const eigen = Array.isArray(katalog) ? katalog : []
  const effCfg = useMemo(() => buildTypCfg(eigen), [eigen])

  // Nutzung je Typ ueber alle Mandanten
  const nutzung = useMemo(() => {
    const m = {}
    for (const c of (clients ?? [])) {
      for (const a of (c.auftraege ?? [])) {
        const t = a?.typ || 'freitext'
        if (!m[t]) m[t] = { offen: 0, erledigt: 0, total: 0 }
        m[t].total++
        if (a.status === 'erledigt') m[t].erledigt++; else m[t].offen++
      }
    }
    return m
  }, [clients])
  const nutzungSort = useMemo(
    () => Object.entries(nutzung).sort((a, b) => b[1].total - a[1].total),
    [nutzung]
  )

  const vorhandeneKeys = new Set(eigen.map(k => k.key))

  function resetForm() { setLabel(''); setIcon('📝'); setFarbeIdx(8); setEditKey(null) }

  function speichern() {
    const name = label.trim()
    if (!name) return
    const f = FARBEN[farbeIdx] ?? FARBEN[9]
    if (editKey) {
      onUpdate(eigen.map(k => k.key === editKey
        ? { ...k, label: name, icon: icon || '📝', color: f.color, bg: f.bg, border: f.border }
        : k))
    } else {
      let key = slug(name)
      // Kollision mit eingebauten oder vorhandenen vermeiden
      let i = 2
      while (AUFTRAGS_TYP_CFG[key] || vorhandeneKeys.has(key)) { key = slug(name) + '_' + i++ }
      onUpdate([...eigen, { key, label: name, icon: icon || '📝', color: f.color, bg: f.bg, border: f.border }])
    }
    resetForm()
  }

  function bearbeiten(k) {
    setEditKey(k.key); setLabel(k.label); setIcon(k.icon || '📝')
    const idx = FARBEN.findIndex(f => f.color === k.color)
    setFarbeIdx(idx >= 0 ? idx : 8)
  }

  function entfernen(key) {
    onUpdate(eigen.filter(k => k.key !== key))
    if (editKey === key) resetForm()
  }

  function vorschlagHinzufuegen(v) {
    const key = slug(v.label)
    if (AUFTRAGS_TYP_CFG[key] || vorhandeneKeys.has(key)) return
    const f = FARBEN[v.f] ?? FARBEN[9]
    onUpdate([...eigen, { key, label: v.label, icon: v.icon, color: f.color, bg: f.bg, border: f.border }])
  }

  const eingebaut = Object.entries(AUFTRAGS_TYP_CFG)

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text)' }}>🗂 Leistungspool</h1>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
          Dein zentraler Katalog der Auftrags- und Leistungsarten. Eigene Arten gelten überall in der App und
          verhalten sich wie „Eigener Auftrag" (kein Spezial-Ablauf – den behalten nur Jahresabschluss, Lohn und Etablering).
        </p>
      </div>

      {/* Eigene Arten anlegen / bearbeiten */}
      <div style={card}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: ACCENT, marginBottom: '12px' }}>
          {editKey ? '✏️ Eigene Leistungsart bearbeiten' : '➕ Eigene Leistungsart anlegen'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: '10px', alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Icon</div>
            <input value={icon} onChange={e => setIcon(e.target.value)} maxLength={4}
              style={{ ...input, textAlign: 'center', fontSize: '20px', padding: '5px' }} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Bezeichnung</div>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="z. B. Fördermittelberatung"
              onKeyDown={e => e.key === 'Enter' && speichern()} style={input} />
          </div>
        </div>
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>Farbe</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {FARBEN.map((f, i) => (
              <button key={i} onClick={() => setFarbeIdx(i)} title="Farbe wählen"
                style={{ width: '26px', height: '26px', borderRadius: '50%', background: f.color, cursor: 'pointer',
                         border: farbeIdx === i ? '3px solid var(--text)' : '2px solid var(--border)' }} />
            ))}
          </div>
        </div>
        {/* Vorschau */}
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Vorschau:</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px',
                         background: (FARBEN[farbeIdx] ?? FARBEN[9]).bg, border: `1px solid ${(FARBEN[farbeIdx] ?? FARBEN[9]).border}`,
                         color: (FARBEN[farbeIdx] ?? FARBEN[9]).color, fontSize: '12px', fontWeight: 700 }}>
            {icon} {label.trim() || 'Bezeichnung…'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
          {editKey && <button onClick={resetForm} style={{ padding: '7px 14px', borderRadius: '7px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}>Abbrechen</button>}
          <button onClick={speichern} disabled={!label.trim()}
            style={{ padding: '7px 18px', borderRadius: '7px', border: 'none', background: label.trim() ? ACCENT : 'var(--border)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: label.trim() ? 'pointer' : 'not-allowed' }}>
            {editKey ? 'Speichern' : 'Anlegen'}
          </button>
        </div>
      </div>

      {/* Eigene Arten – Liste */}
      <div style={card}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)', marginBottom: '12px' }}>
          Deine Leistungsarten <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>({eigen.length})</span>
        </div>
        {eigen.length === 0
          ? <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Noch keine eigenen Arten. Lege oben eine an oder übernimm einen Vorschlag.</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {eigen.map(k => (
                <div key={k.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: k.bg, border: `1px solid ${k.border}` }}>
                  <span style={{ fontSize: '18px' }}>{k.icon}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: '13px', fontWeight: 700, color: k.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.label}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{nutzung[k.key]?.total ?? 0}× genutzt</span>
                  <button onClick={() => bearbeiten(k)} title="Bearbeiten" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>✏️</button>
                  <button onClick={() => entfernen(k.key)} title={nutzung[k.key]?.total ? 'Wird noch verwendet – bestehende Aufträge behalten den Typ' : 'Entfernen'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)' }}>🗑</button>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Vorschlaege */}
      <div style={card}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)', marginBottom: '4px' }}>💡 Vorschläge – typische Kanzlei-Leistungen</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>Ein Klick übernimmt sie in deinen Katalog. Vielleicht ist etwas dabei, das du bisher nicht angeboten hast.</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {VORSCHLAEGE.map(v => {
            const drin = vorhandeneKeys.has(slug(v.label))
            return (
              <button key={v.label} onClick={() => vorschlagHinzufuegen(v)} disabled={drin}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px',
                         border: `1px solid ${(FARBEN[v.f] ?? FARBEN[9]).border}`, background: drin ? 'var(--surface2)' : (FARBEN[v.f] ?? FARBEN[9]).bg,
                         color: drin ? 'var(--text-muted)' : (FARBEN[v.f] ?? FARBEN[9]).color, fontSize: '12px', fontWeight: 700,
                         cursor: drin ? 'default' : 'pointer', opacity: drin ? 0.6 : 1 }}>
                {v.icon} {v.label} {drin ? '✓' : '+'}
              </button>
            )
          })}
        </div>
      </div>

      {/* Nutzungs-Ueberblick */}
      <div style={card}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)', marginBottom: '12px' }}>📊 Nutzung – welche Art wie oft (alle Mandanten)</div>
        {nutzungSort.length === 0
          ? <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Noch keine Aufträge erfasst.</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {nutzungSort.map(([typ, n]) => {
                const c = effCfg[typ] ?? effCfg.freitext
                const maxTotal = nutzungSort[0][1].total || 1
                return (
                  <div key={typ} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                    <span style={{ width: '190px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <span>{c.icon}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{c.label}</span>
                    </span>
                    <div style={{ flex: 1, height: '10px', background: 'var(--surface2)', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round((n.total / maxTotal) * 100)}%`, height: '100%', background: c.color, borderRadius: '5px' }} />
                    </div>
                    <span style={{ width: '120px', flexShrink: 0, textAlign: 'right', color: 'var(--text-muted)' }}>
                      <b style={{ color: 'var(--text)' }}>{n.total}</b> · {n.offen} offen · {n.erledigt} erl.
                    </span>
                  </div>
                )
              })}
            </div>
          )}
      </div>

      {/* Eingebaute Arten – Referenz */}
      <div style={card}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)', marginBottom: '4px' }}>Eingebaute Arten <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>({eingebaut.length})</span></div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>Fest vorhanden (teils mit Spezial-Ablauf). Nur zur Übersicht – nicht änderbar.</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {eingebaut.map(([key, c]) => (
            <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: c.bg, border: `1px solid ${c.border}`, color: c.color, fontSize: '11px', fontWeight: 700 }}>
              {c.icon} {c.label}{c.gruppe === 'etablering' ? ' ·⚙' : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
