import { useState, useRef, useEffect, Fragment } from 'react'
import EmailVorlagenModal   from '../EmailVorlagenModal.jsx'
import EmailSignaturenModal from '../EmailSignaturenModal.jsx'
import { sendMailGraph, openAuthPopup, callApi, getMandantPath } from '../../utils/onedriveClient.js'
import OneDriveFolderPickerModal from '../shared/OneDriveFolderPickerModal.jsx'
import { callAI, hasAiKey } from '../../utils/aiClient.js'

// ── Signatur-Helfer ───────────────────────────────────────────────────────────
const SIG_SEP = '\n\n--\n'

function insertSig(currentText, sigText) {
  const idx = currentText.indexOf(SIG_SEP)
  const base = idx >= 0 ? currentText.slice(0, idx) : currentText
  return base + SIG_SEP + sigText
}

function removeSig(currentText) {
  const idx = currentText.indexOf(SIG_SEP)
  return idx >= 0 ? currentText.slice(0, idx) : currentText
}

// ── Persistence helpers ───────────────────────────────────────────────────────
const APIKEY_STORAGE  = 'sda-claude-api-key'
const ABSENDER_KEY    = 'kommunikation-absender'

function loadApiKey()  { return (localStorage.getItem(APIKEY_STORAGE) ?? '').replace(/\s/g, '') }

function loadAbsender() {
  try {
    const raw = localStorage.getItem(ABSENDER_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}
function saveAbsender(list) {
  try { localStorage.setItem(ABSENDER_KEY, JSON.stringify(list)) } catch {}
}

// ── Draft-Persistenz (Auto-Save) ──────────────────────────────────────────────
function loadMainDraft(clientId) {
  if (!clientId) return null
  try {
    const raw = localStorage.getItem(`komm_draft_${clientId}`)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function saveMainDraft(clientId, draft) {
  if (!clientId) return
  try {
    localStorage.setItem(`komm_draft_${clientId}`, JSON.stringify(draft))
  } catch {
    try {
      // Quota überschritten: ohne Anhang-Binärdaten speichern
      localStorage.setItem(`komm_draft_${clientId}`, JSON.stringify({ ...draft, attachments: [] }))
    } catch {}
  }
}
function clearMainDraft(clientId) {
  if (!clientId) return
  try { localStorage.removeItem(`komm_draft_${clientId}`) } catch {}
}

function loadReplyDraft(clientId, entryId) {
  if (!clientId || !entryId) return null
  try {
    const raw = localStorage.getItem(`komm_reply_${clientId}_${entryId}`)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function saveReplyDraft(clientId, entryId, draft) {
  if (!clientId || !entryId) return
  try {
    localStorage.setItem(`komm_reply_${clientId}_${entryId}`, JSON.stringify(draft))
  } catch {
    try {
      localStorage.setItem(`komm_reply_${clientId}_${entryId}`, JSON.stringify({ ...draft, replyAttachments: [] }))
    } catch {}
  }
}
function clearReplyDraft(clientId, entryId) {
  if (!clientId || !entryId) return
  try { localStorage.removeItem(`komm_reply_${clientId}_${entryId}`) } catch {}
}

// ── SMTP Senden ───────────────────────────────────────────────────────────────
async function sendViaSMTP({ to, from, subject, text, cc, bcc, account, attachments = [] }) {
  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, from, subject, text, cc, bcc, account, attachments }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

// ── IMAP Abrufen ──────────────────────────────────────────────────────────────
async function fetchEmails(account, since, folder = 'INBOX') {
  const params = new URLSearchParams({ account, folder })
  if (since) params.set('since', since)
  const res = await fetch(`/api/fetch-emails?${params}`)
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`)
  return data.emails ?? []
}

// ── Typ-Konfiguration ─────────────────────────────────────────────────────────
const TYP_CONFIG = {
  rueckfragen:  { label: 'Rückfragen',        icon: '📤', color: '#2563eb', bg: 'rgba(37,99,235,0.08)'  },
  erinnerung:   { label: 'Erinnerung',         icon: '🔔', color: '#f97316', bg: 'rgba(249,115,22,0.08)' },
  unterschrift: { label: 'Unterschrift',       icon: '✍️', color: '#0f766e', bg: 'rgba(15,118,110,0.08)' },
  unterlagen:   { label: 'Unterlagen anfordern', icon: '📎', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  termin:       { label: 'Termin abstimmen',   icon: '📅', color: '#0891b2', bg: 'rgba(8,145,178,0.08)'  },
  frei:         { label: 'Freie Nachricht',    icon: '✉️', color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
  eingehend:    { label: 'Eingehend',          icon: '📨', color: '#16a34a', bg: 'rgba(22,163,74,0.08)'  },
}

const STATUS_BADGES = {
  entwurf:       { label: 'Entwurf',    color: '#f97316', bg: 'rgba(249,115,22,0.1)'  },
  gesendet:      { label: 'Gesendet',   color: '#16a34a', bg: 'rgba(22,163,74,0.1)'   },
  fehlgeschlagen:{ label: 'Fehlgeschlagen', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
}

// ── Templates ─────────────────────────────────────────────────────────────────
function buildTemplate(typ, client) {
  const name = client.name ?? ''
  const vj   = client.veranlagungsjahr ?? new Date().getFullYear()
  const offene = (client.rueckfragen ?? [])
    .filter(r => !r.beantwortet)
    .map((r, i) => `  ${i + 1}. ${r.text}`)
    .join('\n')

  switch (typ) {
    case 'rueckfragen':
      return {
        betreff: `Rückfragen zum Jahresabschluss ${vj}`,
        text: `Sehr geehrte Damen und Herren,

im Rahmen der Aufstellung des Jahresabschlusses ${vj} haben sich folgende Rückfragen ergeben, zu denen wir Ihre Unterstützung benötigen:

${offene || '  1. (bitte ergänzen)'}

Bitte leiten Sie uns die entsprechenden Unterlagen und Informationen möglichst zeitnah zu.

Bei Fragen stehen wir Ihnen selbstverständlich gerne zur Verfügung.

Mit freundlichen Grüßen`,
      }
    case 'erinnerung':
      return {
        betreff: `Erinnerung: Ausstehende Unterlagen – Jahresabschluss ${vj}`,
        text: `Sehr geehrte Damen und Herren,

wir erlauben uns, Sie an die noch ausstehenden Unterlagen für den Jahresabschluss ${vj} zu erinnern.

Für eine zügige Bearbeitung Ihrer Steuerangelegenheiten bitten wir Sie, uns die benötigten Informationen baldmöglichst zuzuleiten.

Mit freundlichen Grüßen`,
      }
    case 'unterschrift':
      return {
        betreff: `Steuererklärung ${vj} – Bitte um Unterschrift`,
        text: `Sehr geehrte Damen und Herren,

beiliegend übersenden wir Ihnen die erstellte Steuererklärung für das Jahr ${vj} zur Durchsicht und Unterzeichnung.

Bitte prüfen Sie die Unterlagen und senden Sie uns die unterschriebenen Dokumente zurück.

Bei Rückfragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen`,
      }
    case 'unterlagen':
      return {
        betreff: `Anforderung von Unterlagen – ${vj}`,
        text: `Sehr geehrte Damen und Herren,

für die Erstellung Ihrer Steuererklärung / Ihres Jahresabschlusses ${vj} benötigen wir folgende Unterlagen:

  1. (bitte ergänzen)

Bitte stellen Sie uns diese Unterlagen möglichst zeitnah zur Verfügung.

Mit freundlichen Grüßen`,
      }
    case 'termin':
      return {
        betreff: `Terminabstimmung – ${vj}`,
        text: `Sehr geehrte Damen und Herren,

gerne würden wir einen Besprechungstermin mit Ihnen abstimmen, um offene Punkte zu Ihrem Jahresabschluss ${vj} zu klären.

Bitte teilen Sie uns Ihre Verfügbarkeit mit, sodass wir einen passenden Termin vereinbaren können.

Mit freundlichen Grüßen`,
      }
    default:
      return { betreff: '', text: '' }
  }
}

// ── mailto: Link ──────────────────────────────────────────────────────────────
function openMailto({ empfaenger, betreff, text, cc, bcc }) {
  const params = []
  if (betreff) params.push(`subject=${encodeURIComponent(betreff)}`)
  if (text)    params.push(`body=${encodeURIComponent(text)}`)
  if (cc)      params.push(`cc=${encodeURIComponent(cc)}`)
  if (bcc)     params.push(`bcc=${encodeURIComponent(bcc)}`)
  const url = `mailto:${encodeURIComponent(empfaenger)}${params.length ? '?' + params.join('&') : ''}`
  window.location.href = url
}

// ── KI ────────────────────────────────────────────────────────────────────────
async function callClaude(systemPrompt, userText) {
  const key = loadApiKey()
  if (!key) throw new Error('Bitte zuerst den Claude API-Schlüssel im Reiter „Status & Arbeit" hinterlegen (🔑).')
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
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userText }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `HTTP ${res.status}`)
  }
  const data = await res.json()
  let raw = data.content?.[0]?.text ?? ''
  const cb = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (cb) raw = cb[1]
  const jm = raw.match(/\{[\s\S]*\}/)
  if (!jm) throw new Error('Antwort konnte nicht verarbeitet werden.')
  const jsonStr = jm[0]
  try { return JSON.parse(jsonStr) } catch {}
  const fixed = jsonStr.replace(/("(?:[^"\\]|\\.)*")/gs, m =>
    m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
  )
  return JSON.parse(fixed)
}

function buildKIEntwurfPrompt(typ, client) {
  const offene = (client.rueckfragen ?? [])
    .filter(r => !r.beantwortet)
    .map((r, i) => `${i + 1}. ${r.text}`)
    .join('\n')
  return `Du bist Steuerberater-Assistent. Erstelle eine professionelle E-Mail an den Mandanten "${client.name}" (${client.rechtsform ?? ''}, Veranlagungsjahr ${client.veranlagungsjahr}).
E-Mail-Typ: ${TYP_CONFIG[typ]?.label ?? typ}.
${offene ? `Offene Rückfragen:\n${offene}\n` : ''}Antworte NUR mit JSON: {"betreff":"...","text":"..."}`
}

// ── Absender-Verwaltung Modal ─────────────────────────────────────────────────
function AbsenderModal({ onClose }) {
  const [list, setList] = useState(() => loadAbsender())
  const [newName, setNewName]   = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newKonto, setNewKonto] = useState('hostinger')

  function add() {
    if (!newEmail.trim()) return
    const updated = [...list, { name: newName.trim(), email: newEmail.trim(), konto: newKonto, isDefault: list.length === 0 }]
    setList(updated)
    saveAbsender(updated)
    setNewName('')
    setNewEmail('')
    setNewKonto('hostinger')
  }

  function remove(i) {
    const updated = list.filter((_, idx) => idx !== i)
    // Wenn gelöschter der Default war: ersten als Default setzen
    if (list[i].isDefault && updated.length > 0) updated[0].isDefault = true
    setList(updated)
    saveAbsender(updated)
  }

  function setDefault(i) {
    const updated = list.map((a, idx) => ({ ...a, isDefault: idx === i }))
    setList(updated)
    saveAbsender(updated)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
        padding: '24px', width: '480px', maxWidth: '95vw',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '15px' }}>Absender-Adressen verwalten</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {list.length === 0 && (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Noch keine Adressen hinterlegt.
          </p>
        )}

        {list.map((a, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px',
            background: a.isDefault ? 'rgba(37,99,235,0.06)' : 'transparent',
            borderRadius: '6px', marginBottom: '4px',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{a.name || a.email}</div>
              {a.name && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.email}</div>}
            </div>
            {a.isDefault
              ? <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 700 }}>Standard</span>
              : <button className="btn btn-ghost btn-sm" style={{ fontSize: '10px' }} onClick={() => setDefault(i)}>Als Standard</button>
            }
            <button className="btn btn-ghost btn-sm" style={{ fontSize: '11px', color: 'var(--red)' }} onClick={() => remove(i)}>✕</button>
          </div>
        ))}

        <div style={{ marginTop: '16px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <input
            className="input"
            placeholder="Name (optional)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            style={{ flex: '1 1 140px', fontSize: '12px', padding: '6px 10px' }}
          />
          <input
            className="input"
            placeholder="E-Mail-Adresse *"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            style={{ flex: '2 1 180px', fontSize: '12px', padding: '6px 10px' }}
            onKeyDown={e => e.key === 'Enter' && add()}
          />
          <select className="input" value={newKonto} onChange={e => setNewKonto(e.target.value)}
            style={{ fontSize: '12px', padding: '6px 10px' }}>
            <option value="hostinger">Hostinger</option>
            <option value="strato">Strato</option>
            <option value="gmail">Gmail</option>
          </select>
          <button className="btn btn-primary btn-sm" onClick={add}>+ Hinzufügen</button>
        </div>

        <div style={{ marginTop: '16px', textAlign: 'right' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Fertig</button>
        </div>
      </div>
    </div>
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function KommunikationTab({ client, onUpdate, emailVorlagen = [], onUpdateEmailVorlagen, emailSignaturen = [], onUpdateEmailSignaturen, onedriveTokens = null, onUpdateOnedriveTokens, pendingAttachments = null, onClearPendingAttachments, pendingOpenEmailId = null, onClearPendingOpenEmailId }) {
  const komm    = client.kommunikation ?? { events: [], standardAbsender: '' }
  const events  = Array.isArray(komm.events) ? komm.events : []
  const absender = loadAbsender()

  // ── Draft-Wiederherstellung ──────────────────────────────────────────────────
  const [_draft] = useState(() => loadMainDraft(client.id))
  const [draftRestored, setDraftRestored] = useState(() => !!(
    _draft && (_draft.editorOpen || _draft.betreff || _draft.text || _draft.empfaenger)
  ))
  const draftSaveRef = useRef(null)

  // Editor State (mit Draft-Initialisierung)
  const [editorOpen,  setEditorOpen]  = useState(_draft?.editorOpen ?? false)
  const [activTyp,    setActivTyp]    = useState(_draft?.activTyp ?? 'frei')
  const [empfaenger,  setEmpfaenger]  = useState(_draft?.empfaenger ?? '')
  const [absenderVal, setAbsenderVal] = useState(_draft?.absenderVal ?? (komm.standardAbsender || (absender.find(a => a.isDefault)?.email ?? '')))
  const [betreff,     setBetreff]     = useState(_draft?.betreff ?? '')
  const [text,        setText]        = useState(_draft?.text ?? '')
  const [cc,          setCC]          = useState(_draft?.cc ?? '')
  const [bcc,         setBCC]         = useState(_draft?.bcc ?? '')
  const [showBCC,     setShowBCC]     = useState(_draft?.showBCC ?? false)

  // Anhänge State
  const [attachments,  setAttachments]  = useState(_draft?.attachments ?? [])
  const [isDragOver,   setIsDragOver]   = useState(false)
  const fileInputRef = useRef(null)

  // Vorlagen
  const [showVorlagenSelect,  setShowVorlagenSelect]  = useState(false)
  const [showVorlagenModal,   setShowVorlagenModal]   = useState(false)

  // Signaturen
  const [activeSignaturId,    setActiveSignaturId]    = useState(_draft?.activeSignaturId ?? komm.standardSignaturId ?? null)
  const [showSignaturSelect,  setShowSignaturSelect]  = useState(false)
  const [showSignaturenModal, setShowSignaturenModal] = useState(false)

  // UI State
  const [aiLoading,    setAiLoading]   = useState(false)
  const [aiError,      setAiError]    = useState('')
  const [aiFreitext,   setAiFreitext] = useState('')
  const [isRecording,  setIsRecording] = useState(false)
  const [sendLoading,         setSendLoading]         = useState(false)
  const [sendOutlookLoading,  setSendOutlookLoading]  = useState(false)
  const [sendError,           setSendError]           = useState('')
  const [filter,      setFilter]      = useState('alle')
  const [expanded,    setExpanded]    = useState(null)
  const [detailEntry, setDetailEntry] = useState(null)   // E-Mail-Panel
  const [actionForm,  setActionForm]  = useState(null)   // 'aufgabe'|'erinnerung'|null
  const [showAbsenderModal, setShowAbsenderModal] = useState(false)

  // Inhalt-Loading State (keyed by event.id)
  const [contentLoading, setContentLoading] = useState({})
  const [contentError,   setContentError]   = useState({})
  const [attachmentData, setAttachmentData] = useState({})  // Anhang-Binärdaten (nicht persistiert)

  // KI-Mailsuche (Ansatz A: Inhalte on-demand laden + Claude durchsuchen lassen)
  const [mailSuche,     setMailSuche]     = useState('')
  const [sucheLoading,  setSucheLoading]  = useState(false)
  const [sucheError,    setSucheError]    = useState('')
  const [sucheErgebnis, setSucheErgebnis] = useState(null)  // { antwort, treffer:[{id,zitat,warum}] }
  const [mailModus,     setMailModus]     = useState('suchen') // 'suchen' | 'briefing'
  const [briefErgebnis, setBriefErgebnis] = useState(null)  // { ueberblick, verlauf[], zusammenfassung, handlungsempfehlungen[], offenePunkte[] }
  const [istDiktat,     setIstDiktat]     = useState(false)
  const diktatRef = useRef(null)

  // Posteingang State
  const [posteingangOpen,   setPosteingangOpen]   = useState(false)
  const [posteingangEmails, setPosteingangEmails] = useState([])
  const [posteingangLoad,   setPosteingangLoad]   = useState(false)
  const [posteingangError,  setPosteingangError]  = useState('')
  const [unbekannt,         setUnbekannt]         = useState([]) // nicht zugeordnete E-Mails
  // Ordner-Auswahl
  const [selectedFolder,    setSelectedFolder]    = useState('INBOX')
  const [availFolders,      setAvailFolders]      = useState([])
  const [foldersLoading,    setFoldersLoading]    = useState(false)

  // Microsoft Graph Mailsuche (alle Ordner)
  const [graphSearchOpen,    setGraphSearchOpen]    = useState(false)
  const [graphSearchEmail,   setGraphSearchEmail]   = useState('')
  const [graphSearchLoading, setGraphSearchLoading] = useState(false)
  const [graphSearchResults, setGraphSearchResults] = useState(null)  // null = noch nicht gesucht
  const [graphSearchError,   setGraphSearchError]   = useState('')
  const [graphFolderNames,   setGraphFolderNames]   = useState({})   // folderId → displayName

  // OneDrive-Anhänge empfangen (von DokumenteTab via DetailView)
  useEffect(() => {
    if (!pendingAttachments?.length) return
    setAttachments(prev => [
      ...prev,
      ...pendingAttachments.map(a => ({
        id: 'od_' + Date.now().toString(36) + Math.random().toString(36).slice(2),
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      }))
    ])
    setEditorOpen(true)
    onClearPendingAttachments?.()
  }, [pendingAttachments])

  // E-Mail direkt aus globaler Suche öffnen
  useEffect(() => {
    if (!pendingOpenEmailId) return
    const found = events.find(e => e.id === pendingOpenEmailId)
    if (found) {
      setDetailEntry(found)
      setActionForm(null)
    }
    onClearPendingOpenEmailId?.()
  }, [pendingOpenEmailId])

  // ── Auto-Save: Editor-Entwurf in localStorage ────────────────────────────────
  useEffect(() => {
    clearTimeout(draftSaveRef.current)
    draftSaveRef.current = setTimeout(() => {
      const hasContent = editorOpen || text || betreff || empfaenger
      if (!hasContent) { clearMainDraft(client.id); return }
      saveMainDraft(client.id, {
        editorOpen, activTyp, empfaenger, absenderVal, betreff, text,
        cc, bcc, showBCC, activeSignaturId,
        attachments: attachments.map(a => ({ ...a })),
      })
    }, 800)
    return () => clearTimeout(draftSaveRef.current)
  }, [editorOpen, activTyp, empfaenger, absenderVal, betreff, text, cc, bcc, showBCC, activeSignaturId, attachments])

  function saveKomm(patch) {
    onUpdate({ kommunikation: { ...komm, ...patch } })
  }

  // Signatur in Text anwenden
  function applySignatur(sigId) {
    if (!sigId) {
      setText(prev => removeSig(prev))
      setActiveSignaturId(null)
    } else {
      const sig = emailSignaturen.find(s => s.id === sigId)
      if (sig) {
        setText(prev => insertSig(prev, sig.text))
        setActiveSignaturId(sigId)
      }
    }
    setShowSignaturSelect(false)
  }

  // Neuen Editor öffnen (mit Standard-Signatur)
  function openNewEditor() {
    const defaultSig = emailSignaturen.find(s => s.isDefault)
    if (defaultSig) {
      setText(SIG_SEP + defaultSig.text)
      setActiveSignaturId(defaultSig.id)
    } else {
      setActiveSignaturId(null)
    }
    setEditorOpen(true)
  }

  // Vorlage direkt als Schnellaktion öffnen (Editor + Vorlage in einem Schritt)
  function openWithVorlage(vorlage) {
    const name  = client.name ?? ''
    const vj    = String(client.veranlagungsjahr ?? new Date().getFullYear())
    const monat = new Date().toLocaleDateString('de-DE', { month: 'long' })
    const fill  = str => (str ?? '')
      .replace(/\{\{name\}\}/gi, name)
      .replace(/\{\{vj\}\}/gi, vj)
      .replace(/\{\{monat\}\}/gi, monat)
    const defaultSig = emailSignaturen.find(s => s.isDefault)
    const filledText = fill(vorlage.text)
    setBetreff(fill(vorlage.betreff))
    setText(defaultSig ? filledText + SIG_SEP + defaultSig.text : filledText)
    setActiveSignaturId(defaultSig?.id ?? null)
    if (vorlage.cc) setCC(vorlage.cc)
    setActivTyp('frei')
    setEditorOpen(true)
  }

  // Schnellaktion → Editor befüllen
  function openQuickAction(typ) {
    const tpl = buildTemplate(typ, client)
    setActivTyp(typ)
    setBetreff(tpl.betreff)
    const defaultSig = emailSignaturen.find(s => s.isDefault)
    if (defaultSig) {
      setText(tpl.text + SIG_SEP + defaultSig.text)
      setActiveSignaturId(defaultSig.id)
    } else {
      setText(tpl.text)
      setActiveSignaturId(null)
    }
    setEditorOpen(true)
  }

  // Entwurf speichern
  function saveEntwurf() {
    if (!betreff && !text) return
    const entry = {
      id: 'k' + Date.now().toString(36),
      typ: activTyp,
      empfaenger, absender: absenderVal, betreff, text, cc, bcc,
      status: 'entwurf',
      erstelltAm: new Date().toISOString(),
      gesendetAm: null,
      anlagen: attachments.length > 0 ? attachments.map(a => ({ name: a.name, size: a.size })) : undefined,
    }
    saveKomm({ events: [entry, ...events] })
    resetEditor()
  }

  // SMTP Senden
  async function handleSendSMTP() {
    if (!empfaenger || !betreff || !text) {
      setSendError('Bitte Empfänger, Betreff und Text ausfüllen.')
      return
    }
    setSendLoading(true)
    setSendError('')
    const selectedAbsender = absender.find(a => a.email === absenderVal)
    const account = selectedAbsender?.konto || 'hostinger'
    const smtpAttachments = attachments.map(a => ({ filename: a.name, content: a.data, contentType: a.type }))
    try {
      const result = await sendViaSMTP({ to: empfaenger, from: absenderVal, subject: betreff, text, cc, bcc, account, attachments: smtpAttachments })
      const now = new Date().toISOString()
      const entry = {
        id: 'k' + Date.now().toString(36),
        typ: activTyp,
        empfaenger, absender: absenderVal, betreff, text, cc, bcc,
        status: 'gesendet',
        versandweg: 'smtp',
        sentFolderOk: result?.sentFolderOk ?? null,
        erstelltAm: now,
        gesendetAm: now,
        anlagen: attachments.length > 0 ? attachments.map(a => ({ name: a.name, size: a.size })) : undefined,
      }
      saveKomm({ events: [entry, ...events] })
      applyStatusUpdates(activTyp, now)
      // Warnung wenn Sent-Ordner-Kopie fehlschlug
      if (result?.sentFolderOk === false) {
        setSendError(`✅ E-Mail wurde gesendet – aber Kopie konnte nicht in Ihren Postfach-Ordner "Gesendet" gespeichert werden. (${result.sentFolderErr ?? 'unbekannter Fehler'})`)
      } else {
        resetEditor()
      }
    } catch (e) {
      setSendError(e.message)
    } finally {
      setSendLoading(false)
    }
  }

  // Senden über Microsoft Graph API (Outlook)
  async function handleSendOutlook() {
    if (!empfaenger || !betreff || !text) {
      setSendError('Bitte Empfänger, Betreff und Text ausfüllen.')
      return
    }
    setSendOutlookLoading(true)
    setSendError('')

    let tokens = onedriveTokens
    try {
      // Wenn noch keine Tokens → OAuth-Login starten
      if (!tokens?.accessToken) {
        try {
          tokens = await openAuthPopup()
          onUpdateOnedriveTokens?.(tokens)
        } catch (authErr) {
          setSendError('Outlook-Anmeldung fehlgeschlagen: ' + authErr.message)
          setSendOutlookLoading(false)
          return
        }
      }

      const outlookAttachments = attachments.map(a => ({
        filename:    a.name,
        content:     a.data,
        contentType: a.type,
      }))

      await sendMailGraph(
        { to: empfaenger, subject: betreff, body: text, cc: cc || undefined, bcc: bcc || undefined, attachments: outlookAttachments },
        tokens,
        (newTokens) => onUpdateOnedriveTokens?.(newTokens),
      )

      const now = new Date().toISOString()
      const entry = {
        id: 'k' + Date.now().toString(36),
        typ: activTyp,
        empfaenger, absender: absenderVal, betreff, text, cc, bcc,
        status:      'gesendet',
        versandweg:  'outlook',
        erstelltAm:  now,
        gesendetAm:  now,
        anlagen: attachments.length > 0 ? attachments.map(a => ({ name: a.name, size: a.size })) : undefined,
      }
      saveKomm({ events: [entry, ...events] })
      applyStatusUpdates(activTyp, now)
      resetEditor()
    } catch (e) {
      setSendError(e.message)
    } finally {
      setSendOutlookLoading(false)
    }
  }

  // Als gesendet markieren (manuell, ohne SMTP)
  function markGesendetManuell() {
    if (!betreff && !text) return
    const now = new Date().toISOString()
    const entry = {
      id: 'k' + Date.now().toString(36),
      typ: activTyp,
      empfaenger, absender: absenderVal, betreff, text, cc, bcc,
      status: 'gesendet',
      erstelltAm: now,
      gesendetAm: now,
      anlagen: attachments.length > 0 ? attachments.map(a => ({ name: a.name, size: a.size })) : undefined,
    }
    saveKomm({ events: [entry, ...events] })
    applyStatusUpdates(activTyp, now)
    resetEditor()
  }

  // mailto öffnen ohne zu speichern
  function handleMailto() {
    openMailto({ empfaenger, betreff, text, cc, bcc })
  }

  function resetEditor() {
    clearMainDraft(client.id)
    setDraftRestored(false)
    setEditorOpen(false)
    setBetreff('')
    setText('')
    setCC('')
    setBCC('')
    setEmpfaenger('')
    setActivTyp('frei')
    setAiError('')
    setAttachments([])
    setShowVorlagenSelect(false)
    setActiveSignaturId(null)
    setShowSignaturSelect(false)
  }

  // ── Anhänge ──────────────────────────────────────────────────────────────────
  function addFiles(fileList) {
    Array.from(fileList).forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const base64 = ev.target.result.split(',')[1]
        setAttachments(prev => [...prev, {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2),
          name: file.name, size: file.size, type: file.type, data: base64,
        }])
      }
      reader.readAsDataURL(file)
    })
  }

  function handleFileSelect(e) {
    addFiles(e.target.files ?? [])
    e.target.value = ''
  }

  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragOver) setIsDragOver(true)
  }

  function handleDragLeave(e) {
    // Nur auslösen wenn wirklich außerhalb (nicht bei Child-Elementen)
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false)
  }

  function removeAttachment(id) {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  function fmtFileSize(bytes) {
    if (bytes < 1024)        return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  // ── E-Mail-Vollinhalt nachladen (Fetch-on-Open) ──────────────────────────────
  async function fetchEmailContent(entry) {
    if (contentLoading[entry.id] || !entry.sourceUid || !entry.sourceAccount) return
    setContentLoading(prev => ({ ...prev, [entry.id]: true }))
    setContentError(prev => ({ ...prev, [entry.id]: '' }))
    try {
      const res  = await fetch(`/api/get-email-content?uid=${encodeURIComponent(entry.sourceUid)}&account=${encodeURIComponent(entry.sourceAccount)}`)
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`)
      // Text + HTML + Anlage-Metadaten + CC/An persistent in Event speichern
      const updatedEvents = events.map(e => e.id !== entry.id ? e : {
        ...e,
        text:          data.text ?? e.text,
        html:          data.html ?? undefined,
        anlagen:       data.attachments.map(a => ({ name: a.name, size: a.size, contentType: a.contentType, tooLarge: a.tooLarge ?? false })),
        contentLoaded: true,
        ...(data.cc  ? { cc: data.cc }            : {}),
        ...(data.to  ? { empfaenger: data.to }     : {}),
        ...(data.from ? { absender: data.from }     : {}),
      })
      saveKomm({ events: updatedEvents })
      // detailEntry aktualisieren damit Inhalt sofort angezeigt wird (nicht erst beim 2. Klick)
      const enriched = updatedEvents.find(e => e.id === entry.id)
      if (enriched) setDetailEntry(enriched)
      // Anhang-Binärdaten nur im Component-State (nicht in Supabase)
      setAttachmentData(prev => ({ ...prev, [entry.id]: data.attachments }))
    } catch (e) {
      setContentError(prev => ({ ...prev, [entry.id]: e.message }))
    } finally {
      setContentLoading(prev => ({ ...prev, [entry.id]: false }))
    }
  }

  // ── KI-Mailsuche ─────────────────────────────────────────────────────────────
  // Body einer Mail besorgen (aus Event oder on-demand per IMAP), ohne State-Spam.
  async function ladeBody(entry) {
    if (entry.text) return entry.text
    if (!entry.sourceUid || !entry.sourceAccount) return ''
    try {
      const res = await fetch(`/api/get-email-content?uid=${encodeURIComponent(entry.sourceUid)}&account=${encodeURIComponent(entry.sourceAccount)}`)
      const d = await res.json()
      if (!res.ok || d.error) return ''
      return d.text || ''
    } catch { return '' }
  }
  // Begrenzte Parallelität, damit wir nicht zig IMAP-Requests gleichzeitig feuern.
  async function mapPool(items, fn, size = 4) {
    const out = new Array(items.length); let i = 0
    const worker = async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx) } }
    await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker))
    return out
  }
  async function handleMailSuche() {
    const q = mailSuche.trim(); if (!q) return
    if (!hasAiKey()) { setSucheError('Kein KI-API-Schlüssel hinterlegt (Stammdaten → ⚙️ → API-Schlüssel).'); return }
    setSucheLoading(true); setSucheError(''); setSucheErgebnis(null)
    try {
      const kandidaten = events.filter(e => e && (e.betreff || e.text || e.sourceUid)).slice(0, 50)
      if (!kandidaten.length) { setSucheErgebnis({ antwort: 'Für diesen Mandanten sind noch keine Mails erfasst.', treffer: [] }); return }
      const texte = await mapPool(kandidaten, ladeBody, 4)
      // neu geladene Inhalte einmalig in die Events übernehmen (spart künftiges Nachladen)
      const geladen = {}; kandidaten.forEach((e, idx) => { if (!e.text && texte[idx]) geladen[e.id] = texte[idx] })
      if (Object.keys(geladen).length) saveKomm({ events: events.map(e => geladen[e.id] ? { ...e, text: geladen[e.id], contentLoaded: true } : e) })
      const corpus = kandidaten.map((e, idx) => {
        const body = (e.text || texte[idx] || '').replace(/\s+/g, ' ').slice(0, 1500)
        return `[${e.id}] Datum: ${fmtDatum(e.gesendetAm ?? e.erstelltAm)} | Von: ${e.absender || ''} | Betreff: ${e.betreff || ''}\n${body || '(kein Textinhalt verfügbar)'}`
      }).join('\n\n---\n\n')
      const sys = 'Du durchsuchst die E-Mails eines Steuerberater-Mandanten. Finde NUR E-Mails, die zur Suchanfrage passen (Hinweise/Informationen dazu). Antworte AUSSCHLIESSLICH als JSON: {"antwort":"kurze deutsche Zusammenfassung der Fundstellen","treffer":[{"id":"die [ID] der Mail","zitat":"kurzes wörtliches Zitat aus der Mail","warum":"warum relevant"}]}. Wenn nichts passt: "treffer":[] und in "antwort" kurz erklären. Erfinde keine Inhalte; zitiere nur, was wirklich in der Mail steht.'
      const user = `Suchanfrage: ${q}\n\nE-Mails:\n${corpus}`
      const r = await callAI(sys, user)
      setSucheErgebnis({ antwort: r.antwort || r.text || '', treffer: Array.isArray(r.treffer) ? r.treffer : [] })
    } catch (e) {
      setSucheError(e.message || String(e))
    } finally {
      setSucheLoading(false)
    }
  }
  function oeffneTreffer(id) {
    const ev = events.find(e => e.id === id); if (!ev) return
    setDetailEntry(ev); setActionForm(null)
    if (ev.typ === 'eingehend' && !ev.contentLoaded && ev.sourceUid) fetchEmailContent(ev)
  }

  // Zeitraum aus der Anfrage deterministisch erkennen (nicht von der KI raten lassen)
  function parseZeitraum(q) {
    const s = (q || '').toLowerCase(); const now = new Date()
    const sod = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
    let m
    if ((m = s.match(/(?:letzt\w*\s+)?(\d{1,3})\s*tag/))) { const n = +m[1]; const seit = sod(now); seit.setDate(seit.getDate() - n); return { seit, label: `letzte ${n} Tage` } }
    if (/diese\s+woche/.test(s)) { const seit = sod(now); seit.setDate(seit.getDate() - ((seit.getDay() + 6) % 7)); return { seit, label: 'diese Woche' } }
    if (/letzte\s+woche/.test(s)) { const seit = sod(now); seit.setDate(seit.getDate() - ((seit.getDay() + 6) % 7) - 7); const bis = new Date(seit); bis.setDate(bis.getDate() + 7); return { seit, bis, label: 'letzte Woche' } }
    if ((m = s.match(/letzt\w*\s+(\d{1,2})\s*monat/))) { const n = +m[1]; const seit = sod(now); seit.setMonth(seit.getMonth() - n); return { seit, label: `letzte ${n} Monate` } }
    if (/diese[nm]?\s+monat/.test(s)) { return { seit: new Date(now.getFullYear(), now.getMonth(), 1), label: 'dieser Monat' } }
    if ((m = s.match(/seit\s+(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/))) { const d = +m[1], mo = +m[2] - 1; let y = m[3] ? +m[3] : now.getFullYear(); if (y < 100) y += 2000; return { seit: new Date(y, mo, d), label: `seit ${m[1]}.${m[2]}.${y}` } }
    return null
  }

  async function handleBriefing() {
    const q = mailSuche.trim()
    if (!hasAiKey()) { setSucheError('Kein KI-API-Schlüssel hinterlegt (Stammdaten → ⚙️ → API-Schlüssel).'); return }
    setSucheLoading(true); setSucheError(''); setBriefErgebnis(null); setSucheErgebnis(null)
    try {
      const zr = parseZeitraum(q)
      const dOf = e => { const d = new Date(e.gesendetAm ?? e.erstelltAm); return isNaN(d) ? null : d }
      let list = events.filter(e => e && (e.betreff || e.text || e.sourceUid))
      if (zr) list = list.filter(e => { const d = dOf(e); return d && d >= zr.seit && (!zr.bis || d < zr.bis) })
      else { const seit = new Date(); seit.setDate(seit.getDate() - 14); list = list.filter(e => { const d = dOf(e); return d && d >= seit }) }
      list = list.sort((a, b) => (dOf(a) || 0) - (dOf(b) || 0)).slice(-60)
      if (!list.length) { setBriefErgebnis({ ueberblick: `Keine Nachrichten im Zeitraum${zr ? ` (${zr.label})` : ' (letzte 14 Tage)'}.`, verlauf: [], zusammenfassung: '', handlungsempfehlungen: [], offenePunkte: [] }); return }
      const texte = await mapPool(list, ladeBody, 4)
      const geladen = {}; list.forEach((e, i) => { if (!e.text && texte[i]) geladen[e.id] = texte[i] })
      if (Object.keys(geladen).length) saveKomm({ events: events.map(e => geladen[e.id] ? { ...e, text: geladen[e.id], contentLoaded: true } : e) })
      const corpus = list.map((e, i) => {
        const richtung = e.typ === 'ausgehend' ? 'AUSGEHEND (von uns)' : 'EINGEHEND (extern)'
        const body = (e.text || texte[i] || '').replace(/\s+/g, ' ').slice(0, 1500)
        return `Datum: ${fmtDatum(e.gesendetAm ?? e.erstelltAm)} | ${richtung} | Von: ${e.absender || ''} | Betreff: ${e.betreff || ''}\n${body || '(kein Textinhalt)'}`
      }).join('\n\n---\n\n')
      const sys = 'Du bist die Assistenz eines Steuerberaters und fasst E-Mail-Korrespondenz mit einem Mandanten zusammen. Antworte AUSSCHLIESSLICH als JSON: {"ueberblick":"1 Satz: Zeitraum, Anzahl Nachrichten, Beteiligte/Thema","verlauf":["chronologische Stichpunkte, je: Datum – Richtung – was passierte"],"zusammenfassung":"kurzer Fließtext: worum es geht und wo es aktuell steht","handlungsempfehlungen":["konkrete nächste Schritte für den Steuerberater"],"offenePunkte":["unbeantwortete Fragen / worauf gewartet wird"]}. Nutze nur, was in den Mails steht; nichts erfinden. Deutsch.'
      const user = `Aufgabe: ${q || 'Fasse die Korrespondenz zusammen'}\nZeitraum: ${zr ? zr.label : 'letzte 14 Tage'}\n\nKorrespondenz (chronologisch):\n${corpus}`
      const r = await callAI(sys, user)
      setBriefErgebnis({
        ueberblick: r.ueberblick || r.text || '',
        verlauf: Array.isArray(r.verlauf) ? r.verlauf : [],
        zusammenfassung: r.zusammenfassung || '',
        handlungsempfehlungen: Array.isArray(r.handlungsempfehlungen) ? r.handlungsempfehlungen : [],
        offenePunkte: Array.isArray(r.offenePunkte) ? r.offenePunkte : [],
      })
    } catch (e) { setSucheError(e.message || String(e)) }
    finally { setSucheLoading(false) }
  }

  function toggleDiktat() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setSucheError('Diktat wird in diesem Browser/Kontext nicht unterstützt – bitte tippen.'); return }
    if (diktatRef.current) { try { diktatRef.current.stop() } catch {} diktatRef.current = null; setIstDiktat(false); return }
    const r = new SR(); r.lang = 'de-DE'; r.continuous = true; r.interimResults = true; let base = mailSuche
    r.onresult = e => { let fin = ''; for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) fin += e.results[i][0].transcript } if (fin) { base = (base + ' ' + fin).trim(); setMailSuche(base) } }
    r.onerror = () => { setIstDiktat(false) }
    r.onend = () => { setIstDiktat(false); diktatRef.current = null }
    try { r.start(); diktatRef.current = r; setIstDiktat(true) } catch {}
  }

  function downloadAttachment(att) {
    const bytes = atob(att.data)
    const arr   = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
    const blob  = new Blob([arr], { type: att.contentType || 'application/octet-stream' })
    const url   = URL.createObjectURL(blob)
    const a     = document.createElement('a')
    a.href = url; a.download = att.name; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Vorlage anwenden ─────────────────────────────────────────────────────────
  function applyVorlage(vorlage) {
    const name  = client.name ?? ''
    const vj    = String(client.veranlagungsjahr ?? new Date().getFullYear())
    const monat = new Date().toLocaleDateString('de-DE', { month: 'long' })
    const fill  = str => (str ?? '')
      .replace(/\{\{name\}\}/gi, name)
      .replace(/\{\{vj\}\}/gi, vj)
      .replace(/\{\{monat\}\}/gi, monat)
    setBetreff(fill(vorlage.betreff))
    // Aktive Signatur erhalten
    const activeSig = emailSignaturen.find(s => s.id === activeSignaturId)
    const filledText = fill(vorlage.text)
    setText(activeSig ? filledText + SIG_SEP + activeSig.text : filledText)
    if (vorlage.cc) setCC(vorlage.cc)
    setShowVorlagenSelect(false)
  }

  // Status-Verknüpfungen
  function applyStatusUpdates(typ, now) {
    const today = now.slice(0, 10)
    const st    = client.status ?? {}
    const sq    = st.schnellauswahl ?? {}

    const patch = {
      status: {
        ...st,
        letzterKontakt: { datum: now, art: 'email', notiz: TYP_CONFIG[typ]?.label ?? '' },
      },
    }

    if (typ === 'rueckfragen') {
      const sendungen = [...(client.rueckfragenSendungen ?? ['', '', '', ''])]
      sendungen[0] = today
      patch.rueckfragenSendungen = sendungen
      patch.status.schnellauswahl = { ...sq, rueckfragenGesendet: { aktiv: true, datum: now } }
    } else if (typ === 'unterschrift') {
      patch.steGesendetDatum = today
      patch.status.schnellauswahl = { ...sq, steuerUnterschrift: { aktiv: true, datum: now } }
    } else if (typ === 'erinnerung') {
      patch.status.schnellauswahl = { ...sq, warteRueckmeldung: { aktiv: true, datum: now } }
    }

    onUpdate(patch)
  }

  // Entwurf aus Historie nachträglich senden (SMTP)
  async function sendFromHistory(entry) {
    const selectedAbsender = absender.find(a => a.email === entry.absender)
    const account = selectedAbsender?.konto || 'hostinger'
    try {
      await sendViaSMTP({ to: entry.empfaenger, from: entry.absender, subject: entry.betreff, text: entry.text, cc: entry.cc, bcc: entry.bcc, account })
      const now = new Date().toISOString()
      saveKomm({
        events: events.map(e => e.id === entry.id
          ? { ...e, status: 'gesendet', gesendetAm: now }
          : e
        ),
      })
      applyStatusUpdates(entry.typ, now)
    } catch (e) {
      // Fallback: mailto öffnen
      openMailto({ empfaenger: entry.empfaenger, betreff: entry.betreff, text: entry.text, cc: entry.cc, bcc: entry.bcc })
    }
  }

  // KI-Entwurf erzeugen
  async function handleKIEntwurf() {
    setAiLoading(true)
    setAiError('')
    try {
      const result = await callClaude(buildKIEntwurfPrompt(activTyp, client), 'Erstelle den E-Mail-Entwurf.')
      if (result.betreff) setBetreff(result.betreff)
      if (result.text) {
        const activeSig = emailSignaturen.find(s => s.id === activeSignaturId)
        setText(activeSig ? result.text + SIG_SEP + activeSig.text : result.text)
      }
    } catch (e) {
      setAiError(e.message)
    } finally {
      setAiLoading(false)
    }
  }

  // KI-Reformulierung
  async function handleReformulate(art) {
    if (!text.trim()) return
    setAiLoading(true)
    setAiError('')
    try {
      const prompt = `Formuliere diesen E-Mail-Text ${art} um. Behalte alle inhaltlichen Punkte bei. Antworte NUR mit JSON: {"text":"..."}`
      const result = await callClaude(prompt, text)
      if (result.text) setText(result.text)
    } catch (e) {
      setAiError(e.message)
    } finally {
      setAiLoading(false)
    }
  }

  // KI-Freitext-Anweisung
  async function handleKIFreitext(anweisung) {
    if (!anweisung.trim()) return
    setAiLoading(true)
    setAiError('')
    try {
      const hatText = text.trim().length > 0
      const prompt = hatText
        ? `Du bist ein Kanzlei-Assistent. Führe folgende Anweisung mit dem E-Mail-Text aus: "${anweisung}". Antworte NUR mit JSON: {"betreff":"...","text":"..."} – betreff darf leer bleiben wenn unverändert.`
        : `Du bist ein Kanzlei-Assistent für den Mandanten "${client.name}". Führe folgende Anweisung aus: "${anweisung}". Antworte NUR mit JSON: {"betreff":"...","text":"..."}`
      const input = hatText ? text : `Mandant: ${client.name}, VJ: ${client.veranlagungsjahr ?? ''}`
      const result = await callClaude(prompt, input)
      if (result.text) {
        const activeSig = emailSignaturen.find(s => s.id === activeSignaturId)
        setText(activeSig ? result.text + SIG_SEP + activeSig.text : result.text)
      }
      if (result.betreff) setBetreff(result.betreff)
    } catch (e) {
      setAiError(e.message)
    } finally {
      setAiLoading(false)
    }
  }

  // KI-Spracheingabe (Web Speech API)
  function startSpeechInput(onResult) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRec) { setAiError('Spracheingabe wird von diesem Browser nicht unterstützt (Chrome/Edge empfohlen).'); return }
    const rec = new SpeechRec()
    rec.lang = 'de-DE'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = e => { onResult(e.results[0][0].transcript) }
    rec.onerror  = e => setAiError('Spracheingabe Fehler: ' + e.error)
    rec.start()
  }

  // Ordnerliste laden
  async function loadFolders() {
    if (availFolders.length > 0) return
    setFoldersLoading(true)
    try {
      const [h, s, g] = await Promise.all([
        fetch('/api/list-folders?account=hostinger').then(r => r.json()).catch(() => ({ folders: [] })),
        fetch('/api/list-folders?account=strato').then(r => r.json()).catch(() => ({ folders: [] })),
        fetch('/api/list-folders?account=gmail').then(r => r.json()).catch(() => ({ folders: [] })),
      ])
      const combined = [
        ...(h.folders ?? []).map(f => ({ ...f, account: 'hostinger' })),
        ...(s.folders ?? []).map(f => ({ ...f, account: 'strato' })),
        ...(g.folders ?? []).map(f => ({ ...f, account: 'gmail' })),
      ]
      setAvailFolders(combined)
    } finally {
      setFoldersLoading(false)
    }
  }

  // Posteingang abrufen
  async function handleFetchEmails() {
    setPosteingangLoad(true)
    setPosteingangError('')
    try {
      // Wenn ein spezifischer Ordner ausgewählt, nur den laden
      const isSpecific = selectedFolder !== 'INBOX'
      const [h, s, g] = await Promise.all([
        fetchEmails('hostinger', null, isSpecific ? selectedFolder : 'INBOX').catch(e => { console.warn('Hostinger IMAP:', e.message); return [] }),
        fetchEmails('strato',    null, isSpecific ? selectedFolder : 'INBOX').catch(e => { console.warn('Strato IMAP:', e.message); return [] }),
        fetchEmails('gmail',     null, isSpecific ? selectedFolder : 'INBOX').catch(e => { console.warn('Gmail IMAP:', e.message); return [] }),
      ])
      const all = [...h, ...s, ...g].sort((a, b) => new Date(b.datum) - new Date(a.datum))
      setPosteingangEmails(all)
      setPosteingangOpen(true)
    } catch (e) {
      setPosteingangError(e.message)
    } finally {
      setPosteingangLoad(false)
    }
  }

  // ── Microsoft Graph: Alle Ordner nach E-Mail-Adresse durchsuchen ────────────
  async function handleGraphSearch() {
    const email = graphSearchEmail.trim()
    if (!email) return
    setGraphSearchLoading(true)
    setGraphSearchError('')
    setGraphSearchResults(null)
    setGraphFolderNames({})
    try {
      let tokens = onedriveTokens
      // Noch kein Token → normaler OneDrive-Login
      if (!tokens?.accessToken) {
        try {
          tokens = await openAuthPopup()
          onUpdateOnedriveTokens?.(tokens)
        } catch (authErr) {
          setGraphSearchError('Bitte zuerst mit Microsoft verbinden.')
          return
        }
      }
      const refreshTokens = (t) => onUpdateOnedriveTokens?.(t)

      // Erst versuchen zu suchen
      let res
      try {
        res = await callApi('searchMails', { email, maxResults: 100 }, tokens, refreshTokens)
      } catch (searchErr) {
        // 403 / Authorization_RequestDenied → Mail.Read fehlt → separates Auth-Popup
        if (searchErr.message?.includes('403') || searchErr.message?.includes('Authorization') || searchErr.message?.includes('Mail') || searchErr.message?.includes('Access is denied') || searchErr.message?.includes('Insufficient privileges')) {
          setGraphSearchLoading(false)
          setGraphSearchError('mail_read_missing')
          return
        }
        throw searchErr
      }

      setGraphSearchResults(res.messages ?? [])
      // Ordnernamen asynchron nachladen
      const folderIds = [...new Set((res.messages ?? []).map(m => m.parentFolderId).filter(Boolean))]
      for (const folderId of folderIds.slice(0, 20)) {
        callApi('getMailFolderName', { folderId }, tokens, refreshTokens)
          .then(r => setGraphFolderNames(prev => ({ ...prev, [folderId]: r.name })))
          .catch(() => {})
      }
    } catch (err) {
      setGraphSearchError(err.message)
    } finally {
      setGraphSearchLoading(false)
    }
  }

  // Separates Auth-Popup für Mail.Read (nur wenn fehlende Berechtigung erkannt)
  async function handleRequestMailRead() {
    setGraphSearchError('')
    setGraphSearchLoading(true)
    try {
      const tokens = await openAuthPopup('/api/mail-auth')
      onUpdateOnedriveTokens?.(tokens)
      setGraphSearchLoading(false)
      // Direkt nochmal suchen mit neuen Tokens
      await handleGraphSearch()
    } catch (err) {
      setGraphSearchError('Anmeldung fehlgeschlagen: ' + err.message)
      setGraphSearchLoading(false)
    }
  }

  function graphMessageToEvent(msg) {
    // Graph-Mail in das Dashboard-interne Format umwandeln
    const fromAddr  = msg.from?.emailAddress?.address ?? ''
    const fromName  = msg.from?.emailAddress?.name ?? ''
    const toAddr    = (msg.toRecipients ?? []).map(r => r.emailAddress?.address).filter(Boolean).join(', ')
    const myEmails  = new Set((client.kontakte ?? []).map(k => k.email?.toLowerCase()).filter(Boolean))
    const isIncoming = myEmails.has(fromAddr.toLowerCase())
    return {
      id:          'graph_' + msg.id.slice(-16),
      graphId:     msg.id,
      typ:         isIncoming ? 'eingehend' : 'eingehend', // beide als eingehend – Graph liefert alles
      betreff:     msg.subject ?? '(kein Betreff)',
      absender:    fromName ? `${fromName} <${fromAddr}>` : fromAddr,
      empfaenger:  toAddr,
      erstelltAm:  msg.receivedDateTime ?? msg.sentDateTime ?? new Date().toISOString(),
      gesendetAm:  msg.sentDateTime ?? null,
      text:        msg.bodyPreview ?? '',
      anlagen:     (msg.attachments ?? []).map(a => ({ name: a.name, size: a.size, contentType: a.contentType })),
      status:      'gesendet',
      quelle:      'graph',
    }
  }

  function importGraphMessage(msg) {
    const ev = graphMessageToEvent(msg)
    // Nicht importieren wenn bereits vorhanden (gleicher betreff + datum)
    const exists = events.some(e => e.graphId === ev.graphId || (e.betreff === ev.betreff && e.erstelltAm?.slice(0, 10) === ev.erstelltAm?.slice(0, 10)))
    if (exists) return false
    saveKomm({ events: [ev, ...events] })
    return true
  }

  function importAllGraphResults() {
    if (!graphSearchResults?.length) return
    let imported = 0
    const newEvents = [...events]
    for (const msg of graphSearchResults) {
      const ev = graphMessageToEvent(msg)
      const exists = newEvents.some(e => e.graphId === ev.graphId || (e.betreff === ev.betreff && e.erstelltAm?.slice(0, 10) === ev.erstelltAm?.slice(0, 10)))
      if (!exists) { newEvents.unshift(ev); imported++ }
    }
    if (imported > 0) saveKomm({ events: newEvents })
    return imported
  }

  // ── Auto-Aktualisieren: neue E-Mails dieses Mandanten automatisch zuordnen ──
  const [refreshLoading,  setRefreshLoading]  = useState(false)
  const [refreshResult,   setRefreshResult]   = useState(null)  // { count, noEmails }

  async function handleAutoRefresh() {
    setRefreshLoading(true)
    setRefreshResult(null)

    // Alle E-Mail-Adressen die diesem Mandanten gehören
    const clientEmails = new Set(
      (client.kontakte ?? [])
        .map(k => (k.email ?? '').toLowerCase().trim())
        .filter(Boolean)
    )
    if (client.email) clientEmails.add(client.email.toLowerCase().trim())

    if (clientEmails.size === 0) {
      setRefreshResult({ count: 0, noEmails: true })
      setRefreshLoading(false)
      return
    }

    // Bereits importierte UIDs → keine Duplikate
    const importedKeys = new Set(
      events
        .filter(e => e.sourceUid && e.sourceAccount)
        .map(e => `${e.sourceAccount}:${e.sourceUid}`)
    )

    try {
      const [h, s, g] = await Promise.all([
        fetchEmails('hostinger', null, selectedFolder).catch(() => []),
        fetchEmails('strato',    null, selectedFolder).catch(() => []),
        fetchEmails('gmail',     null, selectedFolder).catch(() => []),
      ])
      const all = [...h, ...s, ...g]

      const newEntries = []
      for (const email of all) {
        const key = `${email.account}:${email.uid}`
        if (importedKeys.has(key)) continue
        if (!clientEmails.has((email.von ?? '').toLowerCase().trim())) continue

        newEntries.push({
          id:            'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          typ:           'eingehend',
          empfaenger:    email.an,
          absender:      email.von,
          vonName:       email.vonName ?? '',
          betreff:       email.betreff,
          text:          null,
          html:          undefined,
          anlagen:       [],
          contentLoaded: false,
          gelesen:       false,
          cc: '', bcc: '',
          status:        'gesendet',
          erstelltAm:    email.datum,
          gesendetAm:    email.datum,
          sourceUid:     String(email.uid),
          sourceAccount: email.account,
        })
      }

      if (newEntries.length > 0) {
        saveKomm({ events: [...newEntries, ...events] })
      }
      setRefreshResult({ count: newEntries.length })
    } catch (e) {
      setRefreshResult({ count: 0, error: e.message })
    } finally {
      setRefreshLoading(false)
    }
  }

  // Eingehende E-Mail einem Mandanten zuordnen (direkt diesem hier)
  function assignToThisClient(email) {
    const entry = {
      id: 'k' + Date.now().toString(36),
      typ: 'eingehend',
      empfaenger: email.an,
      absender: email.von,
      betreff: email.betreff,
      text: null,
      html: undefined,
      anlagen: [],
      contentLoaded: false,
      cc: '', bcc: '',
      status: 'gesendet',
      erstelltAm: email.datum,
      gesendetAm: email.datum,
      sourceUid: String(email.uid),
      sourceAccount: email.account,
    }
    saveKomm({ events: [entry, ...events] })
    setPosteingangEmails(prev => prev.filter(e => e.uid !== email.uid || e.account !== email.account))
  }

  // Gefilterte Events
  const filteredEvents = events.filter(e => {
    if (filter === 'gesendet')  return e.status === 'gesendet'
    if (filter === 'entwuerfe') return e.status === 'entwurf'
    return true
  }).sort((a, b) => {
    const da = new Date(a.gesendetAm ?? a.erstelltAm ?? 0)
    const db = new Date(b.gesendetAm ?? b.erstelltAm ?? 0)
    return db - da   // neueste zuerst
  })

  // Tages-Gruppierung für den Verlauf (Heute / Gestern / …)
  function tagLabel(iso) {
    if (!iso) return 'Ohne Datum'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return 'Ohne Datum'
    const heute = new Date(); heute.setHours(0, 0, 0, 0)
    const tag = new Date(d); tag.setHours(0, 0, 0, 0)
    const diff = Math.round((heute - tag) / 86400000)
    if (diff <= 0)  return 'Heute'
    if (diff === 1) return 'Gestern'
    if (diff < 7)   return 'Diese Woche'
    if (diff < 14)  return 'Letzte Woche'
    return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  }

  function fmtDatum(iso) {
    if (!iso) return '–'
    const d = new Date(iso)
    return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
  }

  return (
    <div style={{ padding: '20px', maxWidth: '900px' }}>

      {/* ── 1. Schnellaktionen ── */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '10px', textTransform: 'uppercase' }}>
          Schnellaktionen
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {Object.entries(TYP_CONFIG).map(([typ, cfg]) => (
            <button
              key={typ}
              onClick={() => openQuickAction(typ)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '8px', cursor: 'pointer',
                background: cfg.bg, color: cfg.color,
                border: `1px solid ${cfg.color}40`,
                fontSize: '12px', fontWeight: 600,
              }}
            >
              <span>{cfg.icon}</span>{cfg.label}
            </button>
          ))}

          {/* ── Vorlage-Schnellaktionen ── */}
          {emailVorlagen.filter(v => v.schnellaktion).length > 0 && (
            <>
              <div style={{ width: '1px', background: 'var(--border)', alignSelf: 'stretch', margin: '0 4px' }} />
              {emailVorlagen.filter(v => v.schnellaktion).map(v => (
                <button
                  key={v.id}
                  onClick={() => openWithVorlage(v)}
                  title={v.betreff}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px', borderRadius: '8px', cursor: 'pointer',
                    background: 'rgba(167,139,250,0.08)', color: 'var(--accent)',
                    border: '1px solid rgba(167,139,250,0.25)',
                    fontSize: '12px', fontWeight: 600,
                  }}
                >
                  ⚡ {v.name}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── 2. E-Mail-Editor ── */}
      {editorOpen && (
        <div
          style={{
            position: 'relative',
            background: 'var(--surface)',
            border: `1px solid ${isDragOver ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: '12px', padding: '20px', marginBottom: '20px',
            boxShadow: isDragOver ? '0 0 0 3px rgba(15,118,110,0.18)' : 'none',
            transition: 'border-color 0.12s, box-shadow 0.12s',
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* ── Entwurf-Banner ── */}
          {draftRestored && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 12px', marginBottom: '10px',
              background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.25)',
              borderRadius: '6px', fontSize: '12px',
            }}>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>💾 Entwurf wiederhergestellt</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>– weiter schreiben oder verwerfen</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                <button
                  onClick={resetEditor}
                  style={{ background: 'none', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '4px', cursor: 'pointer', color: '#ef4444', fontSize: '11px', padding: '2px 8px' }}
                >
                  Verwerfen
                </button>
                <button
                  onClick={() => setDraftRestored(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Drag-Overlay */}
          {isDragOver && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '12px', zIndex: 50,
              background: 'rgba(15,118,110,0.07)',
              border: '2px dashed var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{ textAlign: 'center', color: 'var(--accent)' }}>
                <div style={{ fontSize: '28px', marginBottom: '6px' }}>📎</div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>Dateien hier ablegen</div>
                <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>Max. ~4 MB gesamt</div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Typ-Badge + Schnellwechsel */}
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                background: TYP_CONFIG[activTyp]?.bg, color: TYP_CONFIG[activTyp]?.color,
              }}>
                {TYP_CONFIG[activTyp]?.icon} {TYP_CONFIG[activTyp]?.label}
              </span>
              <span>
                {Object.keys(TYP_CONFIG).filter(t => t !== activTyp).map(t => (
                  <button key={t} onClick={() => { setActivTyp(t); const tpl = buildTemplate(t, client); setBetreff(tpl.betreff); setText(tpl.text) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', marginRight: '2px' }}>
                    {TYP_CONFIG[t].icon}
                  </button>
                ))}
              </span>

              {/* Vorlagen-Auswahl */}
              <div style={{ position: 'relative' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowVorlagenSelect(p => !p)}
                  style={{ fontSize: '11px', color: 'var(--accent)' }}
                >
                  📝 Vorlage {emailVorlagen.length > 0 ? `(${emailVorlagen.length})` : ''}
                </button>
                {showVorlagenSelect && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    minWidth: '260px', maxHeight: '320px', overflowY: 'auto',
                    padding: '6px',
                  }}>
                    {emailVorlagen.length === 0 ? (
                      <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                        Noch keine Vorlagen.<br />
                        <button className="btn btn-ghost btn-sm" style={{ marginTop: '8px', fontSize: '11px' }}
                          onClick={() => { setShowVorlagenSelect(false); setShowVorlagenModal(true) }}>
                          + Erste Vorlage erstellen
                        </button>
                      </div>
                    ) : (
                      <>
                        {emailVorlagen.map(v => (
                          <button key={v.id}
                            onClick={() => applyVorlage(v)}
                            style={{
                              display: 'block', width: '100%', textAlign: 'left',
                              padding: '8px 10px', borderRadius: '6px', cursor: 'pointer',
                              background: 'none', border: 'none', color: 'var(--text)',
                              fontSize: '12px',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          >
                            <div style={{ fontWeight: 600 }}>{v.name}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                              {v.kategorie} · {v.betreff}
                            </div>
                          </button>
                        ))}
                        <div style={{ borderTop: '1px solid var(--border)', marginTop: '4px', paddingTop: '4px' }}>
                          <button className="btn btn-ghost btn-sm" style={{ width: '100%', fontSize: '10px', textAlign: 'left', justifyContent: 'flex-start' }}
                            onClick={() => { setShowVorlagenSelect(false); setShowVorlagenModal(true) }}>
                            ⚙ Vorlagen verwalten
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={resetEditor} style={{ fontSize: '11px' }}>✕ Schließen</button>
          </div>

          {/* Felder */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>An (Empfänger)</label>
              {(() => {
                const _kontakte = client.kontakte ?? []
                const _gewaehlt = empfaenger && empfaenger !== '__frei__' ? _kontakte.find(k => k.email === empfaenger) : null
                if (_gewaehlt) {
                  const _ini = String(_gewaehlt.name || _gewaehlt.email).trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(15,118,110,0.12)', color: 'var(--accent)', borderRadius: '20px', padding: '4px 10px 4px 5px', fontSize: '12px', fontWeight: 600 }}>
                        <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'grid', placeItems: 'center' }}>{_ini}</span>
                        {_gewaehlt.name}{_gewaehlt.rolle ? ` · ${_gewaehlt.rolle}` : ''}
                        <button onClick={() => setEmpfaenger('')} title="Empfänger ändern" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', opacity: 0.6, fontWeight: 700, fontSize: '13px', padding: '0 2px', lineHeight: 1 }}>×</button>
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{_gewaehlt.email}</span>
                    </div>
                  )
                }
                return (
                  <>
                    {_kontakte.length > 0 ? (
                      <select className="input" value={empfaenger} onChange={e => setEmpfaenger(e.target.value)} style={{ width: '100%', fontSize: '13px' }}>
                        <option value="">– Kontaktperson wählen –</option>
                        {_kontakte.map(k => (
                          <option key={k.id} value={k.email}>{k.name}{k.rolle ? ` (${k.rolle})` : ''}{k.email ? ` – ${k.email}` : ''}</option>
                        ))}
                        <option value="__frei__">Andere E-Mail-Adresse eingeben...</option>
                      </select>
                    ) : null}
                    {(_kontakte.length === 0 || empfaenger === '__frei__') && (
                      <input className="input" value={empfaenger === '__frei__' ? '' : empfaenger}
                        onChange={e => setEmpfaenger(e.target.value)}
                        placeholder="mandant@firma.de" style={{ width: '100%', fontSize: '13px', marginTop: _kontakte.length > 0 ? '4px' : '0' }} />
                    )}
                  </>
                )
              })()}
            </div>
            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
                Von (Absender)
                <button onClick={() => setShowAbsenderModal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '10px', marginLeft: '6px' }}>
                  ⚙ verwalten
                </button>
              </label>
              {absender.length > 0 ? (
                <select className="input" value={absenderVal} onChange={e => setAbsenderVal(e.target.value)} style={{ width: '100%', fontSize: '13px' }}>
                  <option value="">– Absender wählen –</option>
                  {absender.map((a, i) => (
                    <option key={i} value={a.email}>{a.name ? `${a.name} <${a.email}>` : a.email}</option>
                  ))}
                </select>
              ) : (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input className="input" value={absenderVal} onChange={e => setAbsenderVal(e.target.value)}
                    placeholder="absender@kanzlei.de" style={{ flex: 1, fontSize: '13px' }} />
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Betreff</label>
            <input className="input" value={betreff} onChange={e => setBetreff(e.target.value)}
              placeholder="Betreff..." style={{ width: '100%', fontSize: '13px' }} />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Nachricht</label>
              {/* Signatur-Selektor */}
              <div style={{ position: 'relative' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowSignaturSelect(p => !p)}
                  style={{ fontSize: '10px', color: 'var(--accent)' }}
                >
                  ✍️ {activeSignaturId
                    ? (emailSignaturen.find(s => s.id === activeSignaturId)?.name ?? 'Signatur')
                    : 'Keine Signatur'}
                </button>
                {showSignaturSelect && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 200,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    minWidth: '220px', padding: '6px',
                  }}>
                    <button
                      onClick={() => applySignatur(null)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '7px 10px', borderRadius: '6px', cursor: 'pointer',
                        background: !activeSignaturId ? 'rgba(255,255,255,0.06)' : 'none',
                        border: 'none', color: 'var(--text)', fontSize: '12px',
                      }}
                    >
                      Keine Signatur
                    </button>
                    {emailSignaturen.map(s => (
                      <button key={s.id}
                        onClick={() => applySignatur(s.id)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '7px 10px', borderRadius: '6px', cursor: 'pointer',
                          background: s.id === activeSignaturId ? 'rgba(255,255,255,0.06)' : 'none',
                          border: 'none', color: 'var(--text)', fontSize: '12px',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{s.name}</span>
                        {s.isDefault && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--accent)' }}>Standard</span>}
                      </button>
                    ))}
                    <div style={{ borderTop: '1px solid var(--border)', marginTop: '4px', paddingTop: '4px' }}>
                      <button className="btn btn-ghost btn-sm"
                        style={{ width: '100%', fontSize: '10px', textAlign: 'left', justifyContent: 'flex-start' }}
                        onClick={() => { setShowSignaturSelect(false); setShowSignaturenModal(true) }}
                      >
                        ⚙ Signaturen verwalten
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <textarea
              className="input"
              value={text}
              onChange={e => setText(e.target.value)}
              rows={10}
              style={{ width: '100%', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6' }}
            />
          </div>

          {/* CC + Anhänge-Zeile */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'end', marginBottom: '10px' }}>
            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>
                CC
                {(client.kontakte ?? []).length > 0 && (
                  <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--accent)' }}>
                    Schnell: {(client.kontakte ?? []).filter(k => k.email && k.email !== cc).slice(0, 3).map((k, i) => (
                      <button key={k.id} onClick={() => setCC(prev => prev ? `${prev}, ${k.email}` : k.email)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '10px', textDecoration: 'underline', padding: '0 2px' }}>
                        {k.name || k.email}
                      </button>
                    ))}
                  </span>
                )}
              </label>
              <input className="input" value={cc} onChange={e => setCC(e.target.value)}
                placeholder="cc@firma.de, weitere@kontakt.de" style={{ width: '100%', fontSize: '13px' }} />
            </div>
            <div style={{ paddingBottom: '0' }}>
              <button onClick={() => setShowBCC(p => !p)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                {showBCC ? '▲ BCC' : '+ BCC'}
              </button>
            </div>
          </div>
          {showBCC && (
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>BCC</label>
              <input className="input" value={bcc} onChange={e => setBCC(e.target.value)} placeholder="bcc@kanzlei.de" style={{ width: '100%', fontSize: '13px' }} />
            </div>
          )}

          {/* KI-Buttons */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', background: 'var(--surface2)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, alignSelf: 'center', marginRight: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>✦ KI</span>
              <button className="btn btn-ghost btn-sm" onClick={handleKIEntwurf} disabled={aiLoading} style={{ fontSize: '11px' }}>
                {aiLoading ? '⏳' : '✨'} Entwurf
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => handleReformulate('kürzer')} disabled={aiLoading || !text} style={{ fontSize: '11px' }}>Kürzer</button>
              <button className="btn btn-ghost btn-sm" onClick={() => handleReformulate('freundlicher')} disabled={aiLoading || !text} style={{ fontSize: '11px' }}>Freundlicher</button>
              <button className="btn btn-ghost btn-sm" onClick={() => handleReformulate('klarer')} disabled={aiLoading || !text} style={{ fontSize: '11px' }}>Klarer</button>
              <button className="btn btn-ghost btn-sm" onClick={() => handleReformulate('in Du-Form')} disabled={aiLoading || !text} style={{ fontSize: '11px' }}>Du-Form</button>
              <button className="btn btn-ghost btn-sm" onClick={() => handleReformulate('in Sie-Form')} disabled={aiLoading || !text} style={{ fontSize: '11px' }}>Sie-Form</button>
            </div>
            {/* Freitext-KI + Spracheingabe */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                className="input"
                value={aiFreitext}
                onChange={e => setAiFreitext(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleKIFreitext(aiFreitext).then(() => setAiFreitext('')) } }}
                placeholder='KI-Anweisung, z.B. „Übersetze auf Englisch" oder „Mach es kürzer"…'
                disabled={aiLoading}
                style={{ flex: 1, fontSize: '12px', padding: '5px 9px' }}
              />
              <button
                className="btn btn-ghost btn-sm"
                title="Spracheingabe (Mikrofon)"
                disabled={aiLoading || isRecording}
                onClick={() => {
                  setIsRecording(true)
                  setAiError('')
                  startSpeechInput(transcript => {
                    setIsRecording(false)
                    setAiFreitext(transcript)
                  })
                  setTimeout(() => setIsRecording(false), 10000)
                }}
                style={{ fontSize: '14px', padding: '4px 8px', color: isRecording ? '#dc2626' : undefined }}
              >
                {isRecording ? '🔴' : '🎤'}
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={aiLoading || !aiFreitext.trim()}
                onClick={() => handleKIFreitext(aiFreitext).then(() => setAiFreitext(''))}
                style={{ fontSize: '11px' }}
              >
                {aiLoading ? '⏳' : '→ Ausführen'}
              </button>
            </div>
          </div>

          {aiError && (
            <div style={{ fontSize: '11px', color: '#dc2626', marginBottom: '10px', padding: '6px 10px', background: 'rgba(220,38,38,0.06)', borderRadius: '6px' }}>
              ⚠️ KI: {aiError}
            </div>
          )}

          {sendError && (
            <div style={{ fontSize: '11px', color: '#dc2626', marginBottom: '10px', padding: '6px 10px', background: 'rgba(220,38,38,0.06)', borderRadius: '6px' }}>
              ⚠️ Senden fehlgeschlagen: {sendError}
            </div>
          )}

          {/* ── Anhänge ── */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: attachments.length > 0 ? '8px' : '0' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: '11px', color: 'var(--accent)' }}
              >
                📎 Anhang hinzufügen
              </button>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.6 }}>
                oder Dateien hierher ziehen
              </span>
              {attachments.length > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {attachments.length} Anhang{attachments.length !== 1 ? 'hänge' : ''} ·{' '}
                  {fmtFileSize(attachments.reduce((s, a) => s + a.size, 0))} gesamt
                </span>
              )}
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                Max. ~4 MB gesamt (Vercel-Limit)
              </span>
            </div>
            <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
            {attachments.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {attachments.map(a => (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '4px 10px', borderRadius: '20px', fontSize: '11px',
                    background: 'rgba(15,118,110,0.08)', border: '1px solid rgba(15,118,110,0.25)', color: 'var(--accent)',
                  }}>
                    <span>📄 {a.name}</span>
                    <span style={{ opacity: 0.7 }}>({fmtFileSize(a.size)})</span>
                    <button onClick={() => removeAttachment(a.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '12px', padding: '0', lineHeight: 1 }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Aktions-Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSendSMTP}
              disabled={sendLoading}
              style={{ fontSize: '12px' }}
              title="E-Mail senden"
            >
              {sendLoading ? '⏳ Wird gesendet...' : '📤 Senden'}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={saveEntwurf}
              style={{ fontSize: '12px' }}
            >
              💾 Als Entwurf speichern
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleMailto}
              style={{ fontSize: '12px' }}
            >
              📧 mailto: öffnen
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={markGesendetManuell}
              style={{ fontSize: '12px', color: '#16a34a' }}
            >
              ✓ Manuell als gesendet markieren
            </button>
          </div>
        </div>
      )}

      {/* Editor-Buttons + Vorlagen-Link */}
      {!editorOpen && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={openNewEditor} style={{ fontSize: '12px' }}>
            ✏️ Neue E-Mail verfassen
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowVorlagenModal(true)} style={{ fontSize: '12px', color: 'var(--accent)' }}>
            📝 Vorlagen ({emailVorlagen.length})
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSignaturenModal(true)} style={{ fontSize: '12px', color: 'var(--accent)' }}>
            ✍️ Signaturen ({emailSignaturen.length})
          </button>
        </div>
      )}

      {/* E-Mail-Vorlagen-Modal */}
      {showVorlagenModal && (
        <EmailVorlagenModal
          vorlagen={emailVorlagen}
          onUpdate={onUpdateEmailVorlagen ?? (() => {})}
          onClose={() => setShowVorlagenModal(false)}
        />
      )}

      {/* E-Mail-Signaturen-Modal */}
      {showSignaturenModal && (
        <EmailSignaturenModal
          signaturen={emailSignaturen}
          onUpdate={onUpdateEmailSignaturen ?? (() => {})}
          onClose={() => setShowSignaturenModal(false)}
        />
      )}

      {/* ── Posteingang abrufen ── */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleFetchEmails}
            disabled={posteingangLoad}
            style={{ fontSize: '12px' }}
          >
            {posteingangLoad ? '⏳ Wird abgerufen...' : '📥 E-Mails abrufen'}
          </button>
          {/* Ordner-Auswahl */}
          <select
            className="input"
            value={selectedFolder}
            onChange={e => setSelectedFolder(e.target.value)}
            onFocus={loadFolders}
            disabled={posteingangLoad}
            style={{ fontSize: '11px', padding: '4px 8px', maxWidth: '200px' }}
          >
            <option value="INBOX">📥 Posteingang (INBOX)</option>
            {availFolders.map((f, i) => f.path !== 'INBOX' && (
              <option key={i} value={f.path}>
                📁 {f.path} ({f.account})
              </option>
            ))}
          </select>
          {foldersLoading && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ordner werden geladen…</span>}
          {posteingangError && (
            <span style={{ fontSize: '11px', color: '#dc2626' }}>⚠️ {posteingangError}</span>
          )}
        </div>

        {posteingangOpen && posteingangEmails.length > 0 && (
          <div style={{ marginTop: '12px', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', background: 'rgba(15,118,110,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)' }}>📥 Posteingang — {posteingangEmails.length} E-Mails</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setPosteingangOpen(false)} style={{ fontSize: '10px' }}>✕</button>
            </div>
            {posteingangEmails.map((email, i) => (
              <div key={i} style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email.betreff}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Von: {email.vonName ? `${email.vonName} <${email.von}>` : email.von} · {fmtDatum(email.datum)}
                    <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--accent)' }}>{email.account}</span>
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => assignToThisClient(email)}
                  style={{ fontSize: '10px', whiteSpace: 'nowrap', color: '#16a34a' }}
                >
                  + Diesem Mandanten zuordnen
                </button>
              </div>
            ))}
          </div>
        )}

        {posteingangOpen && posteingangEmails.length === 0 && !posteingangLoad && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>Keine neuen E-Mails gefunden.</div>
        )}
      </div>

      {/* ── Graph-Suche: Alle Outlook-Ordner durchsuchen ── */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${graphSearchOpen ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              if (!graphSearchOpen) {
                // E-Mail aus Kontakten vorausfüllen
                const firstEmail = (client.kontakte ?? []).find(k => k.email)?.email ?? ''
                setGraphSearchEmail(firstEmail)
                setGraphSearchResults(null)
                setGraphSearchError('')
              }
              setGraphSearchOpen(v => !v)
            }}
            style={{ fontSize: '12px' }}
            title="Alle Outlook-Ordner nach E-Mails dieser Adresse durchsuchen"
          >
            🔍 Outlook-Suche (alle Ordner)
          </button>
          {graphSearchOpen && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              Durchsucht alle Ordner inkl. Unterordner über Microsoft Graph
            </span>
          )}
        </div>

        {graphSearchOpen && (
          <div style={{ marginTop: '10px', padding: '12px 14px', background: 'rgba(37,99,235,0.04)', borderRadius: '10px', border: '1px solid rgba(37,99,235,0.2)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', marginBottom: '10px' }}>
              🔍 Outlook-Suche – alle Ordner und Unterordner
            </div>

            {/* E-Mail-Adresse auswählen */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
              {/* Vorschläge aus Kontakten */}
              {(client.kontakte ?? []).filter(k => k.email).map(k => (
                <button key={k.id} className="btn btn-ghost btn-sm"
                  onClick={() => setGraphSearchEmail(k.email)}
                  style={{ fontSize: '11px', background: graphSearchEmail === k.email ? 'rgba(37,99,235,0.1)' : undefined, borderColor: graphSearchEmail === k.email ? 'var(--accent)' : undefined }}>
                  {k.name ? `${k.name} – ${k.email}` : k.email}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: graphSearchError ? '8px' : '0' }}>
              <input className="input" value={graphSearchEmail} onChange={e => setGraphSearchEmail(e.target.value)}
                placeholder="E-Mail-Adresse eingeben…"
                style={{ flex: 1, fontSize: '12px', padding: '6px 10px' }}
                onKeyDown={e => e.key === 'Enter' && handleGraphSearch()} />
              <button className="btn btn-primary btn-sm" onClick={handleGraphSearch}
                disabled={graphSearchLoading || !graphSearchEmail.trim()}
                style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                {graphSearchLoading ? '⏳ Suche…' : '🔍 Suchen'}
              </button>
            </div>

            {graphSearchError && (
              <div style={{ fontSize: '11px', padding: '10px 12px', background: graphSearchError === 'mail_read_missing' ? 'rgba(37,99,235,0.06)' : 'rgba(220,38,38,0.06)', borderRadius: '8px', border: `1px solid ${graphSearchError === 'mail_read_missing' ? 'rgba(37,99,235,0.25)' : 'rgba(220,38,38,0.2)'}`, marginTop: '8px' }}>
                {graphSearchError === 'mail_read_missing' ? (
                  <>
                    <div style={{ fontWeight: 700, color: '#2563eb', marginBottom: '6px' }}>🔑 Zusätzliche Berechtigung erforderlich</div>
                    <div style={{ color: 'var(--text)', marginBottom: '10px' }}>
                      Um alle Outlook-Ordner zu durchsuchen, benötigt das Dashboard die Berechtigung <strong>Mail.Read</strong>.<br />
                      Ein kurzes Anmelde-Fenster öffnet sich – einmalig bestätigen, danach funktioniert die Suche.
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={handleRequestMailRead} style={{ fontSize: '12px' }}>
                      🔑 Berechtigung erteilen und Suche starten
                    </button>
                  </>
                ) : (
                  <span style={{ color: '#dc2626' }}>⚠ {graphSearchError}</span>
                )}
              </div>
            )}

            {/* Ergebnisse */}
            {graphSearchResults !== null && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: graphSearchResults.length > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {graphSearchResults.length === 0 ? 'Keine Mails gefunden' : `${graphSearchResults.length} Mails gefunden`}
                  </span>
                  {graphSearchResults.length > 0 && (
                    <button className="btn btn-primary btn-sm" onClick={() => {
                      const n = importAllGraphResults()
                      if (n > 0) setGraphSearchResults([])
                    }} style={{ fontSize: '11px' }}>
                      ⬇ Alle {graphSearchResults.length} importieren
                    </button>
                  )}
                </div>

                {graphSearchResults.length > 0 && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', maxHeight: '360px', overflowY: 'auto' }}>
                    {graphSearchResults.map((msg, i) => {
                      const fromAddr = msg.from?.emailAddress?.address ?? ''
                      const fromName = msg.from?.emailAddress?.name ?? ''
                      const date     = msg.receivedDateTime ?? msg.sentDateTime
                      const folder   = graphFolderNames[msg.parentFolderId] ?? (msg.parentFolderId ? '…' : '')
                      const alreadyImported = events.some(e => e.graphId === ('graph_' + msg.id.slice(-16)))
                      return (
                        <div key={msg.id} style={{
                          display: 'flex', alignItems: 'flex-start', gap: '10px',
                          padding: '9px 12px', borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                          background: alreadyImported ? 'rgba(22,163,74,0.04)' : 'var(--surface)',
                          opacity: alreadyImported ? 0.7 : 1,
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {msg.subject ?? '(kein Betreff)'}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {fromName ? `${fromName} <${fromAddr}>` : fromAddr}
                              {date && ` · ${new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
                              {folder && <span style={{ marginLeft: '6px', background: 'var(--surface2)', padding: '0 5px', borderRadius: '4px', border: '1px solid var(--border)' }}>📁 {folder}</span>}
                            </div>
                            {msg.bodyPreview && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {msg.bodyPreview}
                              </div>
                            )}
                          </div>
                          {alreadyImported ? (
                            <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600, flexShrink: 0 }}>✓ Importiert</span>
                          ) : (
                            <button className="btn btn-ghost btn-sm" onClick={() => { importGraphMessage(msg); setGraphSearchResults(prev => prev.filter(m => m.id !== msg.id)) }}
                              style={{ fontSize: '10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              ⬇ Importieren
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 3. E-Mail-Historie ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              E-Mail-Historie ({events.length})
            </div>
            {/* Ungelesen-Badge: eingegangene E-Mails ohne erledigtAm */}
            {(() => {
              const ungelesen = events.filter(e => e.typ === 'eingehend' && !e.erledigtAm).length
              return ungelesen > 0 ? (
                <span style={{
                  fontSize: '11px', fontWeight: 700,
                  background: '#dc2626', color: '#fff',
                  padding: '2px 8px', borderRadius: '20px',
                  cursor: 'pointer',
                }} onClick={() => setFilter('alle')} title="Eingegangene E-Mails – noch nicht erledigt">
                  {ungelesen} neu
                </span>
              ) : null
            })()}
            {/* Aktualisieren-Button */}
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleAutoRefresh}
              disabled={refreshLoading}
              style={{ fontSize: '11px', color: '#0891b2' }}
              title="Nach neuen E-Mails von diesem Mandanten suchen und automatisch zuordnen"
            >
              {refreshLoading ? '⏳' : '🔄'} Aktualisieren
            </button>
            {/* Ergebnis-Feedback */}
            {refreshResult && !refreshLoading && (
              <span style={{ fontSize: '11px', fontWeight: 600,
                color: refreshResult.error ? '#dc2626' : refreshResult.count > 0 ? '#16a34a' : 'var(--text-muted)'
              }}>
                {refreshResult.error
                  ? `⚠️ ${refreshResult.error}`
                  : refreshResult.noEmails
                    ? '⚠️ Keine E-Mail-Adressen beim Mandanten hinterlegt'
                    : refreshResult.count > 0
                      ? `✓ ${refreshResult.count} neue E-Mail${refreshResult.count !== 1 ? 's' : ''} zugeordnet`
                      : '✓ Keine neuen E-Mails'
                }
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[['alle','Alle'], ['gesendet','Gesendet'], ['entwuerfe','Entwürfe']].map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`btn btn-ghost btn-sm`}
                style={{ fontSize: '10px', ...(filter === key ? { background: 'var(--accent-dim)', color: 'var(--accent)' } : {}) }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* KI-Mailsuche */}
        <div style={{ margin: '0 0 12px', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#7c3aed', whiteSpace: 'nowrap' }}>🤖 KI-Nachrichten</span>
            <div style={{ display: 'flex', gap: '2px', border: '1px solid var(--border)', borderRadius: '7px', padding: '2px' }}>
              {[['suchen', '🔎 Suchen'], ['briefing', '🧾 Briefing']].map(([k, l]) => (
                <button key={k} onClick={() => setMailModus(k)} className="btn btn-ghost btn-sm"
                  style={{ fontSize: '11px', padding: '4px 9px', ...(mailModus === k ? { background: 'var(--accent-dim)', color: 'var(--accent)' } : {}) }}>{l}</button>
              ))}
            </div>
            <input
              value={mailSuche}
              onChange={e => setMailSuche(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') (mailModus === 'briefing' ? handleBriefing : handleMailSuche)() }}
              placeholder={mailModus === 'briefing' ? 'z. B. Zusammenstellung der letzten 7 Tage · Stand zusammenfassen' : 'z. B. Spenden 2025 · Kontoauszug · Vertrag Miete …'}
              style={{ flex: 1, minWidth: '180px', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '7px', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: '13px' }} />
            <button className="btn btn-ghost btn-sm" onClick={toggleDiktat} title="Diktat (sprechen)"
              style={{ fontSize: '13px', ...(istDiktat ? { background: '#fee2e2', color: '#dc2626' } : {}) }}>{istDiktat ? '⏹' : '🎤'}</button>
            <button className="btn btn-sm btn-primary" onClick={mailModus === 'briefing' ? handleBriefing : handleMailSuche} disabled={sucheLoading}>
              {sucheLoading ? '⏳ …' : (mailModus === 'briefing' ? 'Briefing' : 'Suchen')}
            </button>
            {(sucheErgebnis || briefErgebnis || sucheError) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setSucheErgebnis(null); setBriefErgebnis(null); setSucheError(''); setMailSuche('') }} title="Zurücksetzen">×</button>
            )}
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {mailModus === 'briefing'
              ? 'Fasst die Korrespondenz zusammen (Zeitraum aus der Anfrage, z. B. „letzte 7 Tage") – Überblick, Verlauf, Handlungsempfehlungen.'
              : 'Durchsucht die Mails dieses Mandanten – Inhalte werden bei Bedarf geladen.'} Aktuell INBOX + Gesendete (Ordner-Mails folgen).
          </div>
          {sucheError && <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '6px' }}>⚠️ {sucheError}</div>}

          {mailModus === 'suchen' && sucheErgebnis && (
            <div style={{ marginTop: '8px' }}>
              {sucheErgebnis.antwort && <div style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '8px', whiteSpace: 'pre-wrap' }}>{sucheErgebnis.antwort}</div>}
              {sucheErgebnis.treffer.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Keine passenden Mails gefunden.</div>
              ) : sucheErgebnis.treffer.map((t, i) => {
                const ev = events.find(e => e.id === t.id)
                return (
                  <div key={i} onClick={() => oeffneTreffer(t.id)}
                    style={{ border: '1px solid var(--border)', borderRadius: '7px', padding: '8px 10px', marginBottom: '6px', cursor: 'pointer', background: 'var(--surface)' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text)' }}>
                      {ev?.betreff || '(ohne Betreff)'}
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {ev ? fmtDatum(ev.gesendetAm ?? ev.erstelltAm) : ''}{ev?.absender ? ' · ' + ev.absender : ''}</span>
                    </div>
                    {t.zitat && <div style={{ fontSize: '12px', color: 'var(--text)', fontStyle: 'italic', marginTop: '2px' }}>„{t.zitat}"</div>}
                    {t.warum && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{t.warum}</div>}
                  </div>
                )
              })}
            </div>
          )}

          {mailModus === 'briefing' && briefErgebnis && (() => {
            const sectTitle = { fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }
            const liste = (arr) => <ul style={{ margin: '2px 0 0', paddingLeft: '18px' }}>{arr.map((x, i) => <li key={i} style={{ marginBottom: '2px' }}>{x}</li>)}</ul>
            return (
              <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text)' }}>
                {briefErgebnis.ueberblick && <div style={{ fontWeight: 700, marginBottom: '8px' }}>{briefErgebnis.ueberblick}</div>}
                {briefErgebnis.verlauf.length > 0 && <div style={{ marginBottom: '10px' }}><div style={sectTitle}>Verlauf</div>{liste(briefErgebnis.verlauf)}</div>}
                {briefErgebnis.zusammenfassung && <div style={{ marginBottom: '10px' }}><div style={sectTitle}>Zusammenfassung</div><div style={{ whiteSpace: 'pre-wrap' }}>{briefErgebnis.zusammenfassung}</div></div>}
                {briefErgebnis.handlungsempfehlungen.length > 0 && <div style={{ marginBottom: '10px' }}><div style={{ ...sectTitle, color: '#7c3aed' }}>Handlungsempfehlungen</div>{liste(briefErgebnis.handlungsempfehlungen)}</div>}
                {briefErgebnis.offenePunkte.length > 0 && <div><div style={{ ...sectTitle, color: '#c2410c' }}>Offene Punkte</div>{liste(briefErgebnis.offenePunkte)}</div>}
              </div>
            )
          })()}
        </div>

        <style>{`.komm-split{display:grid;grid-template-columns:360px 1fr;gap:14px;align-items:start}@media(max-width:900px){.komm-split{grid-template-columns:1fr}}`}</style>
        <div className="komm-split">
          <div style={{ minWidth: 0 }}>
        {filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            {events.length === 0 ? 'Noch keine E-Mails gesendet oder gespeichert.' : 'Keine Einträge für diesen Filter.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredEvents.map((entry, i) => {
              const cfg    = TYP_CONFIG[entry.typ] ?? TYP_CONFIG.frei
              const sbCfg  = STATUS_BADGES[entry.status] ?? STATUS_BADGES.entwurf
              const isNeu  = entry.typ === 'eingehend' && !entry.erledigtAm
              const tag     = tagLabel(entry.gesendetAm ?? entry.erstelltAm)
              const prevTag = i > 0 ? tagLabel(filteredEvents[i - 1].gesendetAm ?? filteredEvents[i - 1].erstelltAm) : null
              // Richtung (empfangen / gesendet / Entwurf) für das Icon links
              const richtung   = entry.typ === 'eingehend' ? 'in' : (entry.status === 'entwurf' ? 'dr' : 'out')
              const richtIcon  = richtung === 'in' ? '↙' : richtung === 'dr' ? '✎' : '↗'
              const richtLabel = richtung === 'in' ? 'Empfangen' : richtung === 'dr' ? 'Entwurf' : 'Gesendet'
              const richtColor = richtung === 'in' ? '#3a6fb0' : richtung === 'dr' ? '#b7791f' : 'var(--accent)'
              const richtBg    = richtung === 'in' ? 'rgba(58,111,176,0.12)' : richtung === 'dr' ? 'rgba(183,121,31,0.14)' : 'rgba(15,118,110,0.12)'

              return (
                <Fragment key={entry.id}>
                  {tag !== prevTag && (
                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', margin: i === 0 ? '2px 2px 4px' : '14px 2px 4px' }}>
                      {tag}
                    </div>
                  )}
                <div
                  onClick={() => {
                    setDetailEntry(entry)
                    setActionForm(null)
                    if (entry.typ === 'eingehend' && !entry.contentLoaded && entry.sourceUid) {
                      fetchEmailContent(entry)
                    }
                  }}
                  style={{
                    position: 'relative',
                    display: 'grid', gridTemplateColumns: '26px 1fr auto', gap: '10px', alignItems: 'start',
                    padding: '10px 12px', cursor: 'pointer', borderRadius: '9px',
                    border: '1px solid ' + (detailEntry?.id === entry.id ? 'var(--accent)' : 'var(--border)'),
                    background: detailEntry?.id === entry.id ? 'var(--accent-dim, rgba(8,145,178,0.10))' : 'var(--surface)',
                    transition: 'background 0.12s, border-color 0.12s',
                  }}
                  onMouseEnter={e => { if (detailEntry?.id !== entry.id) e.currentTarget.style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { if (detailEntry?.id !== entry.id) e.currentTarget.style.background = 'var(--surface)' }}
                >
                  <span title={richtLabel} style={{ width: '24px', height: '24px', borderRadius: '6px', display: 'grid', placeItems: 'center', fontSize: '12px', background: richtBg, color: richtColor, marginTop: '1px' }}>
                    {richtIcon}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: isNeu ? 800 : 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.typ === 'eingehend' ? (entry.absender || '(unbekannt)') : ('An: ' + (entry.empfaenger || '—'))}
                      </span>
                      {isNeu && <span title="ungelesen" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#0891b2', flexShrink: 0 }} />}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: isNeu ? 700 : 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.betreff || '(kein Betreff)'}</span>
                      {entry.versandweg === 'outlook' && (
                        <span style={{ fontSize: '9px', background: 'rgba(0,120,212,0.12)', color: '#0078d4', border: '1px solid rgba(0,120,212,0.3)', padding: '0 5px', borderRadius: '8px', flexShrink: 0 }}>Outlook</span>
                      )}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' }}>
                      {(entry.text || '').replace(/\s+/g, ' ').slice(0, 90) || (entry.sourceUid && !entry.contentLoaded ? '(Inhalt wird beim Öffnen geladen)' : '—')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{fmtDatum(entry.gesendetAm ?? entry.erstelltAm)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {entry.anlagen?.length > 0 && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📎{entry.anlagen.length}</span>}
                      <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 7px', borderRadius: '20px', background: sbCfg.bg, color: sbCfg.color }}>{sbCfg.label}</span>
                      <div onClick={e => e.stopPropagation()}>
                        {entry.erledigtAm ? (
                          <span title={`Erledigt am ${fmtDatum(entry.erledigtAm)}`} style={{ fontSize: '13px', color: '#16a34a' }}>✓</span>
                        ) : (
                          <button title="Als erledigt markieren"
                            onClick={() => saveKomm({ events: events.map(e => e.id === entry.id ? { ...e, erledigtAm: new Date().toISOString() } : e) })}
                            style={{ width: '22px', height: '22px', borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1 }}>✓</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                </Fragment>
              )
            })}
          </div>
        )}
          </div>{/* /linke Spalte (Liste) */}

          {/* rechte Spalte: Lesebereich (inline) */}
          <div style={{ position: 'sticky', top: '12px' }}>
            {detailEntry ? (
              <EmailDetailPanel
                inline
                entry={detailEntry}
                contentLoading={contentLoading}
                contentError={contentError}
                attachmentData={attachmentData}
                onClose={() => { setDetailEntry(null); setActionForm(null) }}
                onFetch={fetchEmailContent}
                onDownload={downloadAttachment}
                events={events}
                saveKomm={saveKomm}
                client={client}
                onUpdate={onUpdate}
                setActivTyp={setActivTyp}
                setEmpfaenger={setEmpfaenger}
                setAbsenderVal={setAbsenderVal}
                setBetreff={setBetreff}
                setText={setText}
                setCC={setCC}
                setBCC={setBCC}
                setEditorOpen={setEditorOpen}
                sendFromHistory={sendFromHistory}
                actionForm={actionForm}
                setActionForm={setActionForm}
                emailSignaturen={emailSignaturen}
                emailVorlagen={emailVorlagen}
                onedriveTokens={onedriveTokens}
                onUpdateOnedriveTokens={onUpdateOnedriveTokens}
              />
            ) : (
              <div style={{ border: '1px dashed var(--border)', borderRadius: '14px', minHeight: '520px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', color: 'var(--text-muted)', textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '32px', opacity: 0.55 }}>✉️</div>
                <div style={{ fontSize: '13px' }}>Wähle links eine Nachricht,<br />um sie hier zu lesen.</div>
              </div>
            )}
          </div>
        </div>{/* /komm-split */}
      </div>

      {/* ── Absender-Modal ── */}
      {showAbsenderModal && (
        <AbsenderModal onClose={() => setShowAbsenderModal(false)} />
      )}
    </div>
  )
}

// ── E-Mail Detail Panel ────────────────────────────────────────────────────────
function EmailDetailPanel({
  entry, contentLoading, contentError, attachmentData,
  onClose, onFetch, onDownload,
  events, saveKomm,
  client, onUpdate,
  setActivTyp, setEmpfaenger, setAbsenderVal, setBetreff, setText, setCC, setBCC, setEditorOpen,
  sendFromHistory,
  actionForm, setActionForm,
  emailSignaturen = [],
  emailVorlagen = [],
  onedriveTokens = null,
  onUpdateOnedriveTokens,
  inline = false,
}) {
  const [toast,          setToast]          = useState('')
  const [aufgabeTitel,   setAufgabeTitel]   = useState(entry.betreff ?? '')
  const [aufgabePrio,    setAufgabePrio]    = useState('mittel')
  const [aufgabeFaellig, setAufgabeFaellig] = useState('')
  const [erDatum,        setErDatum]        = useState('')
  const [erText,         setErText]         = useState('Re: ' + (entry.betreff ?? ''))
  const [panelAiLoad,    setPanelAiLoad]    = useState(false)
  const [panelAiResult,  setPanelAiResult]  = useState('')
  const [panelAiError,   setPanelAiError]   = useState('')
  const [showTranslate,  setShowTranslate]  = useState(false)
  const [translateLang,  setTranslateLang]  = useState('Deutsch')

  // ── Anhänge-Auswahl + OneDrive-Speicherung ──────────────────
  const [selectedAnlagen,   setSelectedAnlagen]   = useState(new Set())
  const [savingAnlagen,     setSavingAnlagen]     = useState(false)
  const [showSaveTarget,    setShowSaveTarget]    = useState(false)
  const [saveTargetPath,    setSaveTargetPath]    = useState('')
  const [showFolderPicker,  setShowFolderPicker]  = useState(false)

  // ── Notiz → Auftrag-Zuordnung ───────────────────────────────
  const [notizZiel,       setNotizZiel]       = useState('')  // auftrag-id oder '__neu__'
  const [notizNeuTyp,     setNotizNeuTyp]     = useState('jahresabschluss')
  const [notizNeuBez,     setNotizNeuBez]     = useState(entry.betreff ?? '')
  const [notizNeuJahr,    setNotizNeuJahr]    = useState(new Date().getFullYear())
  const [notizText,       setNotizText]       = useState(() => {
    const d  = entry.erstelltAm ? new Date(entry.erstelltAm) : new Date()
    const ds = `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
    return `[${ds} — ${entry.absender ?? ''}] ${entry.betreff ?? ''}\n${(entry.text ?? '').slice(0, 400)}`
  })

  // ── Inline-Antwort ────────────────────────────────────────────
  const [absenderList]    = useState(loadAbsender)
  const [_rDraft]         = useState(() => loadReplyDraft(client.id, entry.id))
  const replyDraftSaveRef = useRef(null)

  const [replyMode,       setReplyMode]        = useState(_rDraft?.replyMode ?? '')   // '' | 'reply' | 'replyAll' | 'forward'
  const [showVorlagenPicker, setShowVorlagenPicker] = useState(false)
  const [replyText,       setReplyText]        = useState(_rDraft?.replyText ?? '')
  const [replyBetreff,    setReplyBetreff]     = useState(_rDraft?.replyBetreff ?? ('Re: ' + (entry.betreff ?? '')))
  const [replyEmpfaenger, setReplyEmpfaenger]  = useState(_rDraft?.replyEmpfaenger ?? (entry.absender ?? ''))
  const [replyAbsenderVal,setReplyAbsenderVal] = useState(() => {
    if (_rDraft?.replyAbsenderVal) return _rDraft.replyAbsenderVal
    const list = loadAbsender()
    return (list.find(a => a.isDefault) ?? list[0])?.email ?? ''
  })
  const [replyCC,         setReplyCC]          = useState(_rDraft?.replyCC ?? '')
  const [replySigId,      setReplySigId]       = useState(() => _rDraft?.replySigId ?? client.kommunikation?.standardSignaturId ?? (emailSignaturen.find(s => s.isDefault)?.id ?? ''))
  const [replySending,    setReplySending]     = useState(false)
  const [replyError,      setReplyError]       = useState('')
  const replyFileInputRef                       = useRef(null)
  const [replyAttachments, setReplyAttachments] = useState(_rDraft?.replyAttachments ?? [])

  // ── Diktieren + KI-Optimierung ────────────────────────────────
  const recRef          = useRef(null)
  const [dictating,    setDictating]    = useState(false)
  const [kiOptLoad,    setKiOptLoad]    = useState(false)
  const [kiOptErr,     setKiOptErr]     = useState('')

  const cfg   = TYP_CONFIG[entry.typ]   ?? TYP_CONFIG.frei
  const sbCfg = STATUS_BADGES[entry.status] ?? STATUS_BADGES.entwurf

  function fmtD(iso) {
    if (!iso) return '–'
    const d = new Date(iso)
    return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
  }
  function fmtSz(b) {
    if (!b) return ''
    if (b < 1024) return `${b} B`
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / 1048576).toFixed(1)} MB`
  }
  function fileIcon(ct) {
    if (!ct) return '📎'
    if (ct.includes('pdf')) return '📄'
    if (ct.startsWith('image/')) return '🖼'
    if (ct.includes('word') || ct.includes('document')) return '📝'
    if (ct.includes('sheet') || ct.includes('excel')) return '📊'
    return '📎'
  }
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function handlePanelKI(aktion, zielsprache) {
    const inhalt = entry.text || '(kein Textinhalt verfügbar)'
    setPanelAiLoad(true)
    setPanelAiResult('')
    setPanelAiError('')
    try {
      let prompt, input
      if (aktion === 'zusammenfassen') {
        prompt = 'Fasse diese E-Mail in 3–5 Stichpunkten auf Deutsch zusammen. Antworte NUR mit JSON: {"text":"..."}'
        input  = inhalt
      } else if (aktion === 'uebersetzen') {
        prompt = `Übersetze diese E-Mail vollständig ins ${zielsprache}. Antworte NUR mit JSON: {"text":"..."}`
        input  = inhalt
      } else if (aktion === 'antwort') {
        prompt = `Du bist Steuerberater-Assistent. Erstelle einen Antwort-Entwurf auf diese eingehende E-Mail (professionell, höflich, Sie-Form). Antworte NUR mit JSON: {"betreff":"...","text":"..."}`
        input  = `Betreff: ${entry.betreff}\n\n${inhalt}`
      }
      const result = await callClaude(prompt, input)
      setPanelAiResult(result.text ?? '')
      if (aktion === 'antwort' && result.text) {
        setReplyBetreff(result.betreff || 'Re: ' + (entry.betreff ?? ''))
        setReplyText(result.text)
        setReplyMode('reply')
      }
    } catch (e) {
      setPanelAiError(e.message)
    } finally {
      setPanelAiLoad(false)
    }
  }

  function handleReply() {
    setReplyBetreff('Re: ' + (entry.betreff ?? ''))
    setReplyEmpfaenger(entry.absender ?? '')
    setReplyCC('')
    setReplyText('')
    setReplyAttachments([])
    setReplyMode('reply')
  }

  function handleReplyAll() {
    const ownAddresses = new Set(absenderList.map(a => a.email.toLowerCase().trim()))
    const origCC = (entry.cc ?? '').split(',').map(s => s.trim()).filter(s => s && !ownAddresses.has(s.toLowerCase()))
    const origTo = (entry.empfaenger ?? '').split(',').map(s => s.trim()).filter(s => s && !ownAddresses.has(s.toLowerCase()))
    setReplyBetreff('Re: ' + (entry.betreff ?? ''))
    setReplyEmpfaenger(entry.absender ?? '')
    setReplyCC([...origTo, ...origCC].filter(Boolean).join(', '))
    setReplyText('')
    setReplyAttachments([])
    setReplyMode('replyAll')
  }

  function handleForward() {
    setReplyBetreff('WG: ' + (entry.betreff ?? ''))
    setReplyEmpfaenger('')
    setReplyCC('')
    setReplyText('')
    setReplyAttachments([])
    setReplyMode('forward')
  }

  function handleReplyFileSelect(e) {
    const files = Array.from(e.target.files ?? [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        const base64 = (ev.target.result ?? '').split(',')[1] ?? ''
        setReplyAttachments(prev => [
          ...prev,
          { name: file.name, size: file.size, type: file.type, data: base64 },
        ])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  async function handleSendReply() {
    if (!replyText.trim()) return
    setReplySending(true)
    setReplyError('')
    const sig = emailSignaturen.find(s => s.id === replySigId)
    // Richtige Reihenfolge: mein Text → Signatur → Original-Zitat
    const quoteHead = '\n\n--- Original-Nachricht ---\nVon: ' + (entry.absender ?? '') + '\nBetreff: ' + (entry.betreff ?? '') + '\n'
    const fullBody = replyText
      + (sig ? '\n\n--\n' + sig.text : '')
      + quoteHead
      + (entry.text ?? '')
    const selectedAbs = absenderList.find(a => a.email === replyAbsenderVal)
    const account = selectedAbs?.konto ?? 'hostinger'
    const now = new Date().toISOString()
    const newEvent = {
      id: 'ev' + Date.now().toString(36),
      typ: 'frei', status: 'gesendet',
      betreff: replyBetreff, text: fullBody,
      empfaenger: replyEmpfaenger, absender: replyAbsenderVal,
      cc: replyCC, bcc: '',
      erstelltAm: now, gesendetAm: now,
      anlagen: replyAttachments.map(a => ({ name: a.name, size: a.size })),
      // auftragId vom Original übernehmen → Antwort erscheint automatisch im Auftrag
      ...(entry.auftragId ? { auftragId: entry.auftragId } : {}),
    }
    const smtpAtts = replyAttachments.map(a => ({ filename: a.name, content: a.data, contentType: a.type }))
    try {
      await sendViaSMTP({ to: replyEmpfaenger, from: replyAbsenderVal, subject: replyBetreff, text: fullBody, cc: replyCC, account, attachments: smtpAtts })
      saveKomm({ events: [newEvent, ...events] })
      showToast(replyMode === 'forward' ? '✓ Weitergeleitet' : '✓ Antwort gesendet')
      clearReplyDraft(client.id, entry.id)
      setReplyMode('')
      setReplyAttachments([])
    } catch {
      openMailto({ empfaenger: replyEmpfaenger, betreff: replyBetreff, text: fullBody, cc: replyCC })
      saveKomm({ events: [newEvent, ...events] })
      clearReplyDraft(client.id, entry.id)
      setReplyMode('')
      setReplyAttachments([])
    } finally {
      setReplySending(false)
    }
  }

  // ── Diktierfunktion (Web Speech API) ──────────────────────────
  function startDictation() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { showToast('Diktat nicht verfügbar (Chrome empfohlen)'); return }
    const rec = new SR()
    rec.lang = 'de-DE'
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = e => {
      let chunk = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) chunk += e.results[i][0].transcript + ' '
      }
      if (chunk) {
        setReplyText(prev => {
          const sep = prev && !prev.endsWith(' ') && !prev.endsWith('\n') ? ' ' : ''
          return prev + sep + chunk
        })
      }
    }
    rec.onerror = ev => {
      if (ev.error !== 'aborted') showToast('Diktierfehler: ' + ev.error)
      setDictating(false)
    }
    rec.onend = () => setDictating(false)
    recRef.current = rec
    rec.start()
    setDictating(true)
  }

  function stopDictation() {
    recRef.current?.stop()
    recRef.current = null
    setDictating(false)
  }

  // ── Auto-Save: Antwort-Entwurf ────────────────────────────────
  useEffect(() => {
    clearTimeout(replyDraftSaveRef.current)
    replyDraftSaveRef.current = setTimeout(() => {
      if (!replyMode && !replyText) {
        clearReplyDraft(client.id, entry.id)
        return
      }
      saveReplyDraft(client.id, entry.id, {
        replyMode, replyText, replyBetreff, replyEmpfaenger,
        replyAbsenderVal, replyCC, replySigId,
        replyAttachments: replyAttachments.map(a => ({ ...a })),
      })
    }, 800)
    return () => clearTimeout(replyDraftSaveRef.current)
  }, [replyMode, replyText, replyBetreff, replyEmpfaenger, replyAbsenderVal, replyCC, replySigId, replyAttachments])

  // ── KI-Textoptimierung ────────────────────────────────────────
  const KI_OPT_PROMPTS = {
    freundlicher:    'Formuliere diesen E-Mail-Text freundlicher und herzlicher. Behalte alle inhaltlichen Punkte exakt bei. Antworte NUR mit JSON: {"text":"..."}',
    kuerzer:         'Kuerze diesen E-Mail-Text auf das Wesentliche, ohne inhaltliche Verluste. Antworte NUR mit JSON: {"text":"..."}',
    klarer:          'Formuliere diesen E-Mail-Text klarer und verstaendlicher. Antworte NUR mit JSON: {"text":"..."}',
    professioneller: 'Formuliere diesen E-Mail-Text professioneller im Stil einer Steuerkanzlei. Antworte NUR mit JSON: {"text":"..."}',
    'du-form':       'Formuliere diesen E-Mail-Text in Du-Form um. Behalte den Inhalt. Antworte NUR mit JSON: {"text":"..."}',
    'sie-form':      'Formuliere diesen E-Mail-Text in formeller Sie-Form um. Behalte den Inhalt. Antworte NUR mit JSON: {"text":"..."}',
    en:              'Translate this email text into English. Answer ONLY with JSON: {"text":"..."}',
    dk:              'Oversat denne e-mail tekst til dansk. Svar KUN med JSON: {"text":"..."}',
    de:              'Ueberse diesen Text ins Deutsche. Antworte NUR mit JSON: {"text":"..."}',
  }

  async function handleKiOpt(aktion) {
    if (!replyText.trim()) { showToast('Zuerst Text eingeben'); return }
    setKiOptLoad(true)
    setKiOptErr('')
    try {
      const result = await callClaude(KI_OPT_PROMPTS[aktion], replyText)
      if (result.text) setReplyText(result.text)
    } catch (e) {
      setKiOptErr(e.message)
    } finally {
      setKiOptLoad(false)
    }
  }

  function handleAufgabe() {
    if (!aufgabeTitel.trim()) return
    const emailRef = {
      eventId:  entry.id,
      betreff:  entry.betreff ?? '',
      absender: entry.absender ?? '',
      datum:    entry.erstelltAm ?? entry.gesendetAm ?? new Date().toISOString(),
    }
    // Aufgabe in client.aufgaben (Eigene Aufgaben)
    const newTask = {
      id: 'a' + Date.now().toString(36),
      titel: aufgabeTitel.trim(),
      inhalt: `E-Mail von ${entry.absender ?? ''}: ${entry.betreff ?? ''}`,
      prioritaet: aufgabePrio,
      faelligAm: aufgabeFaellig || null,
      erledigt: false, erledigtAm: null,
      datum: new Date().toISOString(),
      quelle: 'email',
      emailRef,
    }
    // Auch als Auftrag anlegen (typ freitext), damit es in der globalen Aufgabenübersicht erscheint
    const newAuftrag = {
      id: 'au' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
      typ: 'freitext',
      bezeichnung: aufgabeTitel.trim(),
      jahr: new Date().getFullYear(),
      monat: null,
      status: 'offen',
      frist: aufgabeFaellig || null,
      notiz: `E-Mail von ${entry.absender ?? ''}: ${entry.betreff ?? ''}`,
      hinweise: [],
      emailRef,
      erstelltAm: new Date().toISOString(),
    }
    onUpdate({
      aufgaben:  [newTask, ...(client.aufgaben ?? [])],
      auftraege: [newAuftrag, ...(client.auftraege ?? [])],
    })
    setActionForm(null)
    showToast('✓ Aufgabe gespeichert')
  }
  function handleNotizSave() {
    if (!notizZiel) return
    const emailRef = {
      eventId:  entry.id,
      betreff:  entry.betreff ?? '',
      absender: entry.absender ?? '',
      datum:    entry.erstelltAm ?? entry.gesendetAm ?? new Date().toISOString(),
    }
    const auftraege = [...(client.auftraege ?? [])]
    if (notizZiel === '__neu__') {
      // Neuen Auftrag anlegen und Notiz darin speichern
      const neuAuftrag = {
        id: 'au' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
        typ: notizNeuTyp,
        bezeichnung: notizNeuBez.trim() || entry.betreff || 'Neuer Auftrag',
        jahr: notizNeuJahr,
        monat: null,
        status: 'offen',
        frist: null,
        notiz: notizText,
        hinweise: [],
        emailRef,
        erstelltAm: new Date().toISOString(),
      }
      auftraege.unshift(neuAuftrag)
      onUpdate({ auftraege })
    } else {
      // Notiz an bestehenden Auftrag anhängen
      const idx = auftraege.findIndex(a => a.id === notizZiel)
      if (idx >= 0) {
        const existing = auftraege[idx].notiz ?? ''
        auftraege[idx] = {
          ...auftraege[idx],
          notiz: existing ? existing + '\n\n' + notizText : notizText,
          emailRef: auftraege[idx].emailRef ?? emailRef,
        }
        onUpdate({ auftraege })
      }
    }
    setActionForm(null)
    showToast('✓ Notiz zum Auftrag gespeichert')
  }
  // OneDrive Anhänge speichern
  async function handleSaveAnlagenToOneDrive(targetPath) {
    if (selectedAnlagen.size === 0) return
    const anlagen = (entry.anlagen ?? [])
    setSavingAnlagen(true)
    try {
      let tokens = onedriveTokens
      if (!tokens?.accessToken) {
        tokens = await openAuthPopup()
        onUpdateOnedriveTokens?.(tokens)
      }
      const handleRefresh = (t) => onUpdateOnedriveTokens?.(t)
      // Ordner sicherstellen
      await callApi('ensurePath', { pathParts: targetPath.split('/') }, tokens, handleRefresh)
      let saved = 0
      for (const idx of selectedAnlagen) {
        const a = anlagen[idx]
        const bin = attachmentData[entry.id]?.[idx]
        if (!bin?.data && !a.tooLarge) continue
        let base64Data
        if (bin?.data) {
          base64Data = bin.data
        } else if (a.tooLarge) {
          // Große Anhänge über Download-API laden
          const url = `/api/download-attachment?uid=${encodeURIComponent(entry.sourceUid)}&account=${encodeURIComponent(entry.sourceAccount)}&name=${encodeURIComponent(a.name)}`
          const response = await fetch(url)
          if (!response.ok) throw new Error(`Download fehlgeschlagen: ${a.name}`)
          const buffer = await response.arrayBuffer()
          const bytes = new Uint8Array(buffer)
          let binary = ''
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
          base64Data = btoa(binary)
        }
        if (!base64Data) continue
        await callApi('uploadSmall', {
          filePath: `${targetPath}/${a.name}`,
          base64: base64Data,
          contentType: a.contentType ?? 'application/octet-stream',
        }, tokens, handleRefresh)
        saved++
      }
      setSelectedAnlagen(new Set())
      setShowSaveTarget(false)
      showToast(`✓ ${saved} Datei${saved !== 1 ? 'en' : ''} in OneDrive gespeichert`)
    } catch (err) {
      showToast('⚠ Fehler: ' + err.message)
    } finally {
      setSavingAnlagen(false)
    }
  }
  function handleErinnerung() {
    if (!erDatum || !erText.trim()) return
    const er = { id: 'er' + Date.now(), datum: erDatum, text: erText.trim() }
    onUpdate({ erinnerungen: [...(client.erinnerungen ?? []), er] })
    setActionForm(null)
    showToast('✓ Erinnerung gesetzt')
  }
  function handleErledigt() {
    const updatedEvents = events.map(e => e.id === entry.id ? { ...e, erledigtAm: new Date().toISOString() } : e)
    saveKomm({ events: updatedEvents })
    onClose()
  }
  function handleLoadEditor() {
    setActivTyp(entry.typ)
    setEmpfaenger(entry.empfaenger ?? '')
    setAbsenderVal(entry.absender ?? '')
    setBetreff(entry.betreff ?? '')
    setText(entry.text ?? '')
    setCC(entry.cc ?? '')
    setBCC(entry.bcc ?? '')
    setEditorOpen(true)
    onClose()
  }
  function handleDelete() {
    if (!window.confirm('E-Mail wirklich löschen?')) return
    saveKomm({ events: events.filter(e => e.id !== entry.id) })
    onClose()
  }

  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 768

  // Sidebar action button style helper
  const sideBtn = (extra = {}) => ({
    width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px',
    padding: '9px 14px', borderRadius: '10px', border: '1px solid transparent',
    background: 'transparent', cursor: 'pointer', fontSize: '12px', fontWeight: 500,
    color: 'var(--text)', transition: 'all 0.15s',
    ...extra,
  })

  return (
    <>
      {!inline && <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1799,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isNarrow ? '8px' : '24px',
      }} />}
      <div onClick={e => e.stopPropagation()} style={inline ? {
        position: 'relative',
        width: '100%',
        height: 'calc(100vh - 150px)',
        minHeight: '520px',
        background: 'var(--surface)',
        borderRadius: '14px',
        border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      } : {
        position: 'fixed',
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: isNarrow ? '98vw' : '92vw',
        maxWidth: '1200px',
        height: isNarrow ? '96vh' : '90vh',
        background: 'var(--surface)',
        borderRadius: '16px',
        border: '1px solid var(--border)',
        boxShadow: '0 16px 64px rgba(0,0,0,0.5)',
        zIndex: 1800,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* ═══ Modal Header ═══ */}
        <div style={{
          padding: '14px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface2) 100%)',
        }}>
          <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: cfg.bg, color: cfg.color }}>
            {cfg.icon} {cfg.label}
          </span>
          <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: sbCfg.bg, color: sbCfg.color }}>
            {sbCfg.label}
          </span>
          {entry.versandweg === 'outlook' && (
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: 'rgba(0,120,212,0.12)', color: '#0078d4', border: '1px solid rgba(0,120,212,0.3)' }}>
              📨 Outlook
            </span>
          )}
          {entry.erledigtAm && <span style={{ fontSize: '10px', color: 'var(--green)', fontWeight: 700 }}>✓ Erledigt</span>}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {fmtD(entry.gesendetAm ?? entry.erstelltAm)}
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: '8px',
            cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px', padding: '4px 10px',
            lineHeight: 1, transition: 'all 0.15s',
          }}>✕</button>
        </div>

        {/* ═══ Two-Column Body ═══ */}
        <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* ─── LEFT COLUMN: E-Mail Content ─── */}
          <div style={{ flex: 7, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

            {/* Email Header */}
            <div style={{ padding: '20px 24px 16px', flexShrink: 0 }}>
              <div style={{ fontSize: '18px', fontWeight: 700, lineHeight: 1.3, marginBottom: '12px', color: 'var(--text)' }}>
                {entry.betreff || '(kein Betreff)'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '16px', lineHeight: 1.6 }}>
                {entry.absender   && <span><strong style={{ color: 'var(--text)', fontWeight: 600 }}>Von:</strong> {entry.absender}</span>}
                {entry.empfaenger && <span><strong style={{ color: 'var(--text)', fontWeight: 600 }}>An:</strong> {entry.empfaenger}</span>}
                {entry.cc         && <span><strong style={{ color: 'var(--text)', fontWeight: 600 }}>CC:</strong> {entry.cc}</span>}
                {entry.bcc        && <span><strong style={{ color: 'var(--text)', fontWeight: 600 }}>BCC:</strong> {entry.bcc}</span>}
              </div>
            </div>

            {/* Email Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 20px', ...(replyMode ? { maxHeight: '35%' } : {}) }}>
              {contentLoading[entry.id] && <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '20px 0' }}>⏳ E-Mail-Inhalt wird geladen…</div>}
              {contentError[entry.id] && (
                <div style={{ fontSize: '12px', color: '#dc2626', padding: '10px 14px', background: 'rgba(220,38,38,0.06)', borderRadius: '10px', marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  ⚠️ {contentError[entry.id]}
                  <button className="btn btn-ghost btn-sm" onClick={() => onFetch(entry)} style={{ fontSize: '10px' }}>Erneut versuchen</button>
                </div>
              )}
              {!contentLoading[entry.id] && (
                entry.html ? (
                  <iframe srcDoc={entry.html} sandbox="allow-same-origin"
                    style={{ width: '100%', minHeight: '300px', maxHeight: '60vh', border: '1px solid var(--border)', borderRadius: '10px', background: '#fff', display: 'block' }}
                    onLoad={e => { try { const h = e.target.contentDocument?.body?.scrollHeight; if (h > 50) e.target.style.height = Math.min(h + 24, window.innerHeight * 0.6) + 'px' } catch {} }}
                  />
                ) : (
                  <pre style={{ fontFamily: 'inherit', fontSize: '13px', lineHeight: '1.7', whiteSpace: 'pre-wrap', color: 'var(--text)', margin: 0 }}>
                    {entry.text || (entry.sourceUid && !entry.contentLoaded ? '(Inhalt wird geladen…)' : '(kein Text)')}
                  </pre>
                )
              )}

              {/* KI-Ergebnis unter dem Content */}
              {panelAiResult && !panelAiError && (
                <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(124,58,237,0.05)', borderRadius: '10px', fontSize: '12px', lineHeight: '1.6', whiteSpace: 'pre-wrap', border: '1px solid rgba(124,58,237,0.2)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>🧠 KI-Ergebnis</div>
                  {panelAiResult}
                </div>
              )}
            </div>

            {/* ── Inline-Antwort-Editor ── */}
            {replyMode && (
              <div style={{
                borderTop: '2px solid var(--accent)', flexShrink: 0,
                background: 'rgba(37,99,235,0.03)', display: 'flex', flexDirection: 'column', gap: '8px',
                padding: '14px 24px', overflowY: 'auto', maxHeight: '55%',
              }}>
                {/* Kopfzeile */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>
                    {replyMode === 'forward' ? '→ Weiterleiten' : replyMode === 'replyAll' ? '↩↩ Allen antworten' : '↩ Antwort verfassen'}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setReplyMode('')} style={{ fontSize: '13px', lineHeight: 1 }}>✕</button>
                </div>

                {/* Von + An */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {absenderList.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Von:</span>
                      <select className="input" value={replyAbsenderVal} onChange={e => setReplyAbsenderVal(e.target.value)}
                        style={{ flex: 1, fontSize: '11px', padding: '5px 8px', borderRadius: '8px' }}>
                        {absenderList.map(a => (
                          <option key={a.email} value={a.email}>{a.name ? a.name + ' <' + a.email + '>' : a.email}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>An:</span>
                    <input className="input" value={replyEmpfaenger} onChange={e => setReplyEmpfaenger(e.target.value)}
                      style={{ flex: 1, fontSize: '11px', padding: '5px 8px', borderRadius: '8px' }} />
                  </div>
                </div>

                {/* CC */}
                {(replyMode === 'replyAll' || replyCC) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: '28px' }}>CC:</span>
                    <input className="input" value={replyCC} onChange={e => setReplyCC(e.target.value)}
                      placeholder="cc@firma.de, weitere@kontakt.de"
                      style={{ flex: 1, fontSize: '11px', padding: '5px 8px', borderRadius: '8px' }} />
                  </div>
                )}

                {/* Betreff + Signatur */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Betreff:</span>
                  <input className="input" value={replyBetreff} onChange={e => setReplyBetreff(e.target.value)}
                    style={{ flex: 1, minWidth: '160px', fontSize: '11px', padding: '5px 8px', borderRadius: '8px' }} />
                  {emailSignaturen.length > 0 && (
                    <>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Signatur:</span>
                      <select className="input" value={replySigId} onChange={e => setReplySigId(e.target.value)}
                        style={{ fontSize: '11px', padding: '5px 8px', width: '140px', borderRadius: '8px' }}>
                        <option value="">Keine</option>
                        {emailSignaturen.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </>
                  )}
                </div>

                {/* Vorlage auswählen */}
                {emailVorlagen.length > 0 && (
                  <div style={{ position: 'relative' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowVorlagenPicker(v => !v)}
                      style={{ fontSize: '11px', color: 'var(--accent)' }}>
                      📝 Vorlage auswählen ({emailVorlagen.length})
                    </button>
                    {showVorlagenPicker && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 1000,
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        minWidth: '260px', maxHeight: '320px', overflowY: 'auto', padding: '6px',
                      }}>
                        {emailVorlagen.map(v => (
                          <button key={v.id}
                            onClick={() => { setReplyText(prev => (prev ? prev + '\n\n' : '') + v.text); setShowVorlagenPicker(false) }}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text)', fontSize: '12px' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                            <div style={{ fontWeight: 600 }}>{v.name}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>{v.kategorie} · {v.betreff}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Editor-Toolbar */}
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center',
                  padding: '6px 10px', background: 'var(--surface2)',
                  borderRadius: '8px', border: '1px solid var(--border)',
                }}>
                  <button className="btn btn-sm" onClick={dictating ? stopDictation : startDictation}
                    title={dictating ? 'Diktat stoppen' : 'Spracheingabe starten (de-DE)'}
                    style={{
                      fontSize: '11px', fontWeight: 700,
                      background: dictating ? '#dc2626' : 'transparent',
                      color: dictating ? '#fff' : 'var(--text)',
                      border: dictating ? '1px solid #dc2626' : '1px solid var(--border)',
                      padding: '3px 8px', borderRadius: '6px',
                      animation: dictating ? 'dictPulse 1.2s ease-in-out infinite' : 'none',
                    }}>
                    {dictating ? '⏹ Stop' : '🎤 Diktieren'}
                  </button>
                  <span style={{ borderLeft: '1px solid var(--border)', height: '16px', margin: '0 2px' }} />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>KI:</span>
                  {[
                    { key: 'freundlicher', label: '😊 Freundl.' },
                    { key: 'kuerzer',      label: '✂️ Kürzer' },
                    { key: 'klarer',       label: '💡 Klarer' },
                    { key: 'professioneller', label: '👔 Profess.' },
                  ].map(({ key, label }) => (
                    <button key={key} className="btn btn-ghost btn-sm"
                      onClick={() => handleKiOpt(key)} disabled={kiOptLoad || !replyText.trim()}
                      style={{ fontSize: '10px', padding: '3px 7px' }} title={label}>{label}</button>
                  ))}
                  <span style={{ borderLeft: '1px solid var(--border)', height: '16px', margin: '0 2px' }} />
                  {[{ key: 'du-form', label: 'Du' }, { key: 'sie-form', label: 'Sie' }].map(({ key, label }) => (
                    <button key={key} className="btn btn-ghost btn-sm"
                      onClick={() => handleKiOpt(key)} disabled={kiOptLoad || !replyText.trim()}
                      style={{ fontSize: '10px', padding: '3px 7px' }}>{label}</button>
                  ))}
                  <span style={{ borderLeft: '1px solid var(--border)', height: '16px', margin: '0 2px' }} />
                  {[{ key: 'en', label: '🇬🇧 EN' }, { key: 'dk', label: '🇩🇰 DK' }, { key: 'de', label: '🇩🇪 DE' }].map(({ key, label }) => (
                    <button key={key} className="btn btn-ghost btn-sm"
                      onClick={() => handleKiOpt(key)} disabled={kiOptLoad || !replyText.trim()}
                      style={{ fontSize: '10px', padding: '3px 7px' }}>{label}</button>
                  ))}
                  {kiOptLoad && <span style={{ fontSize: '12px', marginLeft: '4px' }}>⏳</span>}
                </div>

                {kiOptErr && (
                  <div style={{ fontSize: '11px', color: '#dc2626', padding: '4px 8px', background: 'rgba(220,38,38,0.06)', borderRadius: '6px' }}>
                    KI-Fehler: {kiOptErr}
                  </div>
                )}

                {/* Textarea */}
                <textarea className="input" value={replyText} onChange={e => setReplyText(e.target.value)}
                  placeholder="Antworttext… (oder 🎤 Diktieren klicken)" autoFocus
                  style={{
                    width: '100%', minHeight: '110px', resize: 'vertical', fontSize: '13px',
                    fontFamily: 'inherit', lineHeight: '1.6', padding: '10px 12px', boxSizing: 'border-box',
                    borderRadius: '10px',
                    ...(dictating ? { borderColor: '#dc2626', boxShadow: '0 0 0 2px rgba(220,38,38,0.15)' } : {}),
                  }} />

                {/* Anhänge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => replyFileInputRef.current?.click()}
                    style={{ fontSize: '11px' }}>📎 Anlage hinzufügen</button>
                  <input ref={replyFileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleReplyFileSelect} />
                  {replyAttachments.length > 0 && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {replyAttachments.length} Anhang{replyAttachments.length !== 1 ? 'hänge' : ''} · {fmtSz(replyAttachments.reduce((s, a) => s + a.size, 0))} gesamt
                    </span>
                  )}
                </div>
                {replyAttachments.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {replyAttachments.map((a, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '4px 9px', borderRadius: '8px',
                        background: 'var(--surface)', border: '1px solid var(--border)', fontSize: '11px',
                      }}>
                        <span>{fileIcon(a.type)}</span>
                        <span style={{ fontWeight: 600 }}>{a.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>({fmtSz(a.size)})</span>
                        <button onClick={() => setReplyAttachments(prev => prev.filter((_, idx) => idx !== i))}
                          title="Anhang entfernen"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '14px', padding: '0 1px', lineHeight: 1, flexShrink: 0 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Zitat-Vorschau */}
                <div style={{
                  fontSize: '11px', color: 'var(--text-muted)',
                  background: 'rgba(100,116,139,0.06)', padding: '8px 12px',
                  borderRadius: '8px', borderLeft: '3px solid var(--border)',
                  maxHeight: '56px', overflow: 'hidden',
                }}>
                  <strong>— Original-Nachricht —</strong> Von: {entry.absender ?? ''} · {entry.betreff ?? ''}
                  <div style={{ opacity: 0.7, marginTop: '2px' }}>
                    {(entry.text ?? '').slice(0, 140)}{(entry.text ?? '').length > 140 ? '…' : ''}
                  </div>
                </div>

                {/* Sende-Leiste */}
                {replyError && <div style={{ fontSize: '11px', color: '#dc2626' }}>⚠️ {replyError}</div>}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button className="btn btn-primary btn-sm" onClick={handleSendReply}
                    disabled={replySending || !replyText.trim()} style={{ fontSize: '12px', borderRadius: '8px', padding: '7px 18px' }}>
                    {replySending ? '⏳ Sende…' : '📤 Senden'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setReplyMode('')} style={{ fontSize: '12px' }}>Abbrechen</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    setActivTyp('frei')
                    setEmpfaenger(replyEmpfaenger)
                    setAbsenderVal(replyAbsenderVal)
                    setBetreff(replyBetreff)
                    const sig = emailSignaturen.find(s => s.id === replySigId)
                    const quoteHead = '\n\n--- Original-Nachricht ---\nVon: ' + (entry.absender ?? '') + '\n'
                    setText(replyText + (sig ? '\n\n--\n' + sig.text : '') + quoteHead + (entry.text ?? ''))
                    setCC(replyCC); setBCC('')
                    setEditorOpen(true); onClose()
                  }} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Im Editor öffnen
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ─── RIGHT COLUMN: Sidebar ─── */}
          <div style={{
            flex: isNarrow ? 'none' : 3,
            minWidth: isNarrow ? undefined : '260px',
            maxWidth: isNarrow ? undefined : '340px',
            borderLeft: isNarrow ? 'none' : '1px solid var(--border)',
            borderTop: isNarrow ? '1px solid var(--border)' : 'none',
            overflowY: 'auto',
            display: 'flex', flexDirection: 'column',
            background: 'rgba(0,0,0,0.015)',
          }}>

            {/* Toast */}
            {toast && (
              <div style={{ padding: '8px 20px', background: 'rgba(22,163,74,0.08)', borderBottom: '1px solid rgba(22,163,74,0.2)' }}>
                <span style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 700 }}>{toast}</span>
              </div>
            )}

            {/* ── Aktionen ── */}
            <div style={{ padding: '16px 16px 12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '10px' }}>
                Aktionen
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {entry.typ === 'eingehend' && (
                  <>
                    <button onClick={handleReply} style={sideBtn({ background: 'rgba(37,99,235,0.08)', color: 'var(--accent)', fontWeight: 600, border: '1px solid rgba(37,99,235,0.2)' })}>
                      ↩ Antworten
                    </button>
                    <button onClick={handleReplyAll} style={sideBtn()}>↩↩ Allen antworten</button>
                  </>
                )}
                <button onClick={handleForward} style={sideBtn()}>→ Weiterleiten</button>
                {entry.status === 'entwurf' && (
                  <button onClick={() => { sendFromHistory(entry); onClose() }} style={sideBtn({ background: 'rgba(37,99,235,0.08)', color: 'var(--accent)', fontWeight: 600, border: '1px solid rgba(37,99,235,0.2)' })}>
                    📤 Jetzt senden
                  </button>
                )}

                <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />

                <button onClick={() => setActionForm(actionForm === 'aufgabe' ? null : 'aufgabe')}
                  style={sideBtn(actionForm === 'aufgabe' ? { background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.3)' } : {})}>
                  📌 Aufgabe erstellen
                </button>
                <button onClick={() => setActionForm(actionForm === 'notiz' ? null : 'notiz')}
                  style={sideBtn(actionForm === 'notiz' ? { background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)' } : {})}>
                  📝 Notiz speichern
                </button>
                <button onClick={() => setActionForm(actionForm === 'erinnerung' ? null : 'erinnerung')}
                  style={sideBtn(actionForm === 'erinnerung' ? { background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)' } : {})}>
                  🔔 Erinnerung setzen
                </button>

                <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />

                {/* ── Auftrag zuordnen ── */}
                {(() => {
                  const auftraege = (client.auftraege ?? []).filter(a => a.status !== 'erledigt')
                  if (auftraege.length === 0) return null
                  const currentId = entry.auftragId ?? ''
                  function assignAuftrag(auftragId) {
                    const updatedEvents = events.map(e =>
                      e.id === entry.id ? { ...e, auftragId: auftragId || undefined } : e
                    )
                    saveKomm({ events: updatedEvents })
                    showToast(auftragId ? '✓ Auftrag zugeordnet' : '✓ Zuordnung entfernt')
                  }
                  return (
                    <div style={{ padding: '0 0 4px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                        📋 Auftrag zuordnen
                      </div>
                      <select
                        className="input"
                        value={currentId}
                        onChange={e => assignAuftrag(e.target.value)}
                        style={{ width: '100%', fontSize: '11px', padding: '5px 8px', borderRadius: '7px' }}
                      >
                        <option value="">— Kein Auftrag —</option>
                        {auftraege.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.typ === 'jahresabschluss' ? (a.bezeichnung || `JA ${a.abschlussJahr ?? a.jahr}`) : (a.bezeichnung || a.typ)}{a.jahr ? ` (${a.jahr})` : ''}
                          </option>
                        ))}
                      </select>
                      {currentId && (
                        <div style={{ fontSize: '10px', color: '#16a34a', marginTop: '3px', fontWeight: 600 }}>
                          ✓ E-Mail ist diesem Auftrag zugeordnet
                        </div>
                      )}
                    </div>
                  )
                })()}

                <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />

                {!entry.erledigtAm && (
                  <button onClick={handleErledigt} style={sideBtn({ color: 'var(--green)' })}>✓ Als erledigt markieren</button>
                )}
                <button onClick={handleLoadEditor} style={sideBtn()}>✏️ Im Editor öffnen</button>

                <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />

                <button onClick={handleDelete} style={sideBtn({ color: '#ef4444', fontSize: '11px' })}>🗑 E-Mail löschen</button>
              </div>
            </div>

            {/* ── Aufgabe-Formular ── */}
            {actionForm === 'aufgabe' && (
              <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', background: 'rgba(37,99,235,0.04)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', marginBottom: '10px' }}>📌 Aufgabe erstellen</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input className="input" value={aufgabeTitel} onChange={e => setAufgabeTitel(e.target.value)}
                    placeholder="Aufgabe Titel…" style={{ fontSize: '12px', padding: '7px 10px', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <select className="input" value={aufgabePrio} onChange={e => setAufgabePrio(e.target.value)}
                      style={{ fontSize: '12px', padding: '7px 8px', borderRadius: '8px' }}>
                      <option value="hoch">Hoch</option>
                      <option value="mittel">Mittel</option>
                      <option value="niedrig">Niedrig</option>
                    </select>
                    <input type="date" className="input" value={aufgabeFaellig} onChange={e => setAufgabeFaellig(e.target.value)}
                      style={{ fontSize: '12px', padding: '7px 8px', borderRadius: '8px' }} />
                  </div>
                  {/* E-Mail-Quelle */}
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '5px 8px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    📧 Quelle: E-Mail von {entry.absender ?? '–'}<br/>
                    Betreff: {entry.betreff ?? '–'}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-primary btn-sm" onClick={handleAufgabe} style={{ fontSize: '12px', flex: 1, borderRadius: '8px' }}>Speichern</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setActionForm(null)} style={{ fontSize: '12px', borderRadius: '8px' }}>Abbrechen</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Notiz-Formular (Auftragszuordnung) ── */}
            {actionForm === 'notiz' && (
              <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', background: 'rgba(249,115,22,0.04)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#f97316', marginBottom: '10px' }}>📝 Notiz speichern – Zuordnung</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Wohin soll diese Notiz gespeichert werden?</div>
                  <select className="input" value={notizZiel} onChange={e => setNotizZiel(e.target.value)}
                    style={{ fontSize: '12px', padding: '7px 8px', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}>
                    <option value="">– Bitte wählen –</option>
                    <optgroup label="Bestehende Aufträge">
                      {(client.auftraege ?? []).filter(a => a.status !== 'erledigt').map(a => (
                        <option key={a.id} value={a.id}>
                          {a.bezeichnung || a.typ} {a.jahr ? `(${a.jahr})` : ''}
                        </option>
                      ))}
                    </optgroup>
                    <option value="__neu__">➕ Neuen Auftrag anlegen</option>
                  </select>
                  {notizZiel === '__neu__' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      <select className="input" value={notizNeuTyp} onChange={e => setNotizNeuTyp(e.target.value)}
                        style={{ fontSize: '12px', padding: '6px 8px', borderRadius: '6px' }}>
                        <option value="jahresabschluss">📁 Jahresabschluss</option>
                        <option value="fibu">📒 Buchhaltung/FIBU</option>
                        <option value="lohn">💼 Lohn</option>
                        <option value="beratung">🧠 Beratung</option>
                        <option value="ust">🧾 Umsatzsteuer</option>
                        <option value="freitext">📝 Eigener Auftrag</option>
                      </select>
                      <input className="input" value={notizNeuBez} onChange={e => setNotizNeuBez(e.target.value)}
                        placeholder="Bezeichnung…" style={{ fontSize: '12px', padding: '6px 8px', borderRadius: '6px', width: '100%', boxSizing: 'border-box' }} />
                      <input type="number" className="input" value={notizNeuJahr} onChange={e => setNotizNeuJahr(Number(e.target.value))}
                        style={{ fontSize: '12px', padding: '6px 8px', borderRadius: '6px', width: '80px' }} />
                    </div>
                  )}
                  <textarea className="input" value={notizText} onChange={e => setNotizText(e.target.value)} rows={3}
                    style={{ fontSize: '11px', padding: '7px 10px', borderRadius: '8px', width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
                  {/* E-Mail-Quelle */}
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '5px 8px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    📧 Quelle: E-Mail von {entry.absender ?? '–'} — {entry.betreff ?? '–'}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-primary btn-sm" onClick={handleNotizSave} disabled={!notizZiel} style={{ fontSize: '12px', flex: 1, borderRadius: '8px' }}>Speichern</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setActionForm(null)} style={{ fontSize: '12px', borderRadius: '8px' }}>Abbrechen</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Erinnerung-Formular ── */}
            {actionForm === 'erinnerung' && (
              <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', background: 'rgba(249,115,22,0.04)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#f97316', marginBottom: '10px' }}>🔔 Erinnerung setzen</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input type="date" className="input" value={erDatum} onChange={e => setErDatum(e.target.value)}
                    style={{ fontSize: '12px', padding: '7px 10px', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />
                  <input className="input" value={erText} onChange={e => setErText(e.target.value)}
                    placeholder="Erinnerungstext…" style={{ fontSize: '12px', padding: '7px 10px', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-primary btn-sm" onClick={handleErinnerung} style={{ fontSize: '12px', flex: 1, borderRadius: '8px' }}>Speichern</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setActionForm(null)} style={{ fontSize: '12px', borderRadius: '8px' }}>Abbrechen</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Anhänge ── */}
            {entry.anlagen?.length > 0 && (
              <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', background: 'rgba(245,158,11,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)' }}>
                    📎 {entry.anlagen.length} Anhang{entry.anlagen.length !== 1 ? 'änge' : ''}
                  </div>
                  {selectedAnlagen.size > 0 && (
                    <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>{selectedAnlagen.size} ausgewählt</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {entry.anlagen.map((a, i) => {
                    const bin   = attachmentData[entry.id]?.[i]
                    const canDl = bin?.data && !a.tooLarge
                    const isSelected = selectedAnlagen.has(i)
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                        borderRadius: '10px', background: isSelected ? 'rgba(15,118,110,0.06)' : 'var(--surface)',
                        border: `1px solid ${isSelected ? 'rgba(15,118,110,0.3)' : 'var(--border)'}`, fontSize: '12px',
                        transition: 'all 0.15s',
                      }}>
                        <input type="checkbox" checked={isSelected}
                          onChange={() => setSelectedAnlagen(prev => {
                            const next = new Set(prev)
                            if (next.has(i)) next.delete(i); else next.add(i)
                            return next
                          })}
                          style={{ cursor: 'pointer', flexShrink: 0, accentColor: 'var(--accent)' }} />
                        <span style={{ fontSize: '16px', flexShrink: 0 }}>{fileIcon(a.contentType)}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                          {a.size > 0 && <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{fmtSz(a.size)}</div>}
                        </div>
                        {canDl ? (
                          <button onClick={e => { e.stopPropagation(); onDownload(bin) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '14px', padding: '2px', flexShrink: 0 }}
                            title="Herunterladen">⬇</button>
                        ) : a.tooLarge ? (
                          <a href={`/api/download-attachment?uid=${encodeURIComponent(entry.sourceUid)}&account=${encodeURIComponent(entry.sourceAccount)}&name=${encodeURIComponent(a.name)}`}
                            download={a.name} onClick={e => e.stopPropagation()}
                            style={{ color: 'var(--accent)', fontSize: '14px', textDecoration: 'none', flexShrink: 0 }}
                            title="Herunterladen">⬇</a>
                        ) : (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>⏳</span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* ── Ausgewählte Anhänge → OneDrive speichern ── */}
                {selectedAnlagen.size > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    {!showSaveTarget ? (
                      <button className="btn btn-primary btn-sm" onClick={() => {
                        const { folderPath } = getMandantPath(client)
                        setSaveTargetPath(folderPath)
                        setShowSaveTarget(true)
                      }} disabled={savingAnlagen} style={{ fontSize: '11px', width: '100%', borderRadius: '8px' }}>
                        {savingAnlagen ? '⏳ Wird gespeichert…' : `☁️ ${selectedAnlagen.size} Anhang${selectedAnlagen.size !== 1 ? 'änge' : ''} in OneDrive speichern`}
                      </button>
                    ) : (
                      <div style={{ padding: '10px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', marginBottom: '8px' }}>☁️ Speichern nach OneDrive</div>

                        {/* Schnellbuttons */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                          {(() => {
                            const { folderPath } = getMandantPath(client)
                            const quickTargets = [
                              { label: '📁 Jahresabschluss', path: folderPath + '/Jahresabschluss ' + new Date().getFullYear() },
                              { label: '📒 Buchhaltung',     path: folderPath + '/Buchhaltung' },
                              { label: '💼 Lohn',            path: folderPath + '/Lohn' },
                              { label: '📂 Sonstiges',       path: folderPath + '/Sonstiges' },
                            ]
                            return quickTargets.map(qt => (
                              <button key={qt.label} className="btn btn-ghost btn-sm"
                                onClick={() => setSaveTargetPath(qt.path)}
                                style={{
                                  fontSize: '10px', padding: '3px 8px', borderRadius: '6px',
                                  background: saveTargetPath === qt.path ? 'rgba(15,118,110,0.12)' : undefined,
                                  border: saveTargetPath === qt.path ? '1px solid rgba(15,118,110,0.3)' : undefined,
                                }}>
                                {qt.label}
                              </button>
                            ))
                          })()}
                        </div>

                        {/* Pfad-Eingabe */}
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                          <input className="input" value={saveTargetPath} onChange={e => setSaveTargetPath(e.target.value)}
                            placeholder="OneDrive-Pfad…" style={{ flex: 1, fontSize: '11px', padding: '5px 8px', borderRadius: '6px', fontFamily: 'var(--font-mono)' }} />
                          <button className="btn btn-primary btn-sm" onClick={() => setShowFolderPicker(true)}
                            style={{ fontSize: '11px', whiteSpace: 'nowrap', fontWeight: 600 }}>📁 Durchsuchen</button>
                        </div>

                        {/* Folder-Picker Modal */}
                        {showFolderPicker && (
                          <OneDriveFolderPickerModal
                            tokens={onedriveTokens}
                            onUpdateTokens={onUpdateOnedriveTokens}
                            title="Zielordner für Anhänge wählen"
                            initialPath={saveTargetPath || getMandantPath(client).folderPath}
                            onSelect={p => { setSaveTargetPath(p); setShowFolderPicker(false) }}
                            onClose={() => setShowFolderPicker(false)}
                          />
                        )}

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-primary btn-sm" onClick={() => handleSaveAnlagenToOneDrive(saveTargetPath)}
                            disabled={savingAnlagen || !saveTargetPath.trim()} style={{ fontSize: '11px', flex: 1, borderRadius: '6px' }}>
                            {savingAnlagen ? '⏳ Wird gespeichert…' : '✓ Speichern'}
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setShowSaveTarget(false)} style={{ fontSize: '11px', borderRadius: '6px' }}>Abbrechen</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── KI-Tools ── */}
            <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', background: 'rgba(124,58,237,0.02)' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7c3aed', marginBottom: '10px' }}>
                🧠 KI-Tools
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <button onClick={() => handlePanelKI('zusammenfassen')} disabled={panelAiLoad}
                  style={sideBtn({ color: '#7c3aed' })}>
                  {panelAiLoad ? '⏳' : '📋'} Zusammenfassen
                </button>
                <button onClick={() => handlePanelKI('antwort')} disabled={panelAiLoad}
                  style={sideBtn({ color: '#7c3aed' })}>
                  ✍️ Antwort-Entwurf
                </button>
                <button onClick={() => setShowTranslate(v => !v)} disabled={panelAiLoad}
                  style={sideBtn(showTranslate ? { background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', color: '#7c3aed' } : { color: '#7c3aed' })}>
                  🌐 Übersetzen
                </button>
                {showTranslate && (
                  <div style={{ display: 'flex', gap: '6px', padding: '4px 0' }}>
                    <select className="input" value={translateLang} onChange={e => setTranslateLang(e.target.value)}
                      style={{ flex: 1, fontSize: '11px', padding: '5px 8px', borderRadius: '8px' }}>
                      {['Deutsch','Englisch','Französisch','Spanisch','Polnisch','Türkisch','Arabisch'].map(l => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                    <button className="btn btn-primary btn-sm" onClick={() => { handlePanelKI('uebersetzen', translateLang); setShowTranslate(false) }}
                      disabled={panelAiLoad} style={{ fontSize: '11px', borderRadius: '8px' }}>→ Los</button>
                  </div>
                )}
              </div>
              {panelAiError && (
                <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '8px', padding: '6px 10px', background: 'rgba(220,38,38,0.06)', borderRadius: '8px' }}>⚠️ {panelAiError}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
