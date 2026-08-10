/**
 * DauerrechnungenSammellauf – gebündelte Erzeugung + Versand fälliger Dauerrechnungen.
 * Wird in der Honorar-Übersicht (BudgetView) angezeigt.
 *
 * Ablauf: fällige Dauerrechnungen über alle Mandanten sammeln → Vorschau-Liste
 * mit Auswahl → EINE Bestätigung → sequenziell erzeugen (Entwurf), versenden und
 * festschreiben → letzterVersandPeriode setzen + Spiegel in client.rechnungen[].
 *
 * Datensicherheit: pro Mandant EIN additiver Update (dauerrechnungen + rechnungen).
 * Fälligkeit automatisch nach Intervall (verhindert Doppel-Rechnungen).
 */
import { useState, useMemo } from 'react'
import { createSevdeskInvoice, sendSevdeskInvoiceEmail, enshrineSevdeskInvoice } from '../utils/sevdeskClient.js'
import { INTERVALLE, summeBrutto } from './detail/DauerrechnungenBlock.jsx'
import { MAIL_VORLAGEN, applyPlatzhalter, initialVorlage, rechnungsEmail } from './detail/RechnungSevdeskBlock.jsx'
import { fmtEuro } from './detail/HonorareTab.jsx'
import { buildMailHtml } from '../utils/mailFormat.js'

const ACCENT = '#7c3aed'

function todayISO() { return new Date().toISOString().slice(0, 10) }

function aktuellePeriode(intervall, d) {
  const y = d.getFullYear()
  if (intervall === 'monatlich')     return `${y}-${String(d.getMonth() + 1).padStart(2, '0')}`
  if (intervall === 'quartalsweise') return `${y}-Q${Math.floor(d.getMonth() / 3) + 1}`
  return `${y}`
}

function istFaellig(dr, now) {
  if (!dr.aktiv) return false
  if (dr.startDatum && new Date(dr.startDatum) > now) return false
  return dr.letzterVersandPeriode !== aktuellePeriode(dr.intervall, now)
}

function buildAddress(client) {
  const r = client.rechnung ?? {}
  return [
    client.name, r.strasse,
    [r.plz, r.ort].filter(Boolean).join(' ').trim(),
    r.land && r.land !== 'Deutschland' ? r.land : null,
  ].map(s => String(s ?? '').trim()).filter(Boolean).join('\n')
}

export default function DauerrechnungenSammellauf({ clients = [], onUpdateClient, signaturen = [] }) {
  const now = useMemo(() => new Date(), [])
  const [sprachModus, setSprachModus] = useState('auto')   // 'auto' (je Mandant .dk) | 'de' | 'da'
  const [sigId, setSigId] = useState(() => (signaturen.find(s => s.isDefault) ?? signaturen[0])?.id ?? '')

  // Fällige Items über alle Mandanten sammeln
  const items = useMemo(() => {
    const list = []
    for (const client of clients) {
      for (const dr of (client.dauerrechnungen ?? [])) {
        if (!istFaellig(dr, now)) continue
        const email = rechnungsEmail(client)
        const bereit = !!client.sevdeskContactId && !!email
        list.push({
          key:     client.id + ':' + dr.id,
          clientId: client.id,
          client, dr,
          email,
          bereit,
          grund:   !client.sevdeskContactId ? 'kein sevDesk-Kontakt' : (!email ? 'kein Rechnungsempfänger' : ''),
          brutto:  summeBrutto(dr),
        })
      }
    }
    return list
  }, [clients, now])

  const [selected, setSelected] = useState(() => new Set())
  const [initDone, setInitDone] = useState(false)
  // Standard: alle „bereiten" Items angehakt (einmalig beim ersten Rendern mit Items)
  if (!initDone && items.length) {
    const s = new Set(items.filter(i => i.bereit).map(i => i.key))
    setSelected(s); setInitDone(true)
  }

  const [status, setStatus]   = useState('idle')   // idle | running | done
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults] = useState([])

  function toggle(key) {
    setSelected(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })
  }

  const ausgewaehlt = items.filter(i => i.bereit && selected.has(i.key))

  async function starten() {
    if (!ausgewaehlt.length) return
    const bestaetigt = window.confirm(
      `${ausgewaehlt.length} Rechnung(en) jetzt erzeugen, festschreiben und an die Mandanten senden?\n\n` +
      ausgewaehlt.map(i => `• ${i.client.name}: ${i.dr.bezeichnung} (${fmtEuro(i.brutto)}) → ${i.email}`).join('\n') +
      `\n\nEndgültig – die Rechnungen gehen wirklich an die Mandanten.`
    )
    if (!bestaetigt) return

    setStatus('running'); setResults([]); setProgress({ done: 0, total: ausgewaehlt.length })

    // Nach Mandant gruppieren → pro Mandant EIN additiver Update
    const byClient = new Map()
    for (const it of ausgewaehlt) {
      if (!byClient.has(it.clientId)) byClient.set(it.clientId, [])
      byClient.get(it.clientId).push(it)
    }

    const alle = []
    let fertig = 0
    for (const [clientId, its] of byClient) {
      const client = its[0].client
      let drListe    = [...(client.dauerrechnungen ?? [])]
      let rechnungen = [...(client.rechnungen ?? [])]

      for (const it of its) {
        const dr = it.dr
        try {
          const positionen = (dr.positionen ?? []).map(p => ({
            name: p.name, quantity: Number(p.quantity) || 1, price: Number(p.price) || 0, taxRate: Number(p.taxRate) || 0,
          }))
          const inv = await createSevdeskInvoice({
            contactId:   client.sevdeskContactId,
            invoiceDate: todayISO(),
            positions:   positionen,
            address:     buildAddress(client) || undefined,
            land:        client.rechnung?.land || undefined,
            headText:    dr.bezeichnung || '',
          })
          const invoiceId = inv.invoice?.id
          const vorlage = sprachModus === 'auto'
            ? initialVorlage(client)
            : (MAIL_VORLAGEN.find(v => v.key === sprachModus) ?? initialVorlage(client))
          const sig = signaturen.find(s => s.id === sigId)
          const html = buildMailHtml(applyPlatzhalter(vorlage.text, client), sig?.text)
          const sd = await sendSevdeskInvoiceEmail({
            invoiceId, toEmail: it.email,
            subject: applyPlatzhalter(vorlage.subject, client),
            text:    html,
          })
          let finalInv = sd.invoice ?? inv.invoice ?? {}
          let nummer   = finalInv.invoiceNumber ?? null
          try { const en = await enshrineSevdeskInvoice(invoiceId); if (en.invoice) finalInv = en.invoice; nummer = finalInv.invoiceNumber ?? nummer } catch { /* Festschreiben best-effort */ }

          const periode = aktuellePeriode(dr.intervall, now)
          drListe = drListe.map(x => x.id === dr.id ? { ...x, letzterVersandPeriode: periode } : x)
          rechnungen = [...rechnungen, {
            id:           'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            sevdeskId:    invoiceId,
            nummer,
            datum:        todayISO(),
            betragNetto:  finalInv.sumNet   ?? null,
            betragBrutto: finalInv.sumGross ?? it.brutto,
            email:        it.email,
            status:       'versendet',
            quelle:       'dauerrechnung',
            erstelltAm:   new Date().toISOString(),
          }]
          alle.push({ key: it.key, mandant: client.name, bezeichnung: dr.bezeichnung, ok: true, nummer })
        } catch (e) {
          alle.push({ key: it.key, mandant: client.name, bezeichnung: dr.bezeichnung, ok: false, fehler: e.message || 'Fehler' })
        }
        fertig++; setProgress({ done: fertig, total: ausgewaehlt.length }); setResults([...alle])
      }

      // EIN additiver Update pro Mandant (nur erfolgreiche Änderungen sind bereits eingearbeitet)
      onUpdateClient(clientId, { dauerrechnungen: drListe, rechnungen })
    }

    setStatus('done')
  }

  // ── Render ──
  const anzahl = items.length
  return (
    <div style={{ border: `1px solid ${ACCENT}44`, borderRadius: '10px', overflow: 'hidden', marginBottom: '16px' }}>
      <div style={{ background: ACCENT, color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '16px' }}>🔁</span>
        <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>Fällige Dauerrechnungen</span>
        <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.2)', padding: '1px 8px', borderRadius: '10px' }}>{anzahl} fällig</span>
      </div>

      <div style={{ padding: '12px 14px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {anzahl === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>
            Aktuell ist nichts fällig. Dauerrechnungen legst du je Mandant im Honorare-Tab an.
          </div>
        ) : (
          <>
            {/* Anschreiben-Sprache + Signatur für den Lauf */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '180px', flex: 1 }}>
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '4px' }}>Anschreiben</div>
                <select value={sprachModus} onChange={e => setSprachModus(e.target.value)} disabled={status !== 'idle'}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}>
                  <option value="auto">Automatisch je Mandant (🇩🇪/🇩🇰)</option>
                  {MAIL_VORLAGEN.map(v => <option key={v.key} value={v.key}>{v.label} für alle</option>)}
                </select>
              </div>
              <div style={{ minWidth: '180px', flex: 1 }}>
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '4px' }}>Signatur</div>
                <select value={sigId} onChange={e => setSigId(e.target.value)} disabled={status !== 'idle' || signaturen.length === 0}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}>
                  <option value="">{signaturen.length === 0 ? '— keine hinterlegt —' : '— keine Signatur —'}</option>
                  {signaturen.map(s => <option key={s.id} value={s.id}>{s.name}{s.isDefault ? ' (Standard)' : ''}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {items.map(i => {
                const res = results.find(r => r.key === i.key)
                return (
                  <label key={i.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '7px', background: 'var(--surface2)', fontSize: '12px', cursor: i.bereit ? 'pointer' : 'default', opacity: i.bereit ? 1 : 0.6 }}>
                    <input type="checkbox" disabled={!i.bereit || status !== 'idle'} checked={selected.has(i.key)} onChange={() => toggle(i.key)}
                      style={{ width: '15px', height: '15px', accentColor: ACCENT, cursor: i.bereit ? 'pointer' : 'not-allowed' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text)' }}>{i.client.name}</div>
                      <div style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {i.dr.bezeichnung} · {INTERVALLE[i.dr.intervall]?.label} {i.bereit ? `· ${i.email}` : `· ⚠ ${i.grund}`}
                      </div>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>{fmtEuro(i.brutto)}</span>
                    {res && (
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: 700, whiteSpace: 'nowrap', background: res.ok ? 'rgba(22,163,74,0.12)' : 'rgba(239,68,68,0.12)', color: res.ok ? '#16a34a' : '#ef4444' }}>
                        {res.ok ? `✓ ${res.nummer || 'versendet'}` : '✗ Fehler'}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>

            {/* Fehlerdetails */}
            {results.some(r => !r.ok) && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '8px 12px', fontSize: '11px', color: '#ef4444' }}>
                {results.filter(r => !r.ok).map(r => <div key={r.key}>⚠ {r.mandant} – {r.bezeichnung}: {r.fehler}</div>)}
              </div>
            )}

            {status === 'done' ? (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                ✓ Fertig: {results.filter(r => r.ok).length} versendet{results.some(r => !r.ok) ? `, ${results.filter(r => !r.ok).length} fehlgeschlagen` : ''}.
                Die versendeten sind nicht mehr in der Liste, sobald du neu lädst.
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {status === 'running' && (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>⏳ {progress.done}/{progress.total} …</span>
                )}
                <button onClick={starten} disabled={status !== 'idle' || ausgewaehlt.length === 0}
                  style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: (status !== 'idle' || ausgewaehlt.length === 0) ? 'var(--border)' : ACCENT, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: (status !== 'idle' || ausgewaehlt.length === 0) ? 'not-allowed' : 'pointer' }}>
                  {status === 'running' ? '⏳ läuft …' : `📧 ${ausgewaehlt.length} erzeugen & senden`}
                </button>
              </div>
            )}

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Erzeugt je Position eine Rechnung, schreibt sie fest (GoBD) und versendet sie an die Mandanten-E-Mail –
              <strong> endgültig, erst nach deiner Bestätigung</strong>. Sprache der Begleit-Mail automatisch (🇩🇪/🇩🇰) je E-Mail-Adresse.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
