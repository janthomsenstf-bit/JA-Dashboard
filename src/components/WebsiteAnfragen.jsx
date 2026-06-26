import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../utils/supabaseClient.js'
import { searchAll, filterByCategory } from '../utils/search.js'

const STATUS_CFG = {
  neu:             { label: 'Neu',             color: '#2563eb', bg: '#2563eb18' },
  in_bearbeitung:  { label: 'In Bearbeitung',  color: '#d97706', bg: '#d9770618' },
  erledigt:        { label: 'Erledigt',        color: '#16a34a', bg: '#16a34a18' },
}

const FILTERS = [
  { key: 'all',            label: 'Alle' },
  { key: 'neu',            label: 'Neu' },
  { key: 'in_bearbeitung', label: 'In Bearbeitung' },
  { key: 'erledigt',       label: 'Erledigt' },
]

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.neu
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
      fontSize: '12px', fontWeight: 600, background: cfg.bg, color: cfg.color,
    }}>
      {cfg.label}
    </span>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export default function WebsiteAnfragen({ onCreateMandant, onAddAuftragToMandant, clients = [] }) {
  const [anfragen, setAnfragen] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [pickerFor, setPickerFor] = useState(null)   // Anfrage-ID, für die der Mandanten-Picker offen ist
  const [pickerQuery, setPickerQuery] = useState('')

  // Lead-Daten aus einer Anfrage (geteilt von „Mandant anlegen" + „Auftrag zu Mandant")
  const leadDataFor = useCallback((a) => ({
    name: a.firma || a.name,
    ansprechpartner: a.name,
    email: a.email,
    telefon: a.telefon || '',
    land: a.land || '',
    interesse: a.interesse || '',
    formularDaten: a.formular_daten || null,
    websiteAnfrageId: a.id,
    erstelltAm: a.erstellt_am || null,
    notizen: `── Website-Anfrage ──\nEingegangen: ${formatDate(a.erstellt_am)}\nGewünschte Leistung: ${a.interesse}\n\n${a.nachricht || ''}`,
  }), [])

  // Mandanten-Picker: vorhandene Suchlogik (utils/search.js, dieselbe wie GlobalSearch)
  const pickerClients = useMemo(() => {
    const active = (clients || []).filter(c => !c.archiviert)
    const q = pickerQuery.trim()
    if (q.length < 2) {
      return [...active].sort((x, y) => (x.name || '').localeCompare(y.name || '')).slice(0, 30)
    }
    return filterByCategory(searchAll(active, q).results, 'mandanten').map(r => r.client).slice(0, 30)
  }, [clients, pickerQuery])

  async function attachToMandant(a, clientId) {
    const result = onAddAuftragToMandant?.(clientId, leadDataFor(a))
    if (!result) return
    const linkNote = [
      a.notiz || '',
      `── Verknüpft ${formatDate(new Date().toISOString())} ──`,
      `Mandant: ${result.clientName} (${clientId})`,
      result.auftragId
        ? `Auftrag: ${result.auftragLabel} (${result.auftragId})`
        : 'Kein passender Auftragstyp – nur mit Mandant verknüpft',
    ].filter(Boolean).join('\n')
    await supabase.from('website_anfragen')
      .update({ mandant_id: clientId, notiz: linkNote, status: 'erledigt' })
      .eq('id', a.id)
    setAnfragen(prev => prev.map(x => x.id === a.id ? { ...x, mandant_id: clientId, notiz: linkNote, status: 'erledigt' } : x))
    setPickerFor(null)
    setPickerQuery('')
  }

  const fetchAnfragen = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('website_anfragen')
      .select('*')
      .order('erstellt_am', { ascending: false })
    if (!error && data) setAnfragen(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAnfragen() }, [fetchAnfragen])

  async function updateStatus(id, status) {
    await supabase.from('website_anfragen').update({ status }).eq('id', id)
    setAnfragen(prev => prev.map(a => a.id === id ? { ...a, status } : a))
  }

  async function updateNotiz(id, notiz) {
    await supabase.from('website_anfragen').update({ notiz }).eq('id', id)
    setAnfragen(prev => prev.map(a => a.id === id ? { ...a, notiz } : a))
  }

  async function deleteAnfrage(id) {
    if (!window.confirm('Anfrage wirklich löschen?')) return
    await supabase.from('website_anfragen').delete().eq('id', id)
    setAnfragen(prev => prev.filter(a => a.id !== id))
    if (expanded === id) setExpanded(null)
  }

  function downloadFile(fileObj) {
    if (!fileObj || !fileObj.data) return
    const byteChars = atob(fileObj.data)
    const bytes = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
    const blob = new Blob([bytes], { type: fileObj.type || 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileObj.filename || 'datei'
    a.click()
    URL.revokeObjectURL(url)
  }

  const visible = anfragen.filter(a => {
    if (filter !== 'all' && a.status !== filter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (a.name || '').toLowerCase().includes(q)
        || (a.firma || '').toLowerCase().includes(q)
        || (a.email || '').toLowerCase().includes(q)
        || (a.interesse || '').toLowerCase().includes(q)
    }
    return true
  })

  const counts = { all: anfragen.length }
  anfragen.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1 })

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>
            Website-Anfragen
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Eingegangene Anfragen von etablering-tyskland.com
          </p>
        </div>
        <button onClick={fetchAnfragen} style={{
          padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--border)',
          background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer',
          fontSize: '13px', fontWeight: 600,
        }}>
          Aktualisieren
        </button>
      </div>

      {/* Filter & Suche */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--border)',
              background: filter === f.key ? 'var(--accent)' : 'var(--surface2)',
              color: filter === f.key ? '#fff' : 'var(--text)',
              cursor: 'pointer', fontSize: '12px', fontWeight: 600,
            }}
          >
            {f.label} {counts[f.key] != null ? `(${counts[f.key]})` : ''}
          </button>
        ))}
        <input
          type="text"
          placeholder="Suchen (Name, Firma, E-Mail)…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            marginLeft: 'auto', padding: '6px 12px', borderRadius: '6px',
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text)', fontSize: '13px', width: 240,
          }}
        />
      </div>

      {/* Liste */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Laden…</p>
      ) : visible.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)',
          border: '1px dashed var(--border)', borderRadius: '10px',
        }}>
          {anfragen.length === 0 ? 'Noch keine Anfragen eingegangen.' : 'Keine Anfragen für diesen Filter.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {visible.map(a => {
            const isOpen = expanded === a.id
            return (
              <div key={a.id} style={{
                border: '1px solid var(--border)', borderRadius: '10px',
                background: 'var(--surface)', overflow: 'hidden',
                transition: 'box-shadow 0.15s',
                boxShadow: isOpen ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              }}>
                {/* Zusammenfassungszeile */}
                <div
                  onClick={() => setExpanded(isOpen ? null : a.id)}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr auto auto',
                    alignItems: 'center', gap: '12px', padding: '12px 16px',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>
                      {a.firma || a.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {a.firma ? a.name : a.email}
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {(a.interesse === 'Terminanfrage' || a.formular_daten?.typ === 'termin') && (
                      <span style={{ background: '#d97706', color: '#fff', fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 999 }}>
                        📅 Termin
                      </span>
                    )}
                    {a.interesse || '—'}
                  </div>
                  <StatusBadge status={a.status} />
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: 110, textAlign: 'right' }}>
                    {formatDate(a.erstellt_am)}
                  </div>
                </div>

                {/* Detail-Bereich */}
                {isOpen && (
                  <div style={{
                    borderTop: '1px solid var(--border)', padding: '16px',
                    background: 'var(--surface2)',
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: '13px', marginBottom: 16 }}>
                      <div><strong>Name:</strong> {a.name}</div>
                      <div><strong>E-Mail:</strong> <a href={`mailto:${a.email}`} style={{ color: 'var(--accent)' }}>{a.email}</a></div>
                      {a.firma && <div><strong>Firma:</strong> {a.firma}</div>}
                      {a.telefon && <div><strong>Telefon:</strong> {a.telefon}</div>}
                      {a.land && <div><strong>Land:</strong> {a.land}</div>}
                      <div><strong>Interesse:</strong> {a.interesse}</div>
                    </div>

                    {a.nachricht && (
                      <div style={{ marginBottom: 16 }}>
                        <strong style={{ fontSize: '13px' }}>Nachricht / Formulardaten:</strong>
                        <pre style={{
                          marginTop: 6, padding: '12px', borderRadius: '8px',
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap',
                          color: 'var(--text)', maxHeight: 300, overflowY: 'auto',
                        }}>
                          {a.nachricht}
                        </pre>
                      </div>
                    )}

                    {/* Dateien */}
                    {(a.passkopie || a.cvr_dokument) && (
                      <div style={{ marginBottom: 16 }}>
                        <strong style={{ fontSize: '13px' }}>Hochgeladene Dateien:</strong>
                        <div style={{ display: 'flex', gap: '10px', marginTop: 8, flexWrap: 'wrap' }}>
                          {a.passkopie && a.passkopie.filename && (
                            <button
                              onClick={() => downloadFile(a.passkopie)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '8px 14px', borderRadius: '8px',
                                border: '1px solid var(--border)', background: 'var(--surface)',
                                color: 'var(--text)', cursor: 'pointer', fontSize: '13px',
                              }}
                            >
                              <span style={{ fontSize: '18px' }}>📄</span>
                              <span>Passkopie: {a.passkopie.filename}</span>
                            </button>
                          )}
                          {a.cvr_dokument && a.cvr_dokument.filename && (
                            <button
                              onClick={() => downloadFile(a.cvr_dokument)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '8px 14px', borderRadius: '8px',
                                border: '1px solid var(--border)', background: 'var(--surface)',
                                color: 'var(--text)', cursor: 'pointer', fontSize: '13px',
                              }}
                            >
                              <span style={{ fontSize: '18px' }}>📄</span>
                              <span>CVR-Auszug: {a.cvr_dokument.filename}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notiz */}
                    <div style={{ marginBottom: 16 }}>
                      <strong style={{ fontSize: '13px' }}>Interne Notiz:</strong>
                      <textarea
                        value={a.notiz || ''}
                        onChange={e => setAnfragen(prev => prev.map(x => x.id === a.id ? { ...x, notiz: e.target.value } : x))}
                        onBlur={e => updateNotiz(a.id, e.target.value)}
                        placeholder="Notiz hinzufügen…"
                        rows={2}
                        style={{
                          display: 'block', width: '100%', marginTop: 6, padding: '8px 12px',
                          borderRadius: '8px', border: '1px solid var(--border)',
                          background: 'var(--surface)', color: 'var(--text)',
                          fontSize: '13px', resize: 'vertical',
                        }}
                      />
                    </div>

                    {/* Aktionen */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {a.status !== 'in_bearbeitung' && (
                        <button onClick={() => updateStatus(a.id, 'in_bearbeitung')} style={actionBtn('#d97706')}>
                          In Bearbeitung
                        </button>
                      )}
                      {a.status !== 'erledigt' && (
                        <button onClick={() => updateStatus(a.id, 'erledigt')} style={actionBtn('#16a34a')}>
                          Erledigt
                        </button>
                      )}
                      {a.status !== 'neu' && (
                        <button onClick={() => updateStatus(a.id, 'neu')} style={actionBtn('#2563eb')}>
                          Zurück auf Neu
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const ok = onCreateMandant(leadDataFor(a))
                          if (ok) updateStatus(a.id, 'erledigt')
                        }}
                        style={actionBtn('#7c3aed')}
                      >
                        Mandant anlegen
                      </button>
                      <button
                        onClick={() => { setPickerFor(pickerFor === a.id ? null : a.id); setPickerQuery('') }}
                        style={actionBtn('#0891b2')}
                      >
                        {pickerFor === a.id ? '✕ Auswahl schließen' : 'Auftrag zu bestehendem Mandanten'}
                      </button>
                      <button onClick={() => deleteAnfrage(a.id)} style={{
                        ...actionBtn('#dc2626'), marginLeft: 'auto',
                      }}>
                        Löschen
                      </button>
                    </div>

                    {/* Mandanten-Picker für „Auftrag zu bestehendem Mandanten" */}
                    {pickerFor === a.id && (
                      <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--surface)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
                          Mandant wählen — Auftrag „{a.interesse || '—'}" wird angelegt und die Anfrage verknüpft
                        </div>
                        <input
                          autoFocus
                          type="text"
                          value={pickerQuery}
                          onChange={e => setPickerQuery(e.target.value)}
                          placeholder="Mandant suchen (Name, Nummer …)"
                          style={{
                            width: '100%', padding: '8px 12px', borderRadius: 8,
                            border: '1px solid var(--border)', background: 'var(--surface2)',
                            color: 'var(--text)', fontSize: 13,
                          }}
                        />
                        <div style={{ maxHeight: 240, overflowY: 'auto', marginTop: 8, border: '1px solid var(--border)', borderRadius: 8 }}>
                          {pickerClients.length === 0 ? (
                            <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                              Keine Mandanten gefunden.
                            </div>
                          ) : (
                            pickerClients.map(c => (
                              <div
                                key={c.id}
                                onClick={() => {
                                  if (window.confirm(`Auftrag „${a.interesse || '—'}" zu Mandant „${c.name}" anlegen und die Anfrage als erledigt verknüpfen?`)) {
                                    attachToMandant(a, c.id)
                                  }
                                }}
                                style={{
                                  padding: '8px 12px', cursor: 'pointer',
                                  borderBottom: '1px solid var(--border)',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{c.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  {[c.mandantennummer, c.land, (c.kontakte || [])[0]?.email].filter(Boolean).join(' · ') || '—'}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function actionBtn(color) {
  return {
    padding: '6px 14px', borderRadius: '6px', border: 'none',
    background: color, color: '#fff', cursor: 'pointer',
    fontSize: '12px', fontWeight: 600,
  }
}
