import { useState } from 'react'
import { exportAsTXT, exportAsWord } from '../utils/export.js'

export default function ArchiveModal({ client, onClose, onArchive }) {
  const [steuerdatum,    setSteuerdatum]    = useState(client.abschlussSteuerdatum || '')
  const [besonderheiten, setBesonderheiten] = useState(client.archivSummary        || '')

  function handleOK() {
    onArchive({ steuerdatum, besonderheiten }, null)
  }

  function handleExportTXT() {
    exportAsTXT(client, besonderheiten)
    onArchive({ steuerdatum, besonderheiten }, null)
  }

  function handleExportWord() {
    exportAsWord(client, besonderheiten)
    onArchive({ steuerdatum, besonderheiten }, null)
  }

  const inputStyle = {
    width: '100%', padding: '8px 10px', border: '1px solid var(--border)',
    borderRadius: '6px', background: 'var(--surface2)', color: 'var(--text)',
    fontSize: '13px', boxSizing: 'border-box',
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: '520px' }}>

        {/* Titel */}
        <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px' }}>✅</span>
          <div>
            <div>Mandat abschließen</div>
            <div style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-secondary)', marginTop: '2px' }}>
              {client.name}
            </div>
          </div>
        </div>

        {/* Mandanten-Info */}
        <div style={{
          background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px',
          padding: '10px 14px', marginBottom: '18px', display: 'flex', gap: '16px',
          fontSize: '12px', color: 'var(--text-secondary)',
        }}>
          <span className="mono">{client.mandantennummer}</span>
          <span>VJ {[client.veranlagungsjahr, client.veranlagungsjahr2, client.veranlagungsjahr3].filter(Boolean).join(' / ')}</span>
          <span>{client.rechtsform}</span>
          <span>{client.gewinnermittlung}</span>
        </div>

        {/* Feld 1: Steuererklärung gesendet am */}
        <div className="modal-field">
          <label style={{ fontWeight: 600 }}>
            📤 Steuererklärungen an das Finanzamt gesendet am
          </label>
          <input
            type="date"
            value={steuerdatum}
            onChange={e => setSteuerdatum(e.target.value)}
            style={inputStyle}
          />
          {steuerdatum && (
            <div style={{ fontSize: '11px', color: 'var(--green)', marginTop: '4px' }}>
              ✓ {new Date(steuerdatum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </div>
          )}
        </div>

        {/* Feld 2: Besonderheiten */}
        <div className="modal-field">
          <label style={{ fontWeight: 600 }}>📝 Besonderheiten / Hinweise für Folgejahr</label>
          <textarea
            value={besonderheiten}
            onChange={e => setBesonderheiten(e.target.value)}
            placeholder="Besonderheiten, offene Punkte, Empfehlungen für das nächste Veranlagungsjahr…"
            style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
          />
        </div>

        {/* Export-Optionen (optional) */}
        <div style={{
          background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px',
          padding: '10px 12px', marginBottom: '4px',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Export vor dem Archivieren (optional)
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={handleExportTXT}>
              📄 TXT exportieren + archivieren
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleExportWord}>
              📝 Word exportieren + archivieren
            </button>
          </div>
        </div>

        {/* Aktionen */}
        <div className="modal-actions" style={{ marginTop: '16px' }}>
          <button className="btn btn-ghost" onClick={onClose}>Abbrechen</button>
          <button
            className="btn btn-primary"
            onClick={handleOK}
            style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', minWidth: '120px' }}
          >
            ✅ OK – Archivieren
          </button>
        </div>
      </div>
    </div>
  )
}
