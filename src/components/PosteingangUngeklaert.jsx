import { useState, useMemo } from 'react'

function fmtDatum(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

// ── Dialog: Kontakt speichern? ─────────────────────────────────────────────────
function SaveContactDialog({ email, onYes, onNo }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
        padding: '24px', width: '380px', maxWidth: '95vw',
      }}>
        <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '10px' }}>
          Adresse als Kontakt speichern?
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Soll <strong style={{ color: 'var(--text)' }}>{email.vonName ? `${email.vonName} (${email.von})` : email.von}</strong> als neue Kontaktperson beim Mandanten gespeichert werden?
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onNo}>Nein</button>
          <button className="btn btn-primary btn-sm" onClick={onYes}>Ja, als Kontaktperson speichern</button>
        </div>
      </div>
    </div>
  )
}

// ── Mandanten-Auswahl Dropdown ─────────────────────────────────────────────────
function ClientSelect({ clients, onSelect, placeholder = 'Mandant auswählen…' }) {
  const [val, setVal] = useState('')
  const activeClients = clients.filter(c => !c.archiviert)

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <select
        className="input"
        value={val}
        onChange={e => setVal(e.target.value)}
        style={{ fontSize: '12px', padding: '4px 8px', maxWidth: '220px' }}
      >
        <option value="">{placeholder}</option>
        {activeClients
          .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
          .map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{c.mandantennummer ? ` (${c.mandantennummer})` : ''}
            </option>
          ))
        }
      </select>
      <button
        className="btn btn-primary btn-sm"
        disabled={!val}
        onClick={() => { if (val) onSelect(val); setVal('') }}
        style={{ fontSize: '12px' }}
      >
        Zuordnen
      </button>
    </div>
  )
}

// ── Haupt-Komponente ───────────────────────────────────────────────────────────
export default function PosteingangUngeklaert({ unbekannteEmails, clients, onAssign, onAssignAll, onRecheck, onClose }) {
  const [search,    setSearch]    = useState('')
  const [grouped,   setGrouped]   = useState(false)
  const [selected,  setSelected]  = useState(new Set())           // uid:account keys
  const [bulkClientId, setBulkClientId] = useState('')
  const [saveContactDialog, setSaveContactDialog] = useState(null) // { email, clientId, mode: 'single'|'all' }
  const [recheckResult, setRecheckResult] = useState(null)        // { geprüft, zugeordnet, verbleibend }
  const [recheckLoading, setRecheckLoading] = useState(false)

  const emailKey = e => `${e.account}:${e.uid}`

  // Gefilterte Liste
  const filtered = useMemo(() => {
    if (!search.trim()) return unbekannteEmails
    const q = search.toLowerCase()
    return unbekannteEmails.filter(e =>
      e.betreff?.toLowerCase().includes(q) ||
      e.von?.toLowerCase().includes(q) ||
      e.vonName?.toLowerCase().includes(q)
    )
  }, [unbekannteEmails, search])

  // Gruppiert nach Absenderadresse
  const groupedMap = useMemo(() => {
    const map = new Map()
    filtered.forEach(e => {
      const key = e.von?.toLowerCase() ?? '(unbekannt)'
      if (!map.has(key)) map.set(key, { von: e.von, vonName: e.vonName, emails: [] })
      map.get(key).emails.push(e)
    })
    return map
  }, [filtered])

  function toggleSelect(e) {
    const k = emailKey(e)
    setSelected(prev => {
      const next = new Set(prev)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(emailKey)))
    }
  }

  function handleAssign(email, clientId) {
    setSaveContactDialog({ email, clientId, mode: 'single' })
  }

  function handleAssignAll(vonAddress, clientId) {
    const emails = filtered.filter(e => e.von?.toLowerCase() === vonAddress.toLowerCase())
    setSaveContactDialog({ email: emails[0], vonAddress, clientId, mode: 'all' })
  }

  function handleBulkAssign() {
    if (!bulkClientId || !selected.size) return
    const toAssign = filtered.filter(e => selected.has(emailKey(e)))
    if (!toAssign.length) return
    // Assign each selected email without saving contact
    toAssign.forEach(email => onAssign(email.uid, email.account, bulkClientId, false))
    setSelected(new Set())
    setBulkClientId('')
  }

  function confirmSaveContact(saveContact) {
    const d = saveContactDialog
    setSaveContactDialog(null)
    if (!d) return
    if (d.mode === 'single') {
      onAssign(d.email.uid, d.email.account, d.clientId, saveContact)
    } else {
      onAssignAll(d.vonAddress, d.clientId, saveContact)
    }
  }

  function handleRecheck() {
    if (!onRecheck || recheckLoading) return
    setRecheckLoading(true)
    setRecheckResult(null)
    // kurze Verzögerung für visuelles Feedback
    setTimeout(() => {
      const result = onRecheck()
      setRecheckResult(result ?? { geprüft: 0, zugeordnet: 0, verbleibend: 0 })
      setRecheckLoading(false)
    }, 120)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1900 }}
        onClick={onClose}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '540px', maxWidth: '100vw',
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-4px 0 32px rgba(0,0,0,0.35)',
        zIndex: 2000,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>📥</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>
                Posteingang ungeklärt
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {unbekannteEmails.length} nicht zugeordnete E-Mail{unbekannteEmails.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: '16px' }}>✕</button>
        </div>

        {/* Toolbar */}
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap',
          flexShrink: 0,
        }}>
          <input
            className="input"
            placeholder="🔍 Suche nach Absender, Betreff…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: '1 1 180px', fontSize: '12px', padding: '6px 10px' }}
          />
          <button
            className={`btn btn-sm ${grouped ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setGrouped(g => !g)}
            style={{ fontSize: '11px' }}
          >
            Gruppiert
          </button>
          {onRecheck && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleRecheck}
              disabled={recheckLoading || unbekannteEmails.length === 0}
              title="Ungeklärte E-Mails erneut gegen Mandanten-Kontakte abgleichen"
              style={{ fontSize: '11px', color: 'var(--accent)', whiteSpace: 'nowrap' }}
            >
              {recheckLoading ? '⏳ Prüfe…' : '🔄 Neu abgleichen'}
            </button>
          )}
        </div>

        {/* Recheck-Ergebnis */}
        {recheckResult && (
          <div style={{
            padding: '8px 16px', borderBottom: '1px solid var(--border)',
            background: recheckResult.zugeordnet > 0 ? 'rgba(22,163,74,0.08)' : 'rgba(100,116,139,0.06)',
            display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: recheckResult.zugeordnet > 0 ? '#16a34a' : 'var(--text-muted)' }}>
              {recheckResult.zugeordnet > 0 ? '✅' : 'ℹ️'} Abgleich abgeschlossen
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {recheckResult.geprüft} geprüft
            </span>
            <span style={{ fontSize: '11px', color: recheckResult.zugeordnet > 0 ? '#16a34a' : 'var(--text-muted)', fontWeight: recheckResult.zugeordnet > 0 ? 700 : 400 }}>
              {recheckResult.zugeordnet} zugeordnet
            </span>
            <span style={{ fontSize: '11px', color: recheckResult.verbleibend > 0 ? '#f97316' : 'var(--text-muted)' }}>
              {recheckResult.verbleibend} verbleibend
            </span>
            <button
              onClick={() => setRecheckResult(null)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Bulk-Auswahl */}
        {selected.size > 0 && (
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid var(--border)',
            background: 'rgba(37,99,235,0.06)',
            display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '12px', fontWeight: 600 }}>
              {selected.size} ausgewählt
            </span>
            <select
              className="input"
              value={bulkClientId}
              onChange={e => setBulkClientId(e.target.value)}
              style={{ fontSize: '12px', padding: '4px 8px', flex: '1 1 180px' }}
            >
              <option value="">Mandant auswählen…</option>
              {clients
                .filter(c => !c.archiviert)
                .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
                .map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.mandantennummer ? ` (${c.mandantennummer})` : ''}
                  </option>
                ))
              }
            </select>
            <button
              className="btn btn-primary btn-sm"
              disabled={!bulkClientId}
              onClick={handleBulkAssign}
              style={{ fontSize: '12px' }}
            >
              Alle zuordnen
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSelected(new Set())}
              style={{ fontSize: '11px' }}
            >
              Auswahl aufheben
            </button>
          </div>
        )}

        {/* E-Mail-Liste */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              {unbekannteEmails.length === 0
                ? '✅ Keine ungeklärten E-Mails – alles zugeordnet.'
                : 'Keine Treffer für diese Suche.'}
            </div>
          )}

          {!grouped && filtered.map(email => {
            const k = emailKey(email)
            const isSel = selected.has(k)
            return (
              <EmailRow
                key={k}
                email={email}
                clients={clients}
                selected={isSel}
                onToggle={() => toggleSelect(email)}
                onAssign={(clientId) => handleAssign(email, clientId)}
              />
            )
          })}

          {grouped && Array.from(groupedMap.entries()).map(([vonKey, group]) => (
            <GroupRow
              key={vonKey}
              group={group}
              clients={clients}
              selected={selected}
              onToggleEmail={toggleSelect}
              emailKey={emailKey}
              onAssignEmail={(email, clientId) => handleAssign(email, clientId)}
              onAssignAll={(clientId) => handleAssignAll(vonKey, clientId)}
            />
          ))}
        </div>

        {/* Footer */}
        {filtered.length > 0 && (
          <div style={{
            padding: '10px 16px', borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selected.size === filtered.length && filtered.length > 0}
                onChange={toggleAll}
              />
              Alle auswählen
            </label>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {filtered.length} E-Mail{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Kontakt-Speichern-Dialog */}
      {saveContactDialog && (
        <SaveContactDialog
          email={saveContactDialog.email}
          onYes={() => confirmSaveContact(true)}
          onNo={() => confirmSaveContact(false)}
        />
      )}
    </>
  )
}

// ── Einzelne E-Mail-Zeile ──────────────────────────────────────────────────────
function EmailRow({ email, clients, selected, onToggle, onAssign }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      padding: '10px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      background: selected ? 'rgba(37,99,235,0.06)' : 'transparent',
      transition: 'background 0.1s',
    }}>
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        style={{ marginTop: '3px', flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
            {email.vonName || email.von}
          </span>
          {email.vonName && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{email.von}</span>
          )}
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {fmtDatum(email.datum)} · {email.account}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {email.betreff}
        </div>
        <div style={{ marginTop: '8px' }}>
          <ClientSelect clients={clients} onSelect={onAssign} />
        </div>
      </div>
    </div>
  )
}

// ── Gruppenzeile (nach Absender) ───────────────────────────────────────────────
function GroupRow({ group, clients, selected, onToggleEmail, emailKey, onAssignEmail, onAssignAll }) {
  const [expanded, setExpanded] = useState(false)
  const allSelected = group.emails.every(e => selected.has(emailKey(e)))

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Gruppen-Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 16px',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => group.emails.forEach(onToggleEmail)}
          style={{ flexShrink: 0 }}
        />
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '12px', color: 'var(--text-muted)' }}
        >
          {expanded ? '▾' : '▸'}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '13px', fontWeight: 700 }}>
            {group.vonName || group.von}
          </span>
          {group.vonName && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>{group.von}</span>
          )}
          <span style={{
            marginLeft: '8px', fontSize: '10px', fontWeight: 700,
            background: 'rgba(37,99,235,0.15)', color: '#60a5fa',
            borderRadius: '10px', padding: '1px 7px',
          }}>
            {group.emails.length}
          </span>
        </div>
      </div>

      {/* Sammelzuordnung */}
      <div style={{ padding: '4px 16px 10px 52px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Alle {group.emails.length} E-Mails zuordnen:
          </span>
          <ClientSelect clients={clients} onSelect={cid => onAssignAll(cid)} placeholder="Mandant…" />
        </div>
      </div>

      {/* Einzelne E-Mails (aufgeklappt) */}
      {expanded && group.emails.map(email => {
        const k = emailKey(email)
        return (
          <div key={k} style={{
            paddingLeft: '48px',
            borderTop: '1px solid rgba(255,255,255,0.04)',
          }}>
            <EmailRow
              email={email}
              clients={clients}
              selected={selected.has(k)}
              onToggle={() => onToggleEmail(email)}
              onAssign={cid => onAssignEmail(email, cid)}
            />
          </div>
        )
      })}
    </div>
  )
}
