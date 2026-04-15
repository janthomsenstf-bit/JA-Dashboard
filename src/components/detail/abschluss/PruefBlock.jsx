import { useState, useMemo } from 'react'
import { PUNKT_STATUS, RISIKO_CONFIG } from '../../../utils/checklisteConfig.js'
import { RECHNER_TEMPLATES, TEMPLATE_LIST, fmtEur, parseZ, newInstanz, newFahrzeug, berechneFahrzeug } from '../../../utils/rechnerConfig.js'
import KfzRechnerSlideIn from '../rechner/KfzRechnerSlideIn.jsx'

// ── KI-Helfer: Rückfrage-Formulierung ────────────────────────────────────────
async function callClaudeRueckfrage(stichpunkt) {
  const key = (localStorage.getItem('sda-claude-api-key') ?? '').replace(/\s/g, '')
  if (!key) throw new Error('Kein Claude API-Schlüssel hinterlegt (Tab Stammdaten → API-Schlüssel).')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      system: 'Du bist Steuerberater-Assistent. Formuliere aus dem Stichpunkt eine höfliche, professionelle Rückfrage an den Mandanten. Antworte NUR mit dem fertigen Satz, keine Erklärungen.',
      messages: [{ role: 'user', content: stichpunkt }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `HTTP ${res.status}`)
  }
  const d = await res.json()
  return (d.content?.[0]?.text ?? '').trim()
}

// ── Sortierlogik ─────────────────────────────────────────────────────────────
function sortScore(data) {
  if (data?.relevant === false) return 30       // ganz unten: NEIN
  const st = data?.status ?? 'offen'
  if (st === 'erledigt') return 20              // fast unten: erledigt
  if (data?.relevant === true) return 0         // oben: JA + offen
  return 10                                     // mitte: undecided + offen
}

// ── Datenmodell-Hilfsfunktionen ───────────────────────────────────────────────
// Normalisiert altes Format { notiz, konto } → neues Format { eintraege: [{id,konto,notiz}] }
// Garantiert immer mindestens einen Eintrag.
function normalizeEintraege(data) {
  if (Array.isArray(data?.eintraege) && data.eintraege.length > 0) return data.eintraege
  // Legacy-Migration: vorhandene notiz/konto-Felder in ersten Eintrag überführen
  return [{ id: 'e0', konto: data?.konto ?? '', notiz: data?.notiz ?? '' }]
}

// Für den Export und den Header-Preview: liefert den ersten Konto-/Notiz-Wert
export function getPunktPreview(data) {
  const eintraege = normalizeEintraege(data)
  return { konto: eintraege[0]?.konto ?? '', notiz: eintraege[0]?.notiz ?? '', count: eintraege.length }
}

// ── Inline-Rechner im Prüfpunkt ──────────────────────────────────────────────
function InlineRechner({ blockId, punktId, rechnerData, onRechnerUpdate, onBefundUebernehmen }) {
  const linked = (rechnerData ?? []).filter(r => r.blockId === blockId && r.punktId === punktId)
  const [showPicker, setShowPicker] = useState(false)
  const [kfzOpenId, setKfzOpenId]   = useState(null)   // welcher KFZ-SlideIn ist offen

  function createAndSave(templateKey) {
    const inst = newInstanz(templateKey, null)
    inst.blockId = blockId
    inst.punktId = punktId
    if (templateKey === 'kfzNutzung') {
      inst.felder = { fahrzeuge: [newFahrzeug()] }
      try {
        const saved = JSON.parse(localStorage.getItem('kfz-buchungshinweise-defaults'))
        if (saved) inst.buchungshinweise = { ...inst.buchungshinweise, ...saved }
      } catch {}
    }
    onRechnerUpdate([...(rechnerData ?? []), inst])
    setShowPicker(false)
    if (templateKey === 'kfzNutzung') setKfzOpenId(inst.id)
  }

  function updateLinked(updated) {
    onRechnerUpdate((rechnerData ?? []).map(r => r.id === updated.id ? updated : r))
  }

  function deleteLinked(id) {
    onRechnerUpdate((rechnerData ?? []).filter(r => r.id !== id))
    if (kfzOpenId === id) setKfzOpenId(null)
  }

  const kfzSlideInInst = linked.find(r => r.id === kfzOpenId) ?? null

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '2px' }}>
      {/* KFZ-SlideIn */}
      {kfzSlideInInst && (
        <KfzRechnerSlideIn
          instanz={kfzSlideInInst}
          onSave={updateLinked}
          onClose={() => setKfzOpenId(null)}
          onBefundUebernehmen={onBefundUebernehmen}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: linked.length > 0 ? '6px' : '0' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>🔢 Berechnungen</span>
        <button onClick={() => setShowPicker(p => !p)}
          style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '5px', border: '1px solid rgba(37,99,235,0.35)', background: 'rgba(37,99,235,0.07)', color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>
          + Hinzufügen
        </button>
      </div>

      {/* Template-Picker */}
      {showPicker && (
        <div style={{ padding: '8px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid rgba(37,99,235,0.2)', marginBottom: '6px' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px' }}>Vorlage wählen:</div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {TEMPLATE_LIST.map(tpl => (
              <button key={tpl.key} onClick={() => createAndSave(tpl.key)}
                style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span>{tpl.icon}</span><span>{tpl.label}</span>
              </button>
            ))}
            <button onClick={() => setShowPicker(false)}
              style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '5px', border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 'auto' }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Verknüpfte Berechnungen */}
      {linked.map(inst => {
        const isKfz = inst.templateKey === 'kfzNutzung'
        const tpl   = RECHNER_TEMPLATES[inst.templateKey]

        // KFZ: eigenes Rendering mit "Öffnen"-Button
        if (isKfz) {
          const fahrzeuge = inst.felder?.fahrzeuge ?? []
          const gesamt    = fahrzeuge.reduce((s, fz) => { try { return s + berechneFahrzeug(fz).jahreswert } catch { return s } }, 0)
          return (
            <div key={inst.id} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(217,119,6,0.25)', background: 'rgba(217,119,6,0.04)', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: fahrzeuge.length > 0 ? '4px' : '0' }}>
                <span style={{ fontSize: '13px', flexShrink: 0 }}>🚗</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)' }}>{inst.name}</div>
                  <div style={{ fontSize: '10px', color: '#d97706', fontWeight: 700 }}>
                    Gesamt: {fmtEur(gesamt)} · {fahrzeuge.length} Fahrzeug{fahrzeuge.length !== 1 ? 'e' : ''}
                  </div>
                </div>
                <button onClick={() => setKfzOpenId(inst.id)}
                  style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '5px', border: '1px solid rgba(217,119,6,0.4)', background: 'rgba(217,119,6,0.08)', color: '#d97706', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>
                  🚗 Öffnen
                </button>
                <button onClick={() => deleteLinked(inst.id)} title="Verknüpfung entfernen"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', opacity: 0.5, fontSize: '11px', flexShrink: 0, padding: '1px 3px' }}
                  onMouseEnter={e => e.currentTarget.style.opacity='1'} onMouseLeave={e => e.currentTarget.style.opacity='0.5'}>✕</button>
              </div>
              {inst.befund && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(217,119,6,0.15)' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.befund}</span>
                  <button onClick={() => onBefundUebernehmen(inst.befund)}
                    style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(22,163,74,0.4)', background: 'rgba(22,163,74,0.07)', color: '#16a34a', cursor: 'pointer', flexShrink: 0, fontWeight: 600 }}>
                    ↩ in Notiz
                  </button>
                </div>
              )}
            </div>
          )
        }

        // Standard-Rechner
        let hauptWert = null
        try {
          const erg = tpl?.berechnung?.(inst.felder ?? {}) ?? []
          hauptWert = erg.find(e => e.hervorgehoben)
        } catch {}
        return (
          <div key={inst.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '6px', border: '1px solid rgba(37,99,235,0.2)', background: 'rgba(37,99,235,0.04)', marginBottom: '4px' }}>
            <span style={{ fontSize: '13px', flexShrink: 0 }}>{tpl?.icon ?? '🔢'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.name}</div>
              {hauptWert && (
                <div style={{ fontSize: '10px', color: hauptWert.farbe === 'rot' ? '#dc2626' : hauptWert.farbe === 'gruen' ? '#16a34a' : '#d97706', fontWeight: 700 }}>
                  {hauptWert.label}: {hauptWert.einheit === '€' ? fmtEur(hauptWert.wert) : (hauptWert.wert?.toLocaleString?.('de-DE') ?? '–') + ' ' + (hauptWert.einheit ?? '')}
                </div>
              )}
              {inst.befund && <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.befund}</div>}
            </div>
            {inst.befund && (
              <button onClick={() => onBefundUebernehmen(inst.befund)} title="Befund in Notiz übernehmen"
                style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(22,163,74,0.4)', background: 'rgba(22,163,74,0.07)', color: '#16a34a', cursor: 'pointer', flexShrink: 0, fontWeight: 600 }}>
                ↩ in Notiz
              </button>
            )}
            <button onClick={() => deleteLinked(inst.id)} title="Verknüpfung entfernen"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', opacity: 0.5, fontSize: '11px', flexShrink: 0, padding: '1px 3px' }}
              onMouseEnter={e => e.currentTarget.style.opacity='1'} onMouseLeave={e => e.currentTarget.style.opacity='0.5'}>✕</button>
          </div>
        )
      })}
    </div>
  )
}

// ── PruefPunkt (inline) ──────────────────────────────────────────────────────
function PruefPunkt({ blockId, punktCfg, data, blockDisabled, onUpdate, onAddRueckfrage, rechnerData, onRechnerUpdate }) {
  const [expanded, setExpanded] = useState(false)

  const relevant    = data?.relevant ?? null   // null | true | false
  const status      = data?.status  ?? 'offen'
  const risiko      = data?.risiko  ?? null
  const eintraege      = normalizeEintraege(data)  // immer ≥1 Eintrag
  const rueckfrageText = data?.rueckfrageText ?? ''
  const [kiLoading, setKiLoading] = useState(false)

  const isNein      = relevant === false || blockDisabled
  const isErledigt  = status === 'erledigt'
  const isRueckfrage = status === 'rueckfrage'

  // Kern-Update: schreibt immer das neue eintraege-Format zurück
  function updPunkt(changes) {
    onUpdate(blockId, punktCfg.id, { status, risiko, relevant, eintraege, rueckfrageText, ...changes })
  }

  // Einzelnen Eintrag bearbeiten
  function updEintrag(idx, field, value) {
    const next = eintraege.map((e, i) => i === idx ? { ...e, [field]: value } : e)
    updPunkt({ eintraege: next })
  }

  // Neuen leeren Eintrag anfügen
  function addEintrag() {
    const next = [...eintraege, { id: 'e' + Date.now().toString(36), konto: '', notiz: '' }]
    updPunkt({ eintraege: next })
  }

  // Eintrag entfernen (mindestens 1 muss bleiben)
  function removeEintrag(idx) {
    if (eintraege.length <= 1) return
    const next = eintraege.filter((_, i) => i !== idx)
    updPunkt({ eintraege: next })
  }

  // KI: Rückfrage-Text formulieren lassen
  async function handleKiRueckfrage() {
    if (!rueckfrageText.trim()) return
    setKiLoading(true)
    try {
      const result = await callClaudeRueckfrage(rueckfrageText)
      updPunkt({ rueckfrageText: result })
    } catch (e) {
      alert('KI-Fehler: ' + e.message)
    } finally {
      setKiLoading(false)
    }
  }

  const statusOrder  = ['geprueft', 'rueckfrage', 'erledigt']
  const firstEintrag = eintraege[0]
  const hasMultiple  = eintraege.length > 1
  const eintraegePreview = hasMultiple ? (() => {
    const k = eintraege.slice(0, 2).map(e => e.konto).filter(Boolean)
    return `${eintraege.length} Einträge${k.length ? ' · ' + k.join(', ') + (eintraege.length > 2 ? ', …' : '') : ''}`
  })() : null

  const rowBg = isNein ? 'transparent'
              : isErledigt   ? 'rgba(22,163,74,0.06)'
              : isRueckfrage ? 'rgba(217,119,6,0.04)'
              : 'var(--surface)'
  const rowBorder = isNein ? 'var(--border)'
                  : isErledigt   ? 'rgba(22,163,74,0.25)'
                  : isRueckfrage ? 'rgba(217,119,6,0.25)'
                  : 'var(--border)'

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '6px 10px',
    borderRadius: '6px', border: '1px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text)', fontSize: '12px',
  }

  return (
    <div style={{ border: `1px solid ${rowBorder}`, borderRadius: '8px', background: rowBg, marginBottom: '4px', overflow: 'hidden', opacity: isNein ? 0.38 : 1, transition: 'all 0.15s' }}>

      {/* ── Header-Zeile ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px' }}>

        {/* JA / NEIN Relevanz-Schalter */}
        <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => updPunkt({ relevant: relevant === true ? null : true })} disabled={blockDisabled}
            title="Relevant (JA)"
            style={{ padding: '2px 7px', borderRadius: '4px 0 0 4px', fontSize: '10px', fontWeight: 700, cursor: blockDisabled ? 'not-allowed' : 'pointer',
              border: `1px solid ${relevant === true ? '#16a34a' : 'var(--border)'}`, borderRight: 'none',
              background: relevant === true ? 'rgba(22,163,74,0.18)' : 'transparent',
              color: relevant === true ? '#16a34a' : 'var(--text-muted)', transition: 'all 0.12s' }}>
            JA
          </button>
          <button onClick={() => updPunkt({ relevant: relevant === false ? null : false })} disabled={blockDisabled}
            title="Nicht relevant (NEIN)"
            style={{ padding: '2px 7px', borderRadius: '0 4px 4px 0', fontSize: '10px', fontWeight: 700, cursor: blockDisabled ? 'not-allowed' : 'pointer',
              border: `1px solid ${relevant === false ? '#94a3b8' : 'var(--border)'}`,
              background: relevant === false ? 'rgba(148,163,184,0.15)' : 'transparent',
              color: relevant === false ? '#64748b' : 'var(--text-muted)', transition: 'all 0.12s' }}>
            NEIN
          </button>
        </div>

        {/* Status-Chips */}
        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {statusOrder.map(s => {
            const sc = PUNKT_STATUS[s]; const active = status === s
            return (
              <button key={s} onClick={() => { if (!isNein) updPunkt({ status: active ? 'offen' : s }) }}
                disabled={isNein} title={sc.label}
                style={{ width: '23px', height: '23px', borderRadius: '50%', cursor: isNein ? 'not-allowed' : 'pointer', fontSize: '10px',
                  border: `1.5px solid ${active ? sc.color : 'var(--border)'}`,
                  background: active ? sc.color : 'transparent',
                  color: active ? '#fff' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s', fontWeight: 700 }}>
                {sc.icon}
              </button>
            )
          })}
        </div>

        {/* Label + Preview-Infos */}
        <span onClick={() => !isNein && setExpanded(e => !e)}
          style={{ flex: 1, fontSize: '12.5px', fontWeight: 500, color: isNein ? 'var(--text-muted)' : 'var(--text)',
            cursor: isNein ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', minWidth: 0 }}>
          {isErledigt && !isNein && (
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '6px', background: 'rgba(22,163,74,0.15)', color: '#16a34a', flexShrink: 0 }}>✓ ERLEDIGT</span>
          )}
          <span style={{ color: isErledigt && !isNein ? '#16a34a' : isNein ? 'var(--text-muted)' : 'var(--text)' }}>
            {punktCfg.label}
          </span>
          {/* Konto-Preview (erster Eintrag) */}
          {firstEintrag?.konto && !expanded && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--surface2)', padding: '0 5px', borderRadius: '5px', border: '1px solid var(--border)', flexShrink: 0 }}>
              Kto. {firstEintrag.konto}
            </span>
          )}
          {/* Mehrfach-Einträge Badge */}
          {hasMultiple && !expanded && (
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '0 6px', borderRadius: '5px', background: 'rgba(37,99,235,0.1)', color: '#2563eb', flexShrink: 0 }}>
              {eintraegePreview}
            </span>
          )}
          {risiko && !isNein && (
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '0 5px', borderRadius: '5px', background: RISIKO_CONFIG[risiko].bg, color: RISIKO_CONFIG[risiko].color, flexShrink: 0 }}>
              {RISIKO_CONFIG[risiko].label}
            </span>
          )}
          {/* Notiz-Preview (erster Eintrag) */}
          {firstEintrag?.notiz && !expanded && !isNein && !hasMultiple && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              · {firstEintrag.notiz.slice(0, 55)}{firstEintrag.notiz.length > 55 ? '…' : ''}
            </span>
          )}
          {/* Rückfrage-Text Preview (collapsed) */}
          {rueckfrageText && !expanded && !isNein && (
            <span style={{
              fontSize: '10px', fontWeight: 600, padding: '0 6px', borderRadius: '5px',
              background: 'rgba(217,119,6,0.12)', color: '#d97706',
              flexShrink: 0, maxWidth: '180px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              ❓ {rueckfrageText.slice(0, 45)}{rueckfrageText.length > 45 ? '…' : ''}
            </span>
          )}
          {punktCfg.hinweis && !isNein && (
            <span title={punktCfg.hinweis} style={{ fontSize: '12px', cursor: 'help', flexShrink: 0 }}>💡</span>
          )}
        </span>

        {!isNein && (
          <span onClick={() => setExpanded(e => !e)} style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0, cursor: 'pointer', padding: '2px 4px' }}>
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </div>

      {/* Hint-Zeile */}
      {punktCfg.hinweis && relevant === true && !expanded && (
        <div style={{ padding: '3px 10px 5px 68px', fontSize: '10.5px', color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
          💡 {punktCfg.hinweis}
        </div>
      )}

      {/* ── Detail-Bereich ── */}
      {expanded && !isNein && (
        <div style={{ padding: '10px 10px', borderTop: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Hinweis-Box */}
          {punktCfg.hinweis && (
            <div style={{ padding: '6px 10px', background: 'rgba(37,99,235,0.06)', borderRadius: '6px', border: '1px solid rgba(37,99,235,0.15)', fontSize: '11px', color: 'var(--text-muted)' }}>
              💡 {punktCfg.hinweis}
            </div>
          )}

          {/* ── Konto-/Notiz-Einträge ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {eintraege.map((eintrag, idx) => (
              <div key={eintrag.id ?? idx} style={{
                display: 'grid',
                gridTemplateColumns: punktCfg.hasKonto ? '140px 1fr auto' : '1fr auto',
                gap: '6px',
                alignItems: 'flex-end',
                padding: hasMultiple ? '8px 10px' : '0',
                background: hasMultiple ? 'rgba(0,0,0,0.025)' : 'transparent',
                borderRadius: hasMultiple ? '6px' : '0',
                border: hasMultiple ? '1px solid var(--border)' : 'none',
              }}>
                {punktCfg.hasKonto && (
                  <div>
                    {idx === 0 && <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>🔢 Konto</label>}
                    {idx > 0 && <div style={{ height: '17px' }} />}
                    <input type="text" value={eintrag.konto} onChange={e => updEintrag(idx, 'konto', e.target.value)}
                      placeholder="z.B. 8400"
                      style={inputStyle} />
                  </div>
                )}
                <div>
                  {idx === 0 && <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>📝 Notiz / Befund</label>}
                  {idx > 0 && <div style={{ height: '17px' }} />}
                  <textarea value={eintrag.notiz} onChange={e => updEintrag(idx, 'notiz', e.target.value)}
                    placeholder="Erläuterung, Befund, Hinweis…"
                    rows={2}
                    style={{
                      ...inputStyle,
                      resize: 'vertical',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflowX: 'hidden',
                      lineHeight: '1.4',
                      fontFamily: 'inherit',
                      minHeight: '42px',
                    }} />
                </div>
                {/* Löschen-Button — nur sichtbar wenn mehr als 1 Eintrag */}
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '1px' }}>
                  {eintraege.length > 1 ? (
                    <button onClick={() => removeEintrag(idx)} title="Eintrag entfernen"
                      style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: '#ef4444', cursor: 'pointer', fontSize: '12px', lineHeight: 1 }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.14)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)' }}>
                      🗑
                    </button>
                  ) : (
                    <div style={{ width: '32px' }} /> // Platzhalter für Ausrichtung
                  )}
                </div>
              </div>
            ))}

            {/* + Hinzufügen-Button */}
            <button onClick={addEintrag}
              style={{ alignSelf: 'flex-start', marginTop: '2px', padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                border: '1px solid rgba(37,99,235,0.35)', background: 'rgba(37,99,235,0.07)', color: '#2563eb' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,99,235,0.14)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,99,235,0.07)' }}>
              + Eintrag hinzufügen
            </button>
          </div>

          {/* ── Rückfrage-Text + KI-Button ── */}
          <div style={{
            padding: '10px',
            background: isRueckfrage ? 'rgba(217,119,6,0.05)' : 'rgba(0,0,0,0.02)',
            border: isRueckfrage ? '1px solid rgba(217,119,6,0.3)' : '1px solid var(--border)',
            borderRadius: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: isRueckfrage ? '#d97706' : 'var(--text-muted)', flex: 1 }}>
                ❓ Rückfrage an Mandant
              </label>
              <button
                onClick={handleKiRueckfrage}
                disabled={kiLoading || !rueckfrageText.trim()}
                title="Stichpunkt per KI in professionelle Rückfrage umformulieren"
                style={{
                  fontSize: '10px', padding: '3px 9px', borderRadius: '5px',
                  border: '1px solid rgba(124,58,237,0.4)',
                  background: kiLoading ? 'rgba(124,58,237,0.04)' : 'rgba(124,58,237,0.08)',
                  color: '#7c3aed', cursor: (!rueckfrageText.trim() || kiLoading) ? 'not-allowed' : 'pointer',
                  fontWeight: 700, opacity: (!rueckfrageText.trim() || kiLoading) ? 0.45 : 1,
                  display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.12s',
                }}
                onMouseEnter={e => { if (rueckfrageText.trim() && !kiLoading) e.currentTarget.style.background = 'rgba(124,58,237,0.15)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.08)' }}
              >
                {kiLoading ? '⏳' : '🤖'} KI formulieren
              </button>
            </div>
            <textarea
              value={rueckfrageText}
              onChange={e => updPunkt({ rueckfrageText: e.target.value })}
              placeholder="Stichpunkte eingeben → KI formuliert daraus eine Rückfrage. Z.B.: Betrag 1520 unklar, Beleg fehlt"
              rows={2}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '6px 10px',
                borderRadius: '6px',
                border: isRueckfrage ? '1px solid rgba(217,119,6,0.45)' : '1px solid var(--border)',
                background: isRueckfrage ? 'rgba(255,255,255,0.6)' : 'var(--surface)',
                color: 'var(--text)', fontSize: '12px',
                resize: 'vertical', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                overflowX: 'hidden', lineHeight: '1.5', fontFamily: 'inherit', minHeight: '44px',
              }}
            />
          </div>

          {/* Risikobewertung */}
          {punktCfg.hasRisiko && (
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>⚡ Risikobewertung</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[null, 'niedrig', 'mittel', 'hoch'].map(r => {
                  const rc = r ? RISIKO_CONFIG[r] : null; const active = risiko === r
                  return (
                    <button key={r ?? 'kein'} onClick={() => updPunkt({ risiko: r })}
                      style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer', fontWeight: active ? 700 : 400,
                        border: `1px solid ${active && rc ? rc.color : 'var(--border)'}`,
                        background: active && rc ? rc.bg : 'transparent',
                        color: active && rc ? rc.color : 'var(--text-muted)' }}>
                      {r ? rc.label : 'Kein Risiko'}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Rückfrage-Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => onAddRueckfrage({ blockId, punktId: punktCfg.id, punktLabel: punktCfg.label, konto: firstEintrag?.konto ?? '', notiz: firstEintrag?.notiz ?? '' })}
              style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '6px', border: '1px solid rgba(217,119,6,0.4)', background: 'rgba(217,119,6,0.07)', color: '#d97706', cursor: 'pointer', fontWeight: 600 }}>
              ❓ Rückfrage hinzufügen
            </button>
          </div>

          {/* Inline-Rechner */}
          {onRechnerUpdate && (
            <InlineRechner
              blockId={blockId}
              punktId={punktCfg.id}
              rechnerData={rechnerData}
              onRechnerUpdate={onRechnerUpdate}
              onBefundUebernehmen={text => updEintrag(0, 'notiz', text)}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Hilfsfunktion: Block-Fertig-Logik (exportiert für ChecklisteView-Sortierung) ──
// Ein Punkt gilt als „abgeschlossen", wenn: relevant===false ODER status==='erledigt'.
// Ein Punkt gilt als „offen", wenn er weder erledigt noch explizit als nicht relevant markiert ist.
export function computeBlockStats(blockCfg, allPunkteData, isBlockNein) {
  const punkte = blockCfg.punkte ?? []
  const acc = { total: punkte.length, offen: 0, erledigt: 0, nichtRelevant: 0 }
  if (isBlockNein) { acc.nichtRelevant = acc.total; return acc }
  for (const p of punkte) {
    const d = allPunkteData[`${blockCfg.id}_${p.id}`] ?? {}
    if (d.relevant === false)        { acc.nichtRelevant++; continue }
    if (d.status === 'erledigt')     { acc.erledigt++;      continue }
    acc.offen++
  }
  return acc
}

// ── PruefBlock ────────────────────────────────────────────────────────────────
export default function PruefBlock({ blockCfg, allPunkteData, blockRelevanz, onUpdatePunkt, onSetBlockRelevanz, onAddRueckfrage, toolContent, rechnerData, onRechnerUpdate }) {
  const [collapsed, setCollapsed] = useState(true)

  const punkte      = blockCfg.punkte ?? []
  const isBlockNein = blockRelevanz === false
  const isBlockJa   = blockRelevanz === true

  // ── Abschluss-Logik ────────────────────────────────────────────────────────
  // offen = relevant !== false UND nicht erledigt
  // abgeschlossen = erledigt ODER relevant === false
  const stats = computeBlockStats(blockCfg, allPunkteData, isBlockNein)

  // Block gilt als fertig, wenn kein Prüfpunkt offen ist (und mindestens 1 Punkt vorhanden)
  const isBlockFertig = !isBlockNein && stats.total > 0 && stats.offen === 0

  // Fortschritt = (erledigt + nichtRelevant) / total
  const pct = stats.total > 0 ? Math.round((stats.erledigt + stats.nichtRelevant) / stats.total * 100) : 0

  const hasHigh  = !isBlockNein && punkte.some(p => allPunkteData[`${blockCfg.id}_${p.id}`]?.risiko === 'hoch')
  const offeneRQ = !isBlockNein ? punkte.filter(p =>
    (allPunkteData[`${blockCfg.id}_${p.id}`]?.status ?? 'offen') === 'rueckfrage' &&
    allPunkteData[`${blockCfg.id}_${p.id}`]?.relevant !== false
  ).length : 0

  // Sort: offen+relevant=true first, then null+offen, then erledigt, then NEIN
  const sortedPunkte = [...punkte].sort((a, b) =>
    sortScore(allPunkteData[`${blockCfg.id}_${a.id}`]) - sortScore(allPunkteData[`${blockCfg.id}_${b.id}`])
  )

  // ── Visuelle Tokens ────────────────────────────────────────────────────────
  // Priorität: NEIN → fertig → JA-aktiv → default
  const outerBorder = isBlockNein    ? '1px solid var(--border)'
                    : isBlockFertig  ? '2px solid rgba(22,163,74,0.60)'
                    : isBlockJa      ? '2px solid rgba(22,163,74,0.40)'
                    :                  '1px solid var(--border)'

  const outerBg     = isBlockNein    ? 'rgba(148,163,184,0.04)'
                    : isBlockFertig  ? 'rgba(22,163,74,0.05)'
                    : isBlockJa      ? 'rgba(22,163,74,0.03)'
                    :                  'var(--surface)'

  const headerBg    = isBlockNein    ? 'var(--surface)'
                    : isBlockFertig  ? 'rgba(22,163,74,0.10)'
                    : isBlockJa      ? 'rgba(22,163,74,0.07)'
                    :                  collapsed ? 'var(--surface)' : 'var(--surface2)'

  // ── Block-Relevanz-Toggle ──────────────────────────────────────────────────
  function blockRelevanzBtn(value, label, activeColor, activeBg) {
    const active = blockRelevanz === value
    return (
      <button
        onClick={e => { e.stopPropagation(); onSetBlockRelevanz(active ? null : value) }}
        title={label}
        style={{
          padding: '2px 8px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
          border: `1px solid ${active ? activeColor : 'var(--border)'}`,
          borderRadius: value === true ? '4px 0 0 4px' : '0 4px 4px 0',
          borderRight: value === true ? 'none' : undefined,
          background: active ? activeBg : 'transparent',
          color: active ? activeColor : 'var(--text-muted)',
          transition: 'all 0.12s',
        }}>
        {label}
      </button>
    )
  }

  // ── Stats-Zeile (Subtext unter dem Titel) ──────────────────────────────────
  function renderStatsRow() {
    if (isBlockNein) {
      return <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>✕ Block nicht relevant – abgeschlossen</span>
    }
    if (isBlockFertig) {
      return (
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#16a34a' }}>
          ✓ Fertig – {stats.total} Prüfpunkte, 0 offen
          {stats.erledigt > 0 && ` · ${stats.erledigt} erledigt`}
          {stats.nichtRelevant > 0 && ` · ${stats.nichtRelevant} nicht relevant`}
        </span>
      )
    }
    // Offen: kompakte Darstellung
    const parts = []
    if (stats.offen > 0)        parts.push(<span key="o" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Offen: <strong style={{ color: '#2563eb' }}>{stats.offen}</strong></span>)
    if (stats.erledigt > 0)     parts.push(<span key="e" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Erledigt: <strong style={{ color: '#16a34a' }}>{stats.erledigt}</strong></span>)
    if (stats.nichtRelevant > 0) parts.push(<span key="n" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>N. rel.: <strong>{stats.nichtRelevant}</strong></span>)
    if (pct > 0 && pct < 100)   parts.push(<span key="p" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{pct}%</span>)
    return <>{parts}</>
  }

  return (
    <div style={{
      border: outerBorder,
      borderRadius: '10px', overflow: 'hidden', marginBottom: '8px',
      background: outerBg,
      opacity: isBlockNein ? 0.5 : 1,
      transition: 'all 0.2s',
    }}>
      {/* Block-Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
        background: headerBg, transition: 'background 0.15s' }}>

        {/* Block Relevanz-Toggle */}
        <div style={{ display: 'flex', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {blockRelevanzBtn(true,  'JA',   '#16a34a', 'rgba(22,163,74,0.15)')}
          {blockRelevanzBtn(false, 'NEIN', '#94a3b8', 'rgba(148,163,184,0.15)')}
        </div>

        {/* Fertig-Checkmark oder Block-Icon */}
        <span style={{ fontSize: '18px', flexShrink: 0 }}>
          {isBlockFertig ? '✅' : blockCfg.icon}
        </span>

        <div style={{ flex: 1, minWidth: 0, cursor: isBlockNein ? 'default' : 'pointer' }}
          onClick={() => !isBlockNein && setCollapsed(c => !c)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '13px', fontWeight: 700,
              color: isBlockNein   ? 'var(--text-muted)'
                   : isBlockFertig ? '#15803d'
                   : isBlockJa     ? '#15803d'
                   :                 'var(--text)',
            }}>
              {blockCfg.nr}. {blockCfg.label}
            </span>
            {/* Status-Badge: Fertig hat Vorrang vor RELEVANT */}
            {isBlockFertig && (
              <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '6px', background: 'rgba(22,163,74,0.22)', color: '#16a34a', fontWeight: 700, letterSpacing: '0.04em' }}>
                ✓ FERTIG
              </span>
            )}
            {!isBlockFertig && isBlockJa && (
              <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '6px', background: 'rgba(22,163,74,0.18)', color: '#16a34a', fontWeight: 700, letterSpacing: '0.04em' }}>
                ✓ RELEVANT
              </span>
            )}
            {blockCfg.isCustom && <span style={{ fontSize: '10px', padding: '0 5px', borderRadius: '5px', background: 'rgba(124,58,237,0.1)', color: '#7c3aed', fontWeight: 700 }}>EIGEN</span>}
            {hasHigh  && <span style={{ fontSize: '10px', padding: '0 5px', borderRadius: '5px', background: 'rgba(220,38,38,0.1)', color: '#dc2626', fontWeight: 700 }}>⚡ HOCH</span>}
            {offeneRQ > 0 && <span style={{ fontSize: '10px', padding: '0 5px', borderRadius: '5px', background: 'rgba(217,119,6,0.1)', color: '#d97706', fontWeight: 700 }}>❓ {offeneRQ}</span>}
          </div>
          {/* Stats-Subzeile */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
            {renderStatsRow()}
          </div>
        </div>

        {!isBlockNein && (
          <span onClick={() => setCollapsed(c => !c)} style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, cursor: 'pointer', padding: '3px 5px' }}>
            {collapsed ? '▼' : '▲'}
          </span>
        )}
      </div>

      {/* Block-Hinweis */}
      {blockCfg.hinweis && !collapsed && !isBlockNein && (
        <div style={{ padding: '6px 12px', background: 'rgba(37,99,235,0.05)', borderTop: '1px solid rgba(37,99,235,0.1)', fontSize: '11px', color: '#2563eb', fontStyle: 'italic' }}>
          💡 {blockCfg.hinweis}
        </div>
      )}

      {/* Block-Content */}
      {!collapsed && !isBlockNein && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
          {sortedPunkte.map(p => (
            <PruefPunkt
              key={p.id}
              blockId={blockCfg.id}
              punktCfg={p}
              data={allPunkteData[`${blockCfg.id}_${p.id}`]}
              blockDisabled={false}
              onUpdate={onUpdatePunkt}
              onAddRueckfrage={onAddRueckfrage}
              rechnerData={rechnerData}
              onRechnerUpdate={onRechnerUpdate}
            />
          ))}
          {toolContent && (
            <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              {toolContent}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
