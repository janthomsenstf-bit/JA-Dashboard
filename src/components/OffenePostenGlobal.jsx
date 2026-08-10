/**
 * OffenePostenGlobal – zentrale Offene-Posten-Liste über alle Mandanten.
 * Wird in der Honorar-Übersicht (BudgetView) angezeigt.
 *
 * Aggregiert alle gespiegelten Rechnungen (client.rechnungen[]), zeigt die noch
 * NICHT bezahlten (offen/überfällig/teilbezahlt), sortiert nach Fälligkeit.
 * „Alle abgleichen" holt den aktuellen Zahlungsstatus aus sevDesk (SoR) und
 * schreibt ihn additiv pro Mandant zurück.
 */
import { useState } from 'react'
import { getSevdeskInvoiceStatuses } from '../utils/sevdeskClient.js'
import { zahlStatusKey, ZAHL_STATUS, berechneFaelligkeit } from './detail/RechnungSevdeskBlock.jsx'
import { fmtEuro } from './detail/HonorareTab.jsx'

const ACCENT = '#0f766e'

export default function OffenePostenGlobal({ clients = [], onUpdateClient, onSelectClient }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg]   = useState('')

  // Offene Posten über alle (nicht archivierten) Mandanten sammeln
  const posten = []
  for (const client of clients) {
    if (client.archiviert) continue
    for (const r of (client.rechnungen ?? [])) {
      const k = zahlStatusKey(r)
      if (k === 'bezahlt' || k === 'entwurf') continue
      const brutto = Number(r.betragBrutto) || 0
      const paid   = Number(r.paidAmount) || 0
      const offen  = k === 'teilbezahlt' ? Math.max(0, brutto - paid) : brutto
      posten.push({ clientId: client.id, mandant: client.name, r, k, offen })
    }
  }
  // Nach Fälligkeit sortieren (überfälligste zuerst; ohne Fälligkeit ans Ende)
  posten.sort((a, b) => {
    const fa = a.r.faelligkeit || '9999-12-31'
    const fb = b.r.faelligkeit || '9999-12-31'
    return fa < fb ? -1 : fa > fb ? 1 : 0
  })

  const totalOffen        = posten.reduce((s, p) => s + p.offen, 0)
  const totalUeberfaellig = posten.filter(p => p.k === 'ueberfaellig').reduce((s, p) => s + p.offen, 0)
  const anzUeberfaellig   = posten.filter(p => p.k === 'ueberfaellig').length

  async function abgleichenAlle() {
    // sevDesk-IDs je Mandant sammeln
    const gruppen = []
    for (const client of clients) {
      const ids = (client.rechnungen ?? []).map(r => r.sevdeskId).filter(Boolean)
      if (ids.length) gruppen.push({ client, ids })
    }
    const alleIds = gruppen.flatMap(g => g.ids)
    if (!alleIds.length) { setMsg('Keine Rechnungen zum Abgleichen.'); return }

    setBusy(true); setMsg('')
    try {
      const res = await getSevdeskInvoiceStatuses(alleIds)
      const byId = new Map((res.statuses ?? []).filter(s => !s.error && s.id != null).map(s => [String(s.id), s]))
      for (const { client } of gruppen) {
        const updated = (client.rechnungen ?? []).map(r => {
          const s = byId.get(String(r.sevdeskId))
          if (!s) return r
          return {
            ...r,
            statusCode:      s.status,
            paidAmount:      s.paidAmount ?? 0,
            payDate:         s.payDate ?? null,
            faelligkeit:     berechneFaelligkeit(s.invoiceDate, s.timeToPay),
            betragBrutto:    s.sumGross ?? r.betragBrutto,
            nummer:          s.invoiceNumber ?? r.nummer,
            zuletztGeprueft: new Date().toISOString(),
          }
        })
        onUpdateClient(client.id, { rechnungen: updated })
      }
      setMsg('✓ Alle Zahlungsstatus abgeglichen.')
    } catch (e) {
      setMsg(e.message || 'Abgleich fehlgeschlagen')
    } finally { setBusy(false) }
  }

  return (
    <div style={{ border: `1px solid ${ACCENT}44`, borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
      <div style={{ background: ACCENT, color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '16px' }}>📥</span>
        <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>Offene Posten — alle Mandanten</span>
        <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.2)', padding: '1px 8px', borderRadius: '10px' }}>{posten.length} offen</span>
      </div>

      <div style={{ padding: '12px 14px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Summen + Abgleich */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Offen gesamt</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>{fmtEuro(totalOffen)}</div>
          </div>
          {anzUeberfaellig > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#ef4444' }}>davon überfällig ({anzUeberfaellig})</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#ef4444' }}>{fmtEuro(totalUeberfaellig)}</div>
            </div>
          )}
          <button onClick={abgleichenAlle} disabled={busy}
            style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: '8px', border: `1px solid ${ACCENT}`, background: 'transparent', color: ACCENT, fontSize: '12px', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
            {busy ? '⏳ gleicht ab …' : '🔄 Alle abgleichen'}
          </button>
        </div>

        {msg && (
          <div style={{ fontSize: '11px', color: msg.startsWith('✓') ? '#16a34a' : '#ef4444' }}>
            {msg.startsWith('✓') ? msg : `⚠ ${msg}`}
          </div>
        )}

        {posten.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
            Keine offenen Posten 🎉 — alle abgeglichenen Rechnungen sind bezahlt. „Alle abgleichen" holt den aktuellen Stand aus sevDesk.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {posten.map(p => {
              const st = ZAHL_STATUS[p.k] ?? ZAHL_STATUS.offen
              return (
                <div key={p.clientId + ':' + p.r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '7px', background: 'var(--surface2)', fontSize: '12px' }}>
                  <button onClick={() => onSelectClient && onSelectClient(p.clientId)}
                    style={{ fontWeight: 700, color: onSelectClient ? ACCENT : 'var(--text)', background: 'none', border: 'none', cursor: onSelectClient ? 'pointer' : 'default', padding: 0, fontSize: '12px', textAlign: 'left', minWidth: '140px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={p.mandant}>
                    {p.mandant}
                  </button>
                  <span style={{ color: 'var(--text-muted)', minWidth: '80px' }}>{p.r.nummer || 'ohne Nr.'}</span>
                  <span style={{ color: p.k === 'ueberfaellig' ? '#ef4444' : 'var(--text-muted)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.r.faelligkeit ? `fällig ${p.r.faelligkeit}` : (p.r.datum || '—')}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>{fmtEuro(p.offen)}</span>
                  <span style={{ fontSize: '10px', background: st.bg, color: st.color, padding: '2px 8px', borderRadius: '10px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {st.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          💡 Zeigt alle noch nicht bezahlten Rechnungen quer über die Mandanten. Bezahlt/offen kommt aus sevDesk –
          „🔄 Alle abgleichen" aktualisiert den Stand für alle Mandanten auf einmal.
        </div>
      </div>
    </div>
  )
}
