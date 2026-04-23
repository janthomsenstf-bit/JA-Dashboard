import { useState, useMemo } from 'react'
import { generateAufgaben, generateManuelleAufgaben, getStatus, buildTogglePatch, TYP_CONFIG, fmtDatum, isUeberfaellig, MONAT_NAMEN, MONAT_KURZ } from '../utils/aufgaben.js'

const HEUTE = new Date()
const CUR_MONAT = HEUTE.getMonth() + 1
const CUR_JAHR  = HEUTE.getFullYear()

// ── Hilfsfunktion: Datum formatieren (YYYY-MM-DD) ─────────────────────────────
function toDateInput(iso) {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 10)
}

// ── Statistik-Badge ────────────────────────────────────────────────────────────
function StatBadge({ label, count, color, bg }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 14px', borderRadius: '8px', border: `1px solid ${color}44`, background: bg, minWidth: '80px' }}>
      <div style={{ fontSize: '22px', fontWeight: 800, color }}>{count}</div>
      <div style={{ fontSize: '11px', color, opacity: 0.85, marginTop: '2px' }}>{label}</div>
    </div>
  )
}

// ── Modal: Aufgabe erstellen / bearbeiten ─────────────────────────────────────
function AufgabeModal({ aufgabe, clients, onSave, onClose }) {
  const isEdit = !!aufgabe?.id

  const [typ,        setTyp]        = useState(aufgabe?.typ        ?? 'einmal')
  const [titel,      setTitel]      = useState(aufgabe?.titel      ?? '')
  const [mandantId,  setMandantId]  = useState(aufgabe?.mandantId  ?? '')
  const [faellig,    setFaellig]    = useState(aufgabe?.faellig ? toDateInput(aufgabe.faellig) : '')
  const [frequenz,   setFrequenz]   = useState(aufgabe?.frequenz   ?? 'monatlich')
  const [startDatum, setStartDatum] = useState(aufgabe?.startDatum ?? new Date().toISOString().slice(0, 10))
  const [endDatum,   setEndDatum]   = useState(aufgabe?.endDatum   ?? '')
  const [faelligTag, setFaelligTag] = useState(aufgabe?.faelligTag ?? 1)
  const [beschreibung, setBeschreibung] = useState(aufgabe?.beschreibung ?? '')

  const aktiveClients = clients.filter(c => !c.archiviert)

  function handleSubmit(e) {
    e.preventDefault()
    if (!titel.trim()) return
    const base = {
      typ,
      titel:       titel.trim(),
      mandantId:   mandantId || null,
      beschreibung: beschreibung.trim(),
    }
    if (typ === 'einmal') {
      onSave({ ...base, faellig: faellig || null })
    } else {
      onSave({
        ...base,
        frequenz,
        startDatum,
        endDatum:   endDatum || null,
        faelligTag: parseInt(faelligTag, 10),
        erledigtInstanzen: aufgabe?.erledigtInstanzen ?? {},
      })
    }
  }

  const inputStyle = {
    width: '100%', padding: '7px 10px', borderRadius: '6px',
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text)', fontSize: '13px', boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)', width: '100%', maxWidth: '480px',
        padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px',
      }}>
        <div style={{ fontWeight: 800, fontSize: '15px' }}>
          {isEdit ? '✏️ Aufgabe bearbeiten' : '📌 Neue Aufgabe'}
        </div>

        {/* Typ-Auswahl */}
        <div>
          <label style={labelStyle}>Art</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { key: 'einmal', label: '📎 Einmalaufgabe' },
              { key: 'serie',  label: '🔁 Serienaufgabe' },
            ].map(o => (
              <button
                key={o.key}
                type="button"
                onClick={() => setTyp(o.key)}
                style={{
                  flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer',
                  border: `2px solid ${typ === o.key ? 'var(--accent)' : 'var(--border)'}`,
                  background: typ === o.key ? 'rgba(59,130,246,0.1)' : 'transparent',
                  color: typ === o.key ? 'var(--accent)' : 'var(--text)',
                  fontWeight: typ === o.key ? 700 : 400, fontSize: '12px',
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Titel */}
          <div>
            <label style={labelStyle}>Titel *</label>
            <input
              value={titel} onChange={e => setTitel(e.target.value)}
              placeholder="z. B. Steuererklärung Müller prüfen"
              style={inputStyle} required autoFocus
            />
          </div>

          {/* Mandant */}
          <div>
            <label style={labelStyle}>Mandant (optional)</label>
            <select value={mandantId} onChange={e => setMandantId(e.target.value)} style={inputStyle}>
              <option value="">— Kein Mandant —</option>
              {aktiveClients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.mandantennummer ? `${c.mandantennummer} · ` : ''}{c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Beschreibung */}
          <div>
            <label style={labelStyle}>Beschreibung (optional)</label>
            <textarea
              value={beschreibung} onChange={e => setBeschreibung(e.target.value)}
              placeholder="Notizen zur Aufgabe…"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Einmalaufgabe: Fälligkeitsdatum */}
          {typ === 'einmal' && (
            <div>
              <label style={labelStyle}>Fälligkeitsdatum</label>
              <input
                type="date" value={faellig} onChange={e => setFaellig(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          {/* Serienaufgabe: Felder */}
          {typ === 'serie' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Frequenz</label>
                  <select value={frequenz} onChange={e => setFrequenz(e.target.value)} style={inputStyle}>
                    <option value="monatlich">Monatlich</option>
                    <option value="quartalsweise">Quartalsweise</option>
                    <option value="halbjaehrlich">Halbjährlich</option>
                    <option value="jaehrlich">Jährlich</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tag im Monat (fällig)</label>
                  <input
                    type="number" min={1} max={28} value={faelligTag}
                    onChange={e => setFaelligTag(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Startdatum *</label>
                  <input
                    type="date" value={startDatum} onChange={e => setStartDatum(e.target.value)}
                    style={inputStyle} required
                  />
                </div>
                <div>
                  <label style={labelStyle}>Enddatum (optional)</label>
                  <input
                    type="date" value={endDatum} onChange={e => setEndDatum(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            </>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" style={{ fontSize: '13px' }}>
              Abbrechen
            </button>
            <button type="submit" className="btn btn-primary btn-sm" style={{ fontSize: '13px', padding: '6px 18px' }}>
              {isEdit ? '✓ Speichern' : '+ Anlegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function GlobalTodoView({
  clients,
  aufgabenListe = [],
  onUpdateClient,
  onSelectClient,
  onAddAufgabe,
  onUpdateAufgabe,
  onDeleteAufgabe,
}) {
  const aktiveClients = clients.filter(c => !c.archiviert)

  // ── Filter-State ─────────────────────────────────────────────────────────────
  const [filterMonat,  setFilterMonat]  = useState(CUR_MONAT)
  const [filterJahr,   setFilterJahr]   = useState(CUR_JAHR)
  const [filterTyp,    setFilterTyp]    = useState('alle')
  const [filterStatus, setFilterStatus] = useState('offen')

  // ── Modal-State ───────────────────────────────────────────────────────────────
  const [showModal,   setShowModal]   = useState(false)
  const [editAufgabe, setEditAufgabe] = useState(null)  // null = neu, sonst aufgabe-obj

  // ── Alle auto-generierten Tasks ───────────────────────────────────────────────
  const alleAutoTasks = useMemo(() => {
    const result = []
    for (const client of aktiveClients) {
      const tasks = generateAufgaben(client)
      for (const task of tasks) {
        if (task.type === 'Lohn' && client.lohnInUebersicht === false) continue
        if (task.type === 'USt'  && client.ustInUebersicht  === false) continue
        if (task.type === 'JA'   && client.jaInUebersicht   === false) continue
        const st = getStatus(client, task.key)
        result.push({ ...task, client, mandantName: client.name, erledigt: st.erledigt, erledigtAm: st.erledigtAm, istManuell: false })
      }
    }
    return result
  }, [aktiveClients])

  // ── Alle manuellen Tasks (generiert für filterJahr) ───────────────────────────
  const alleManuelleTask = useMemo(() => {
    const tasks = generateManuelleAufgaben(aufgabenListe, filterJahr)
    return tasks.map(t => {
      const client = t.mandantId ? aktiveClients.find(c => c.id === t.mandantId) : null
      return { ...t, client: client ?? null, mandantName: client?.name ?? null }
    })
  }, [aufgabenListe, filterJahr, aktiveClients])

  // ── Alle Tasks kombiniert ─────────────────────────────────────────────────────
  const alleTasks = useMemo(() => [...alleAutoTasks, ...alleManuelleTask], [alleAutoTasks, alleManuelleTask])

  // ── Gefilterte Tasks ──────────────────────────────────────────────────────────
  const gefiltert = useMemo(() => {
    return alleTasks.filter(t => {
      if (t.jahr !== filterJahr) return false
      if (filterMonat !== null) {
        if (t.monat !== null && t.monat !== filterMonat) return false
        if (t.monat === null && t.quartal !== null) {
          if (t.quartal !== Math.ceil(filterMonat / 3)) return false
        }
      }
      if (filterTyp !== 'alle' && t.type !== filterTyp) return false
      if (filterStatus === 'offen'    && t.erledigt)  return false
      if (filterStatus === 'erledigt' && !t.erledigt) return false
      return true
    })
  }, [alleTasks, filterJahr, filterMonat, filterTyp, filterStatus])

  // ── Statistiken ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const base = alleTasks.filter(t => t.jahr === filterJahr)
    const cur  = filterMonat !== null
      ? base.filter(t =>
          t.monat === filterMonat ||
          (t.monat === null && t.quartal === null) ||
          (t.monat === null && t.quartal === Math.ceil(filterMonat / 3))
        )
      : base
    return {
      gesamt:       cur.length,
      offen:        cur.filter(t => !t.erledigt).length,
      erledigt:     cur.filter(t =>  t.erledigt).length,
      ueberfaellig: cur.filter(t => !t.erledigt && isUeberfaellig(t.faellig)).length,
    }
  }, [alleTasks, filterJahr, filterMonat])

  // ── Toggle für auto-generierte Tasks ─────────────────────────────────────────
  function handleAutoToggle(task) {
    const patch = buildTogglePatch(task.client, task.key)
    onUpdateClient(task.client.id, patch)
  }

  // ── Toggle für manuelle Tasks ─────────────────────────────────────────────────
  function handleManuellToggle(task) {
    if (task.istSerie) {
      // Series instance toggle
      const aufgabe = aufgabenListe.find(a => a.id === task.aufgabeId)
      if (!aufgabe) return
      const current = (aufgabe.erledigtInstanzen ?? {})[task.serieInstanz] ?? {}
      const next = current.erledigt
        ? { erledigt: false, erledigtAm: null }
        : { erledigt: true,  erledigtAm: new Date().toISOString() }
      onUpdateAufgabe(task.aufgabeId, {
        erledigtInstanzen: { ...(aufgabe.erledigtInstanzen ?? {}), [task.serieInstanz]: next },
      })
    } else {
      // Einmalaufgabe toggle
      onUpdateAufgabe(task.aufgabeId, {
        erledigt:   !task.erledigt,
        erledigtAm: !task.erledigt ? new Date().toISOString() : null,
      })
    }
  }

  // ── Aufgabe speichern (neu oder bearbeiten) ───────────────────────────────────
  function handleSaveAufgabe(data) {
    if (editAufgabe?.id) {
      onUpdateAufgabe(editAufgabe.id, data)
    } else {
      onAddAufgabe(data)
    }
    setShowModal(false)
    setEditAufgabe(null)
  }

  // ── Aufgabe löschen ───────────────────────────────────────────────────────────
  function handleDeleteAufgabe(aufgabeId, label) {
    if (window.confirm(`Aufgabe "${label}" wirklich löschen?`)) {
      onDeleteAufgabe(aufgabeId)
    }
  }

  // ── Jahre für Dropdown ────────────────────────────────────────────────────────
  const verfuegbareJahre = useMemo(() => {
    const jahre = new Set(alleAutoTasks.map(t => t.jahr))
    jahre.add(CUR_JAHR)
    jahre.add(CUR_JAHR + 1)
    return [...jahre].sort((a, b) => b - a)
  }, [alleAutoTasks])

  const inputStyle = {
    padding: '5px 10px', border: '1px solid var(--border)', borderRadius: '6px',
    background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <span style={{ fontSize: '22px' }}>📋</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '16px' }}>Aufgaben-Übersicht</div>
            <div style={{ fontSize: '11px', opacity: 0.6 }}>Alle Mandate – USt / Lohn / JA / Manuelle Aufgaben</div>
          </div>
          {/* Statistik-Badges */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <StatBadge label="Offen"    count={stats.offen}    color="#60a5fa" bg="rgba(96,165,250,0.12)" />
            <StatBadge label="Erledigt" count={stats.erledigt} color="#4ade80" bg="rgba(74,222,128,0.12)" />
            {stats.ueberfaellig > 0 && (
              <StatBadge label="Überfällig" count={stats.ueberfaellig} color="#f87171" bg="rgba(248,113,113,0.12)" />
            )}
            {/* Neue Aufgabe */}
            <button
              onClick={() => { setEditAufgabe(null); setShowModal(true) }}
              style={{
                padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: '12px',
                whiteSpace: 'nowrap', marginLeft: '8px',
              }}
            >
              ＋ Neue Aufgabe
            </button>
          </div>
        </div>

        {/* ── Filter-Leiste ── */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Jahr */}
          <select value={filterJahr} onChange={e => setFilterJahr(Number(e.target.value))} style={{ ...inputStyle, fontWeight: 600 }}>
            {verfuegbareJahre.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Monats-Chips */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <button onClick={() => setFilterMonat(null)} style={{
              padding: '4px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
              border: `1px solid ${filterMonat === null ? '#60a5fa' : 'rgba(255,255,255,0.2)'}`,
              background: filterMonat === null ? 'rgba(96,165,250,0.25)' : 'transparent',
              color: filterMonat === null ? '#60a5fa' : 'rgba(255,255,255,0.6)', fontWeight: filterMonat === null ? 700 : 400,
            }}>Alle</button>
            {MONAT_KURZ.map((m, i) => (
              <button key={i} onClick={() => setFilterMonat(i + 1)} style={{
                padding: '4px 8px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
                border: `1px solid ${filterMonat === i + 1 ? '#60a5fa' : 'rgba(255,255,255,0.15)'}`,
                background: filterMonat === i + 1 ? 'rgba(96,165,250,0.25)' : i + 1 === CUR_MONAT && filterJahr === CUR_JAHR ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: filterMonat === i + 1 ? '#60a5fa' : 'rgba(255,255,255,0.6)',
                fontWeight: filterMonat === i + 1 ? 700 : 400,
                outline: i + 1 === CUR_MONAT && filterJahr === CUR_JAHR ? '1px solid rgba(255,255,255,0.2)' : 'none',
              }}>{m}</button>
            ))}
          </div>

          <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.15)' }} />

          {/* Typ-Filter */}
          {[
            { key: 'alle',    label: 'Alle Typen' },
            { key: 'USt',     label: '📊 USt' },
            { key: 'Lohn',    label: '💼 Lohn' },
            { key: 'JA',      label: '📁 JA' },
            { key: 'Zusatz',  label: '⭐ Zusatz' },
            { key: 'Manuell', label: '📌 Manuell' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilterTyp(f.key)} style={{
              padding: '4px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
              border: `1px solid ${filterTyp === f.key ? '#a78bfa' : 'rgba(255,255,255,0.2)'}`,
              background: filterTyp === f.key ? 'rgba(167,139,250,0.25)' : 'transparent',
              color: filterTyp === f.key ? '#a78bfa' : 'rgba(255,255,255,0.6)',
              fontWeight: filterTyp === f.key ? 700 : 400,
            }}>{f.label}</button>
          ))}

          <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.15)' }} />

          {/* Status-Filter */}
          {[
            { key: 'offen',    label: '⬜ Offen' },
            { key: 'erledigt', label: '✅ Erledigt' },
            { key: 'alle',     label: 'Alle' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilterStatus(f.key)} style={{
              padding: '4px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
              border: `1px solid ${filterStatus === f.key ? '#4ade80' : 'rgba(255,255,255,0.2)'}`,
              background: filterStatus === f.key ? 'rgba(74,222,128,0.2)' : 'transparent',
              color: filterStatus === f.key ? '#4ade80' : 'rgba(255,255,255,0.6)',
              fontWeight: filterStatus === f.key ? 700 : 400,
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* ── Tabelle ── */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
        {gefiltert.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            {filterStatus === 'erledigt'
              ? '🎉 Keine erledigten Aufgaben in diesem Zeitraum.'
              : filterTyp === 'Manuell'
                ? <span>Noch keine manuellen Aufgaben.<br /><button onClick={() => { setEditAufgabe(null); setShowModal(true) }} style={{ marginTop: '12px', padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>＋ Erste Aufgabe anlegen</button></span>
                : '✅ Keine offenen Aufgaben – alles erledigt!'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', borderBottom: '2px solid var(--border)', width: '36px' }}></th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', borderBottom: '2px solid var(--border)' }}>Mandant</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', borderBottom: '2px solid var(--border)' }}>Typ</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', borderBottom: '2px solid var(--border)' }}>Aufgabe</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', borderBottom: '2px solid var(--border)' }}>Fällig</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', borderBottom: '2px solid var(--border)' }}>Status</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', borderBottom: '2px solid var(--border)', width: '64px' }}></th>
              </tr>
            </thead>
            <tbody>
              {gefiltert.map((task, idx) => {
                const cfg      = TYP_CONFIG[task.type] ?? TYP_CONFIG.Manuell
                const ueber    = !task.erledigt && isUeberfaellig(task.faellig)
                const istHeute = task.faellig && new Date(task.faellig).toDateString() === HEUTE.toDateString()

                return (
                  <tr key={task.key} style={{
                    background: task.erledigt ? 'transparent' : ueber ? 'rgba(239,68,68,0.03)' : idx % 2 === 0 ? 'var(--surface)' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                    opacity: task.erledigt ? 0.6 : 1,
                    transition: 'background 0.1s',
                  }}>
                    {/* Checkbox */}
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={task.erledigt}
                        onChange={() => task.istManuell ? handleManuellToggle(task) : handleAutoToggle(task)}
                        style={{ width: '15px', height: '15px', accentColor: cfg.color, cursor: 'pointer' }}
                      />
                    </td>

                    {/* Mandant */}
                    <td style={{ padding: '8px 12px' }}>
                      {task.client ? (
                        <button
                          onClick={() => onSelectClient(task.client.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 600, fontSize: '13px', padding: 0, textAlign: 'left' }}
                          title="Mandant öffnen"
                        >
                          {task.client.name}
                          {task.client.mandantennummer && (
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{task.client.mandantennummer}</div>
                          )}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                          {task.mandantName ?? '—'}
                        </span>
                      )}
                    </td>

                    {/* Typ */}
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
                        {cfg.icon} {task.istSerie ? 'Serie' : task.type}
                      </span>
                    </td>

                    {/* Aufgabe */}
                    <td style={{ padding: '8px 12px', fontWeight: task.erledigt ? 400 : 500, color: 'var(--text)', textDecoration: task.erledigt ? 'line-through' : 'none', maxWidth: '280px' }}>
                      {task.label}
                      {task.beschreibung && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px', textDecoration: 'none' }}>
                          {task.beschreibung}
                        </div>
                      )}
                    </td>

                    {/* Fällig */}
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontSize: '12px' }}>
                      {task.faellig ? (
                        <span style={{ color: ueber ? '#ef4444' : istHeute ? 'var(--orange)' : 'var(--text-muted)', fontWeight: ueber || istHeute ? 600 : 400 }}>
                          {ueber ? '⚠ ' : istHeute ? '⏰ ' : ''}{fmtDatum(task.faellig)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>–</span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      {task.erledigt ? (
                        <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                          ✓ {fmtDatum(task.erledigtAm)}
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: ueber ? '#ef4444' : 'var(--text-muted)', fontWeight: ueber ? 600 : 400 }}>
                          {ueber ? '⚠ Überfällig' : 'Offen'}
                        </span>
                      )}
                    </td>

                    {/* Aktionen (nur für manuelle Tasks) */}
                    <td style={{ padding: '8px 8px', whiteSpace: 'nowrap' }}>
                      {task.istManuell && !task.istSerie && (
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <button
                            onClick={() => {
                              const orig = aufgabenListe.find(a => a.id === task.aufgabeId)
                              setEditAufgabe(orig)
                              setShowModal(true)
                            }}
                            title="Bearbeiten"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', padding: '2px 4px', borderRadius: '4px' }}
                          >✏️</button>
                          <button
                            onClick={() => handleDeleteAufgabe(task.aufgabeId, task.label)}
                            title="Löschen"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '13px', padding: '2px 4px', borderRadius: '4px' }}
                          >🗑</button>
                        </div>
                      )}
                      {task.istManuell && task.istSerie && (
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <button
                            onClick={() => {
                              const orig = aufgabenListe.find(a => a.id === task.aufgabeId)
                              setEditAufgabe(orig)
                              setShowModal(true)
                            }}
                            title="Serie bearbeiten"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '11px', padding: '2px 4px', borderRadius: '4px' }}
                          >✏️</button>
                          <button
                            onClick={() => handleDeleteAufgabe(task.aufgabeId, task.label)}
                            title="Gesamte Serie löschen"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '11px', padding: '2px 4px', borderRadius: '4px' }}
                          >🗑</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: '6px 16px', background: 'var(--surface)', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <span>{gefiltert.length} Aufgaben angezeigt</span>
        <span>{aktiveClients.length} Mandate aktiv</span>
        {aufgabenListe.length > 0 && (
          <span>📌 {aufgabenListe.length} manuelle Aufgabe{aufgabenListe.length !== 1 ? 'n' : ''} angelegt</span>
        )}
        <span style={{ marginLeft: 'auto' }}>
          Tipp: Klick auf Mandantenname öffnet die Detail-Ansicht
        </span>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <AufgabeModal
          aufgabe={editAufgabe}
          clients={clients}
          onSave={handleSaveAufgabe}
          onClose={() => { setShowModal(false); setEditAufgabe(null) }}
        />
      )}
    </div>
  )
}
