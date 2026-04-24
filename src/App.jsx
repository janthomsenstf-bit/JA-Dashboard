import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { sampleClients } from './utils/sampleData.js'
import { calculateProgress, getOverdueClients } from './utils/progress.js'
import { loadChecklistenTypen, saveChecklistenTypen } from './utils/checklistenStorage.js'
import { loadVorlagen, saveVorlagen } from './utils/vorlagenStorage.js'
import AlertBanner from './components/AlertBanner.jsx'
import ClientTable from './components/ClientTable.jsx'
import DetailView from './components/detail/DetailView.jsx'
import NewClientModal from './components/NewClientModal.jsx'
import ArchiveModal from './components/ArchiveModal.jsx'
import ChecklistenEditor from './components/ChecklistenEditor.jsx'
import KalenderSection from './components/KalenderSection.jsx'
import GlobalTodoView  from './components/GlobalTodoView.jsx'
import PosteingangUngeklaert from './components/PosteingangUngeklaert.jsx'
import GlobalSearch          from './components/search/GlobalSearch.jsx'
import StartseiteHome        from './components/dashboard/StartseiteHome.jsx'
import CommandPalette        from './components/CommandPalette.jsx'
import { supabase } from './utils/supabaseClient.js'
import { cloudLoadAll, cloudSave, cloudSaveNow, cloudSnapshot, migrateLocalStorageToCloud } from './utils/cloudStorage.js'
import LoginPage from './components/LoginPage.jsx'
import FormularPage from './components/formular/FormularPage.jsx'

const BACKUP_INTERVAL_MS = 30 * 60 * 1000  // 30 Minuten

const STORAGE_KEY       = 'jans-spielbuch-v1'
const LAST_SAVE_KEY     = 'jans-spielbuch-last-save'

function fmtZeit(iso) {
  if (!iso) return '–'
  const d     = new Date(iso)
  const heute = new Date()
  const zeit  = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
  if (d.toDateString() === heute.toDateString())
    return `heute ${zeit}`
  if (d.toDateString() === new Date(heute - 86400000).toDateString())
    return `gestern ${zeit}`
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} ${zeit}`
}

function fmtDatumLang(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  return d.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' })
    + ' um ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'
}

// ── Migration: Alle Felder explizit mit Defaults belegen ──────────────────────
function migrateClient(c) {
  if (!c || typeof c !== 'object') return null
  // rueckfragenSendungen: array[4] – migriert altes Einzelfeld wenn nötig
  let sendungen = ['', '', '', '']
  if (Array.isArray(c.rueckfragenSendungen) && c.rueckfragenSendungen.length >= 4) {
    sendungen = c.rueckfragenSendungen.slice(0, 4)
  } else if (c.rueckfragenGesendetDatum) {
    sendungen = [c.rueckfragenGesendetDatum, '', '', '']
  }

  // Rückfragen: sicherstellen dass antwort- und buchungskonto-Feld existiert
  const rueckfragen = Array.isArray(c.rueckfragen)
    ? c.rueckfragen.map(r => ({ buchungskonto: '', antwort: '', ...r }))
    : []

  return {
    id:                       c.id                       ?? ('c' + Date.now().toString(36)),
    mandantennummer:          c.mandantennummer          ?? '',
    mandantennummer2:         c.mandantennummer2         ?? '',
    mandantennummer3:         c.mandantennummer3         ?? '',
    name:                     c.name                     ?? '',
    rechtsform:               c.rechtsform               ?? '',
    gewinnermittlung:         c.gewinnermittlung         ?? '',
    veranlagungsjahr:         c.veranlagungsjahr         ?? new Date().getFullYear(),
    archiviert:               c.archiviert               ?? false,
    rueckfragen,
    inBearbeitung:            c.inBearbeitung            ?? false,
    rueckfragenSendungen:     sendungen,
    abschlussFertig:          c.abschlussFertig          ?? false,
    abschlussFertigDatum:     c.abschlussFertigDatum     ?? null,
    steGesendetDatum:         c.steGesendetDatum         ?? null,
    unterschriftDatum:        c.unterschriftDatum        ?? null,
    faGeplantDatum:           c.faGeplantDatum           ?? null,
    faUebermittelt:           c.faUebermittelt           ?? false,
    faUebermitteltDatum:      c.faUebermitteltDatum      ?? null,
    erinnerungen:             Array.isArray(c.erinnerungen) ? c.erinnerungen : [],
    notizen:                  c.notizen                  ?? '',
    archivSummary:            c.archivSummary            ?? '',
    archivDatum:              c.archivDatum              ?? null,
    berechnungen:             c.berechnungen             ?? { kfz: [], arbeitszimmer: [], reisekosten: [] },
    auftrag:                  c.auftrag                  ?? {},
    susa:                     c.susa                     ?? { typ: null, kontorahmen: 'skr03', konten: [], importDatum: null, dateiname: '' },
    checklisten:              c.checklisten              ?? {},
    standDerArbeit:              c.standDerArbeit              ?? { hinweise: [], offenePunkte: [], berechnungen: [] },
    ustZahlerTyp:                c.ustZahlerTyp                ?? 'keine',
    lohnAktiv:                   c.lohnAktiv                   ?? false,
    lohnInUebersicht:            c.lohnInUebersicht            ?? true,
    ustInUebersicht:             c.ustInUebersicht             ?? true,
    jaInUebersicht:              c.jaInUebersicht              ?? true,
    jahresabschlussErforderlich: c.jahresabschlussErforderlich ?? false,
    aufgabenStatus:              c.aufgabenStatus              ?? {},
    unternehmensgegenstand:      c.unternehmensgegenstand      ?? '',
    veranlagungsjahr2:           c.veranlagungsjahr2           ?? '',
    veranlagungsjahr3:           c.veranlagungsjahr3           ?? '',
    kommunikation:               (() => {
      const k = c.kommunikation ?? {}
      return { standardAbsender: '', ...k, events: Array.isArray(k.events) ? k.events : [] }
    })(),
    abschluss:                   (() => {
      const base = c.abschluss ?? {}
      return { punkte: [], ...base, checkliste: base.checkliste ?? null }
    })(),
    steuerarten:                 c.steuerarten                 ?? {},
    ustSystem:                   c.ustSystem                   ?? '',
    lohnIntervall:               c.lohnIntervall               ?? 'monatlich',
    beratung:                    c.beratung                    ?? { branche: '', ergebnis: null, erstelltAm: null },
    jaMonat:                     c.jaMonat                     ?? null,
    jaAuftraege:                 Array.isArray(c.jaAuftraege)   ? c.jaAuftraege    : [],
    zusatzaufgaben:              Array.isArray(c.zusatzaufgaben) ? c.zusatzaufgaben : [],
    aufgaben:                    Array.isArray(c.aufgaben)       ? c.aufgaben       : [],
    rechner:                     Array.isArray(c.rechner)        ? c.rechner        : [],
    kontakte:                    Array.isArray(c.kontakte)       ? c.kontakte       : [],
    mandatstyp:                  c.mandatstyp                   ?? 'extern',
    manuellerStatus:             c.manuellerStatus              ?? null,
    est:                         c.est                          ?? {},
    auftraege:                   Array.isArray(c.auftraege)      ? c.auftraege : [],
    ust:                         c.ust                           ?? {},
    struktur:                    c.struktur                      ?? null,
    lohnSerie:                   c.lohnSerie ?? { aktiv: false, startDatum: '', frequenz: 'monatlich', faelligTag: 22, endDatum: '', intervallTyp: 'monate', intervallWert: 1 },
    fibuAktiv:                   c.fibuAktiv                     ?? false,
    fibuInUebersicht:            c.fibuInUebersicht              ?? false,
    fibuSerie:                   c.fibuSerie ?? { aktiv: false, startDatum: '', frequenz: 'monatlich', faelligTag: 10, endDatum: '', intervallTyp: 'monate', intervallWert: 1 },
    fibuNotizen:                 Array.isArray(c.fibuNotizen) ? c.fibuNotizen : [],
    steuernummer:                c.steuernummer                  ?? '',
    gesellschafter:              Array.isArray(c.gesellschafter)  ? c.gesellschafter : [],
    geschaeftsfuehrer:           Array.isArray(c.geschaeftsfuehrer) ? c.geschaeftsfuehrer : [],
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(migrateClient).filter(Boolean)
      }
    }
  } catch (e) {
    console.error('[Spielbuch] Fehler beim Laden der Daten:', e)
  }
  return null
}

function saveState(clients) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients))
    localStorage.setItem(LAST_SAVE_KEY, new Date().toISOString())
  } catch { /* ignore */ }
}


function generateId() {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// ── E-Mail offen? (kein erledigtAm + keine gesendete Antwort danach) ──────────
function isEmailOpen(incomingEvent, allEvents) {
  if (incomingEvent.erledigtAm) return false
  const t = new Date(incomingEvent.erstelltAm).getTime()
  return !allEvents.some(
    e => e.typ !== 'eingehend' && e.status === 'gesendet' && new Date(e.erstelltAm).getTime() > t
  )
}

export default function App() {
  const [authUser,      setAuthUser]      = useState(undefined)  // undefined=laden, null=abgemeldet, obj=eingeloggt
  const [dataLoading,   setDataLoading]   = useState(false)
  const [migrationData, setMigrationData] = useState(null)       // localStorage-Daten gefunden nach Login
  const [clients, setClients]             = useState([])
  const [selectedId, setSelectedId]       = useState(null)
  const [filter, setFilter]               = useState('all')
  const [mandatsTypFilter, setMandatsTypFilter] = useState('all')
  const [search, setSearch]               = useState('')
  const [sortCol, setSortCol]             = useState('mandantennummer')
  const [sortDir, setSortDir]             = useState('asc')
  const [showNewModal, setShowNewModal]   = useState(false)
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [importMsg, setImportMsg]         = useState('')
  const [sidebarOpen, setSidebarOpen]     = useState(true)
  const [checklistenTypen, setChecklistenTypen]         = useState(() => loadChecklistenTypen())  // Fallback: lokal
  const [showChecklistEditor, setShowChecklistEditor]   = useState(false)
  const [vorlagen, setVorlagen]                         = useState(() => loadVorlagen())           // Fallback: lokal
  const importRef                         = useRef(null)

  // ── Posteingang / E-Mail-Auto-Abruf ──────────────────────────────────────────
  const [unbekannteEmails,  setUnbekannteEmails]  = useState([])
  const [posteingangOpen,   setPosteingangOpen]   = useState(false)

  // ── E-Mail-Vorlagen & Signaturen ─────────────────────────────────────────────
  const [emailVorlagen,   setEmailVorlagen]   = useState([])
  const [emailSignaturen, setEmailSignaturen] = useState([])

  // ── Formular-Templates ────────────────────────────────────────────────────────
  const [formVorlagen, setFormVorlagen] = useState([])

  // ── OneDrive-Tokens ───────────────────────────────────────────────────────────
  const [onedriveTokens, setOnedriveTokens] = useState(null)

  // ── Claude API-Key (global, cloud-persistent) ─────────────────────────────────
  const [claudeApiKey, setClaudeApiKey] = useState(() => localStorage.getItem('sda-claude-api-key') ?? '')

  // ── Termine ───────────────────────────────────────────────────────────────────
  const [termine, setTermine] = useState([])

  // ── Manuelle Aufgaben (global, mandantenübergreifend) ─────────────────────────
  const [aufgabenListe, setAufgabenListe] = useState([])

  // ── Zeitstempel ───────────────────────────────────────────────────────────────
  const [lastSaveAt,   setLastSaveAt]   = useState(null)
  const [startupBanner, setStartupBanner] = useState(true)

  // ── Toast (E-Mail-Benachrichtigungen etc.) ────────────────────────────────────
  const [backupToast, setBackupToast]       = useState('')
  const clientsRef                          = useRef(clients)
  const unbekannteEmailsRef                 = useRef([])
  const recheckFnRef                        = useRef(null)  // immer aktuelle Recheck-Funktion
  const lastEmailFetchRef                   = useRef(localStorage.getItem('email-last-fetch-at') || null)
  const [headerMenuOpen,    setHeaderMenuOpen]    = useState(false)
  const headerMenuRef                            = useRef(null)
  const [calendarOpen,      setCalendarOpen]      = useState(() => localStorage.getItem('calendar-open') !== 'false')
  const [cmdPaletteOpen,    setCmdPaletteOpen]    = useState(false)
  const [detailInitialTab,  setDetailInitialTab]  = useState(0)

  // clientsRef immer aktuell halten (für den Interval-Callback)
  useEffect(() => { clientsRef.current = clients }, [clients])
  useEffect(() => { unbekannteEmailsRef.current = unbekannteEmails }, [unbekannteEmails])

  // ── Supabase Auth ─────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Cloud-Daten laden wenn eingeloggt ─────────────────────────────────────────
  useEffect(() => {
    if (!authUser) return
    setDataLoading(true)
    cloudLoadAll().then(cloudData => {
      if (cloudData && cloudData[STORAGE_KEY]) {
        const raw = cloudData[STORAGE_KEY]
        setClients(Array.isArray(raw) ? raw.map(migrateClient).filter(Boolean) : [])
        if (Array.isArray(cloudData['sdb-termine']))        setTermine(cloudData['sdb-termine'])
        if (Array.isArray(cloudData['sdb-aufgaben-liste'])) setAufgabenListe(cloudData['sdb-aufgaben-liste'])
        if (cloudData['spielbuch-checklisten-v1'])    setChecklistenTypen(cloudData['spielbuch-checklisten-v1'])
        if (cloudData['spielbuch-vorlagen-v1'])       setVorlagen(cloudData['spielbuch-vorlagen-v1'])
        if (Array.isArray(cloudData['unbekannte-emails'])) setUnbekannteEmails(cloudData['unbekannte-emails'])
        if (Array.isArray(cloudData['email-vorlagen-v1']))    setEmailVorlagen(cloudData['email-vorlagen-v1'])
        if (Array.isArray(cloudData['email-signaturen-v1'])) setEmailSignaturen(cloudData['email-signaturen-v1'])
        if (cloudData['onedrive-tokens-v1'])                 setOnedriveTokens(cloudData['onedrive-tokens-v1'])
        if (Array.isArray(cloudData['form-vorlagen-v1']))    setFormVorlagen(cloudData['form-vorlagen-v1'])
        if (cloudData['claude-api-key-v1']) {
          setClaudeApiKey(cloudData['claude-api-key-v1'])
          localStorage.setItem('sda-claude-api-key', cloudData['claude-api-key-v1'])
        }
      } else {
        // Noch keine Cloud-Daten – lokale Daten prüfen
        try {
          const localRaw = localStorage.getItem(STORAGE_KEY)
          if (localRaw) {
            const localClients = JSON.parse(localRaw)
            if (Array.isArray(localClients) && localClients.length > 0) {
              setMigrationData(localClients)
              setClients(localClients.map(migrateClient).filter(Boolean))
            }
          } else {
            setClients(sampleClients.map(migrateClient))
          }
        } catch { setClients(sampleClients.map(migrateClient)) }
      }
      setDataLoading(false)
    }).catch(() => {
      // Netzwerkfehler: lokaler Fallback
      setClients(loadState() ?? sampleClients.map(migrateClient))
      setDataLoading(false)
    })
  }, [authUser])

  // ── Cloud speichern (debounced, 1,5s) ────────────────────────────────────────
  useEffect(() => {
    if (!authUser || dataLoading) return
    cloudSave(STORAGE_KEY, clients)
    setLastSaveAt(new Date().toISOString())
  }, [clients])

  // ── Sofort speichern wenn Seite geschlossen/neu geladen wird ─────────────────
  // Verhindert Datenverlust wenn die Seite sich schließt bevor der 1,5s-Debounce feuert
  useEffect(() => {
    if (!authUser) return
    const handleBeforeUnload = () => {
      // Synchron in localStorage schreiben – das klappt immer, auch beim Tab-Schließen
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(clientsRef.current)) } catch {}
      // Async Cloud-Save mit keepalive (Browser bricht es nicht ab)
      cloudSaveNow(STORAGE_KEY, clientsRef.current).catch(() => {})
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [authUser, clients])
  useEffect(() => {
    if (!authUser || dataLoading) return
    cloudSave('spielbuch-checklisten-v1', checklistenTypen)
  }, [checklistenTypen])
  useEffect(() => {
    if (!authUser || dataLoading) return
    cloudSave('spielbuch-vorlagen-v1', vorlagen)
  }, [vorlagen])
  useEffect(() => {
    if (!authUser || dataLoading) return
    cloudSave('sdb-termine', termine)
  }, [termine])
  useEffect(() => {
    if (!authUser || dataLoading) return
    cloudSave('sdb-aufgaben-liste', aufgabenListe)
  }, [aufgabenListe])
  useEffect(() => {
    if (!authUser || dataLoading) return
    cloudSave('unbekannte-emails', unbekannteEmails)
  }, [unbekannteEmails])
  useEffect(() => {
    if (!authUser || dataLoading) return
    cloudSave('email-vorlagen-v1', emailVorlagen)
  }, [emailVorlagen])
  useEffect(() => {
    if (!authUser || dataLoading) return
    cloudSave('email-signaturen-v1', emailSignaturen)
  }, [emailSignaturen])
  useEffect(() => {
    if (!authUser || dataLoading || !onedriveTokens) return
    cloudSaveNow('onedrive-tokens-v1', onedriveTokens).catch(() => {})
  }, [onedriveTokens])
  useEffect(() => {
    if (!authUser || dataLoading) return
    localStorage.setItem('sda-claude-api-key', claudeApiKey)
    if (claudeApiKey) cloudSaveNow('claude-api-key-v1', claudeApiKey).catch(() => {})
  }, [claudeApiKey])

  // Auto-dismiss Startup-Banner nach 6 Sekunden
  useEffect(() => {
    if (!startupBanner) return
    const t = setTimeout(() => setStartupBanner(false), 6000)
    return () => clearTimeout(t)
  }, [startupBanner])

  // Click-outside für Header-Menü
  useEffect(() => {
    function handleClickOutside(e) {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) {
        setHeaderMenuOpen(false)
      }
    }
    if (headerMenuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [headerMenuOpen])

  // ── CMD+K Command Palette ────────────────────────────────────────────────────
  useEffect(() => {
    function handleCmdK(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCmdPaletteOpen(p => !p)
      }
    }
    document.addEventListener('keydown', handleCmdK)
    return () => document.removeEventListener('keydown', handleCmdK)
  }, [])

  // ── Auto-Snapshot alle 30 Minuten ────────────────────────────────────────────
  useEffect(() => {
    if (!authUser) return
    const id = setInterval(() => {
      cloudSnapshot(STORAGE_KEY, clientsRef.current).catch(() => {})
      const now = new Date().toISOString()
      setLastBackupAt(now)
    }, BACKUP_INTERVAL_MS)
    return () => clearInterval(id)
  }, [authUser])

  // ── E-Mail Auto-Polling ───────────────────────────────────────────────────────
  function buildIncomingEvent(email) {
    return {
      id: 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
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
  }

  async function pollEmails() {
    const since = lastEmailFetchRef.current
    const sinceParam = since ? '&since=' + encodeURIComponent(since) : ''
    const [h, s] = await Promise.all([
      fetch(`/api/fetch-emails?account=hostinger${sinceParam}`).then(r => r.json()).catch(() => ({ emails: [] })),
      fetch(`/api/fetch-emails?account=strato${sinceParam}`).then(r => r.json()).catch(() => ({ emails: [] })),
    ])
    const newEmails = [...(h.emails ?? []), ...(s.emails ?? [])]
    if (!newEmails.length) return

    // Deduplication: bekannte UIDs aus Mandanten-Events + unbekannte Liste
    const knownUids = new Set()
    clientsRef.current.forEach(c =>
      (c.kommunikation?.events ?? []).forEach(e => {
        if (e.sourceUid) knownUids.add(`${e.sourceAccount}:${e.sourceUid}`)
      })
    )
    unbekannteEmailsRef.current.forEach(e => knownUids.add(`${e.account}:${e.uid}`))

    const fresh = newEmails.filter(e => !knownUids.has(`${e.account}:${e.uid}`))
    if (!fresh.length) {
      const now = new Date().toISOString()
      lastEmailFetchRef.current = now
      localStorage.setItem('email-last-fetch-at', now)
      return
    }

    // E-Mail-Adress-Index: email.toLowerCase() → clientId
    const emailIndex = {}
    clientsRef.current.forEach(c =>
      (c.kontakte ?? []).forEach(k => {
        if (k.email) emailIndex[k.email.toLowerCase()] = c.id
      })
    )

    const toAssign = []
    const toUnbekannt = []
    fresh.forEach(email => {
      const clientId = emailIndex[email.von?.toLowerCase()]
      if (clientId) toAssign.push({ clientId, email })
      else toUnbekannt.push({ ...email, empfangenAm: new Date().toISOString() })
    })

    if (toAssign.length) {
      setClients(prev => prev.map(c => {
        const matching = toAssign.filter(a => a.clientId === c.id)
        if (!matching.length) return c
        const newEvents = matching.map(({ email }) => buildIncomingEvent(email))
        const komm = c.kommunikation ?? { events: [] }
        return { ...c, kommunikation: { ...komm, events: [...newEvents, ...komm.events] } }
      }))
    }

    if (toUnbekannt.length) {
      setUnbekannteEmails(prev => [...toUnbekannt, ...prev])
    }

    const now = new Date().toISOString()
    lastEmailFetchRef.current = now
    localStorage.setItem('email-last-fetch-at', now)
  }

  useEffect(() => {
    if (!authUser) return
    // Erster Abruf nach kurzer Verzögerung (damit Daten geladen sind)
    const initTimer = setTimeout(() => pollEmails().catch(() => {}), 5000)
    const id = setInterval(() => pollEmails().catch(() => {}), 15 * 60 * 1000)
    return () => { clearTimeout(initTimer); clearInterval(id) }
  }, [authUser])

  // ── E-Mail einem Mandanten manuell zuordnen ───────────────────────────────────
  function assignEmail(emailUid, emailAccount, clientId, saveContact) {
    const email = unbekannteEmailsRef.current.find(e => e.uid === emailUid && e.account === emailAccount)
    if (!email) return
    const event = buildIncomingEvent(email)
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c
      const komm = c.kommunikation ?? { events: [] }
      const newKontakte = saveContact && !( c.kontakte ?? []).some(k => k.email?.toLowerCase() === email.von?.toLowerCase())
        ? [...(c.kontakte ?? []), { id: 'p' + Date.now().toString(36), name: email.vonName || '', rolle: '', email: email.von, telefon: '' }]
        : c.kontakte ?? []
      return { ...c, kommunikation: { ...komm, events: [event, ...komm.events] }, kontakte: newKontakte }
    }))
    setUnbekannteEmails(prev => prev.filter(e => !(e.uid === emailUid && e.account === emailAccount)))
  }

  function assignAllFromAddress(vonAddress, clientId, saveContact) {
    const matching = unbekannteEmailsRef.current.filter(e => e.von?.toLowerCase() === vonAddress.toLowerCase())
    if (!matching.length) return
    const newEvents = matching.map(email => buildIncomingEvent(email))
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c
      const komm = c.kommunikation ?? { events: [] }
      const firstMatch = matching[0]
      const newKontakte = saveContact && !(c.kontakte ?? []).some(k => k.email?.toLowerCase() === vonAddress.toLowerCase())
        ? [...(c.kontakte ?? []), { id: 'p' + Date.now().toString(36), name: firstMatch.vonName || '', rolle: '', email: firstMatch.von, telefon: '' }]
        : c.kontakte ?? []
      return { ...c, kommunikation: { ...komm, events: [...newEvents, ...komm.events] }, kontakte: newKontakte }
    }))
    setUnbekannteEmails(prev => prev.filter(e => e.von?.toLowerCase() !== vonAddress.toLowerCase()))
  }

  // ── Ungeklärte E-Mails erneut gegen Mandanten-Kontakte abgleichen ────────────
  function recheckUnbekannteEmails() {
    const emails = unbekannteEmailsRef.current
    if (!emails.length) return { geprüft: 0, zugeordnet: 0, verbleibend: 0 }

    // E-Mail-Adress-Index aus aktuellen Mandanten-Kontakten aufbauen
    const emailIndex = {}
    clientsRef.current.forEach(c =>
      (c.kontakte ?? []).forEach(k => {
        if (k.email) emailIndex[k.email.toLowerCase()] = c.id
      })
    )

    const toAssign = []
    const toKeep   = []
    emails.forEach(email => {
      const clientId = emailIndex[email.von?.toLowerCase()]
      if (clientId) toAssign.push({ clientId, email })
      else toKeep.push(email)
    })

    if (toAssign.length) {
      setClients(prev => prev.map(c => {
        const matching = toAssign.filter(a => a.clientId === c.id)
        if (!matching.length) return c
        const newEvents = matching.map(({ email }) => buildIncomingEvent(email))
        const komm = c.kommunikation ?? { events: [] }
        return { ...c, kommunikation: { ...komm, events: [...newEvents, ...komm.events] } }
      }))
      setUnbekannteEmails(toKeep)
    }

    return { geprüft: emails.length, zugeordnet: toAssign.length, verbleibend: toKeep.length }
  }
  // Ref immer aktuell halten (für Aufrufe aus Callbacks)
  recheckFnRef.current = recheckUnbekannteEmails


  async function handlePickBackupDir() {
    try {
      setBackupLoading(true)
      const handle = await pickBackupDir()
      setBackupDir(handle)
      setBackupDirName(handle.name)
      setBackupToast(`✓ Sicherungsordner gesetzt: ${handle.name}`)
      setTimeout(() => setBackupToast(''), 4000)
    } catch (e) {
      if (e.name !== 'AbortError') {
        setBackupToast(`⚠ ${e.message}`)
        setTimeout(() => setBackupToast(''), 5000)
      }
    } finally {
      setBackupLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setClients([])
    setTermine([])
    setMigrationData(null)
  }

  async function handleMigration() {
    if (!migrationData) return
    await migrateLocalStorageToCloud([
      STORAGE_KEY, 'sdb-termine', 'spielbuch-checklisten-v1',
      'spielbuch-vorlagen-v1', 'checkliste-struktur-v1', 'kfz-buchungshinweise-defaults',
    ])
    setMigrationData(null)
    setImportMsg('✓ Lokale Daten erfolgreich in Cloud übertragen')
    setTimeout(() => setImportMsg(''), 5000)
  }

  function openClientAtKomm(clientId) {
    setDetailInitialTab(8)
    setSelectedId(clientId)
  }

  const updateClient = useCallback((id, patch) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
    // Auto-Recheck: wenn Kontakte geändert wurden und ungeklärte E-Mails vorhanden
    if (patch.kontakte && unbekannteEmailsRef.current.length > 0) {
      setTimeout(() => {
        const result = recheckFnRef.current?.()
        if (result?.zugeordnet > 0) {
          setBackupToast(`✓ ${result.zugeordnet} E-Mail${result.zugeordnet !== 1 ? 's' : ''} automatisch zugeordnet`)
          setTimeout(() => setBackupToast(''), 5000)
        }
      }, 300)
    }
  }, [])

  const selectedClient = clients.find(c => c.id === selectedId) ?? null


  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result)
        if (!Array.isArray(parsed)) throw new Error('Kein Array')
        const migrated = parsed.map(migrateClient).filter(Boolean)
        if (migrated.length === 0) throw new Error('Keine gültigen Mandanten')
        setClients(migrated)
        setSelectedId(null)
        setImportMsg(`✓ ${migrated.length} Mandanten erfolgreich importiert`)
        setTimeout(() => setImportMsg(''), 4000)
      } catch (err) {
        setImportMsg('⚠ Fehler beim Import: ' + err.message)
        setTimeout(() => setImportMsg(''), 5000)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ── Client CRUD ───────────────────────────────────────────────────────────────
  function addClient(data) {
    const newClient = {
      id: generateId(),
      ...data,
      archiviert: false,
      rueckfragen: [],
      inBearbeitung: false,
      rueckfragenSendungen: ['', '', '', ''],
      abschlussFertig: false,
      abschlussFertigDatum: null,
      steGesendetDatum: null,
      unterschriftDatum: null,
      faGeplantDatum: null,
      faUebermittelt: false,
      faUebermitteltDatum: null,
      erinnerungen: [],
      notizen: '',
      archivSummary: '',
      archivDatum: null,
      berechnungen: { kfz: [], arbeitszimmer: [], reisekosten: [] },
      auftrag: {},
      susa: { typ: null, kontorahmen: 'skr03', konten: [], importDatum: null, dateiname: '' },
      checklisten: {},
    }
    setClients(prev => [newClient, ...prev])
    setSelectedId(newClient.id)
    setShowNewModal(false)
  }

  function deleteClient(id) {
    const zugehörigeTermine = termine.filter(t => t.mandantId === id)
    if (zugehörigeTermine.length > 0) {
      if (window.confirm(`Dieser Mandant hat ${zugehörigeTermine.length} Termin(e). Auch die Termine löschen?`)) {
        setTermine(prev => prev.filter(t => t.mandantId !== id))
      }
    }
    setClients(prev => prev.filter(c => c.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  // ── Termine CRUD ──────────────────────────────────────────────────────────────
  function addTermin(t) { setTermine(prev => [...prev, t]) }
  function updateTermin(id, patch) { setTermine(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t)) }
  function deleteTermin(id) { setTermine(prev => prev.filter(t => t.id !== id)) }

  // ── Manuelle Aufgaben CRUD ────────────────────────────────────────────────────
  function addAufgabe(data) {
    setAufgabenListe(prev => [...prev, {
      ...data,
      id:        'ma_' + Date.now().toString(36),
      createdAt: new Date().toISOString(),
    }])
  }
  function updateAufgabe(id, patch) {
    setAufgabenListe(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
  }
  function deleteAufgabe(id) {
    setAufgabenListe(prev => prev.filter(a => a.id !== id))
  }

  function archiveClient(id, data, exportFn) {
    if (exportFn) exportFn()
    // data kann { steuerdatum, besonderheiten } sein (neues Format) oder string (legacy)
    const isObj = data && typeof data === 'object'
    updateClient(id, {
      archiviert:            true,
      archivSummary:         isObj ? data.besonderheiten : data,
      abschlussSteuerdatum:  isObj ? data.steuerdatum    : null,
      archivDatum:           new Date().toISOString().slice(0, 10),
    })
    if (selectedId === id) setSelectedId(null)
    setArchiveTarget(null)
  }

  // ── Rückfragen ────────────────────────────────────────────────────────────────
  function addRueckfrage(clientId, text) {
    if (!text.trim()) return
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c
      return {
        ...c,
        rueckfragen: [...c.rueckfragen, {
          id: 'rq' + Date.now(),
          text: text.trim(),
          buchungskonto: '',
          antwort: '',
          beantwortet: false,
          beantwortetAm: null,
        }],
      }
    }))
  }

  function toggleRueckfrage(clientId, rqId, checked) {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c

      // Rückfrage finden (für Checklisten-Sync)
      const rq = c.rueckfragen.find(r => r.id === rqId)

      const updatedRueckfragen = c.rueckfragen.map(r => {
        if (r.id !== rqId) return r
        return {
          ...r,
          beantwortet: checked,
          beantwortetAm: checked ? new Date().toISOString().slice(0, 10) : null,
        }
      })

      // Checklisten-Prüfpunkt synchronisieren (falls verknüpft)
      let updatedChecklisten = c.checklisten ?? {}
      if (rq?.quelleTypId && rq?.quelleItemId) {
        const { quelleTypId, quelleItemId } = rq
        updatedChecklisten = {
          ...updatedChecklisten,
          [quelleTypId]: {
            ...(updatedChecklisten[quelleTypId] ?? {}),
            [quelleItemId]: {
              ...(updatedChecklisten[quelleTypId]?.[quelleItemId] ?? {}),
              erledigt: checked,
            },
          },
        }
      }

      return { ...c, rueckfragen: updatedRueckfragen, checklisten: updatedChecklisten }
    }))
  }

  // ── Rückfrage aus Checkliste erstellen (mit Rückverweis) ──────────────────────
  function addRueckfrageFromCheckliste(clientId, rqId, text, quelleTypId, quelleItemId, checklistName) {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c
      if (c.rueckfragen.some(r => r.id === rqId)) return c  // bereits vorhanden
      return {
        ...c,
        rueckfragen: [...c.rueckfragen, {
          id:            rqId,
          text:          `[${checklistName}] ${text}`,
          buchungskonto: '',
          antwort:       '',
          beantwortet:   false,
          beantwortetAm: null,
          quelleTypId,
          quelleItemId,
        }],
      }
    }))
  }

  function deleteRueckfrage(clientId, rqId) {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c
      return { ...c, rueckfragen: c.rueckfragen.filter(r => r.id !== rqId) }
    }))
  }

  function updateRueckfrageDate(clientId, rqId, date) {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c
      return {
        ...c,
        rueckfragen: c.rueckfragen.map(r => r.id === rqId ? { ...r, beantwortetAm: date } : r),
      }
    }))
  }

  function updateRueckfrageAntwort(clientId, rqId, antwort) {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c
      return {
        ...c,
        rueckfragen: c.rueckfragen.map(r => r.id === rqId ? { ...r, antwort } : r),
      }
    }))
  }

  function updateRueckfrageBuchungskonto(clientId, rqId, buchungskonto) {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c
      return {
        ...c,
        rueckfragen: c.rueckfragen.map(r => r.id === rqId ? { ...r, buchungskonto } : r),
      }
    }))
  }

  // ── Erinnerungen ──────────────────────────────────────────────────────────────
  function addErinnerung(clientId, datum, text) {
    if (!datum || !text.trim()) return
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c
      return {
        ...c,
        erinnerungen: [...c.erinnerungen, {
          id: 'er' + Date.now(),
          datum,
          text: text.trim(),
        }],
      }
    }))
  }

  function deleteErinnerung(clientId, erId) {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c
      return { ...c, erinnerungen: c.erinnerungen.filter(e => e.id !== erId) }
    }))
  }

  function updateBerechnungen(clientId, berechnungen) {
    updateClient(clientId, { berechnungen })
  }

  // ── Checkliste (pro Mandant) ───────────────────────────────────────────────
  function updateChecklisteItem(clientId, typId, itemId, data) {
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c
      const checklisten = { ...(c.checklisten ?? {}) }
      checklisten[typId] = { ...(checklisten[typId] ?? {}), [itemId]: data }
      return { ...c, checklisten }
    }))
  }

  const overdueClients = getOverdueClients(clients)

  // ── Offene E-Mails (zugeordnet, aber noch nicht beantwortet/erledigt) ─────────
  const offeneEmailCount = useMemo(() => {
    let count = 0
    clients.filter(c => !c.archiviert).forEach(c => {
      const evts = c.kommunikation?.events ?? []
      evts.forEach(e => { if (e.typ === 'eingehend' && isEmailOpen(e, evts)) count++ })
    })
    return count
  }, [clients])

  // ── Formular-Templates speichern ──────────────────────────────────────────
  useEffect(() => {
    if (!authUser || dataLoading) return
    cloudSave('form-vorlagen-v1', formVorlagen)
  }, [formVorlagen])

  // ── Öffentliche Formular-Route (/formular/:token) – kein Login nötig ───────
  const formularToken = window.location.pathname.match(/^\/formular\/([0-9a-f-]{36})/i)?.[1]
  if (formularToken) return <FormularPage token={formularToken} />

  // Auth wird noch geprüft
  if (authUser === undefined) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Verbindung wird hergestellt…</div>
      </div>
    )
  }

  // Nicht eingeloggt
  if (authUser === null) return <LoginPage />

  // Daten werden geladen
  if (dataLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Daten werden geladen…</div>
      </div>
    )
  }

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        {/* Mobile Hamburger (nur auf ≤768px) */}
        <button
          className="mobile-hamburger"
          onClick={() => setSidebarOpen(o => !o)}
          aria-label="Mandanten-Liste"
        >
          ☰
        </button>

        <div className="app-header-logo" onClick={() => setSelectedId(null)} style={{ cursor: 'pointer' }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="var(--accent-dim)"/>
            <path d="M7 8h14M7 14h10M7 20h12" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div>
            <h1>Jan's Spielbuch</h1>
          </div>
          <span className="header-subtitle" style={{color:'var(--text-muted)', fontSize:'12px', marginLeft:'4px'}}>
            Jahresabschluss-Dashboard
          </span>
        </div>

        {/* ── Intelligente Suche ── */}
        <GlobalSearch
          clients={clients}
          onSelect={id => setSelectedId(id)}
          onEmailQuickAction={id => setSelectedId(id)}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {importMsg && (
            <span style={{
              fontSize: '11px',
              color: importMsg.startsWith('✓') ? 'var(--green)' : 'var(--orange)',
              fontFamily: 'var(--font-mono)',
            }}>
              {importMsg}
            </span>
          )}

          {/* Stand + Mandate-Zähler */}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {clients.filter(c => !c.archiviert).length} Mandate
            {lastSaveAt && <span style={{ marginLeft: '6px', opacity: 0.6 }}>· {fmtZeit(lastSaveAt)}</span>}
          </span>

          {/* ── E-Mail Status-Badges ── */}
          {(offeneEmailCount > 0 || unbekannteEmails.length > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {offeneEmailCount > 0 && (
                <button
                  onClick={() => setSelectedId(null)}
                  title={`${offeneEmailCount} offene E-Mail(s) — zur Startseite`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '3px 9px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                    background: 'rgba(22,163,74,0.12)', color: '#16a34a',
                    fontSize: '11px', fontWeight: 700, lineHeight: 1,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(22,163,74,0.22)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(22,163,74,0.12)'}
                >
                  ✉️ Neu: {offeneEmailCount}
                </button>
              )}
              {unbekannteEmails.length > 0 && (
                <button
                  onClick={() => setPosteingangOpen(true)}
                  title={`${unbekannteEmails.length} nicht zugeordnete E-Mail(s)`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '3px 9px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                    background: 'rgba(249,115,22,0.12)', color: '#f97316',
                    fontSize: '11px', fontWeight: 700, lineHeight: 1,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.22)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(249,115,22,0.12)'}
                >
                  📥 Ungeklärt: {unbekannteEmails.length}
                </button>
              )}
            </div>
          )}

          {/* Kalender-Toggle */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setCalendarOpen(o => { localStorage.setItem('calendar-open', String(!o)); return !o })}
            title={calendarOpen ? 'Kalender ausblenden' : 'Kalender einblenden'}
            style={{ fontSize: '14px', opacity: calendarOpen ? 1 : 0.45 }}
          >
            📅
          </button>

          {/* CMD+K Hint */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setCmdPaletteOpen(true)}
            title="Schnellsuche (Strg+K)"
            style={{ fontSize: '12px', color: 'var(--text-muted)' }}
          >
            ⌘K
          </button>

          {/* Primäre Aktion */}
          <button className="btn btn-primary btn-sm" onClick={() => setShowNewModal(true)}>
            + Neuer Fall
          </button>

          {/* Kebab-Menü */}
          <div ref={headerMenuRef} style={{ position: 'relative' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setHeaderMenuOpen(o => !o)}
              title="Weitere Optionen"
              style={{ fontSize: '18px', padding: '2px 8px', lineHeight: 1, letterSpacing: '2px' }}
            >
              ···
            </button>
            {headerMenuOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                minWidth: '230px', zIndex: 500,
                padding: '6px',
              }}>
                {/* Import */}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { importRef.current?.click(); setHeaderMenuOpen(false) }}
                  style={{ width: '100%', textAlign: 'left', fontSize: '12px', justifyContent: 'flex-start' }}
                >
                  📂 Import aus Backup
                </button>
                <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />

                {/* Checklisten */}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setShowChecklistEditor(true); setHeaderMenuOpen(false) }}
                  style={{ width: '100%', textAlign: 'left', fontSize: '12px', justifyContent: 'flex-start' }}
                >
                  ✅ Checklisten verwalten
                </button>

                {/* Trennlinie + Abmelden */}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: '4px', paddingTop: '4px' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { handleLogout(); setHeaderMenuOpen(false) }}
                    style={{ width: '100%', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)', justifyContent: 'flex-start' }}
                  >
                    🔒 Abmelden ({authUser?.email})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Migrations-Banner (lokale Daten gefunden) ── */}
      {migrationData && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
          padding: '8px 16px', fontSize: '12px',
          background: 'linear-gradient(90deg, #0f2744 0%, #1e3a5f 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.85)',
        }}>
          <span>📂 <strong>Lokale Daten gefunden</strong> – {migrationData.length} Mandanten aus diesem Browser. In Cloud übertragen?</span>
          <button onClick={handleMigration}
            style={{ padding: '3px 14px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
            ✓ Jetzt übertragen
          </button>
          <button onClick={() => setMigrationData(null)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '13px' }}>
            ✕
          </button>
        </div>
      )}

      {/* ── Startup-Statusbanner ── */}
      {startupBanner && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
          padding: '7px 16px', fontSize: '12px',
          background: 'linear-gradient(90deg, #0f2744 0%, #1e3a5f 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.75)',
        }}>
          <span>📋 <strong style={{ color: '#fff' }}>Datenstatus beim Öffnen:</strong></span>
          <span>🕐 Letzter Stand: <strong style={{ color: lastSaveAt ? '#86efac' : '#fca5a5' }}>{fmtDatumLang(lastSaveAt)}</strong></span>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>·</span>
          <span>☁️ Automatisch gesichert in der Cloud</span>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>·</span>
          <span>📂 <strong style={{ color: '#fff' }}>{clients.filter(c => !c.archiviert).length} Mandate</strong> geladen</span>
          <button onClick={() => setStartupBanner(false)} style={{
            marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 4px',
          }} title="Schließen">✕</button>
        </div>
      )}

      {overdueClients.length > 0 && (
        <AlertBanner clients={overdueClients} onSelect={id => setSelectedId(id)} />
      )}

      {posteingangOpen && (
        <PosteingangUngeklaert
          unbekannteEmails={unbekannteEmails}
          clients={clients}
          onAssign={assignEmail}
          onAssignAll={assignAllFromAddress}
          onRecheck={recheckUnbekannteEmails}
          onClose={() => setPosteingangOpen(false)}
        />
      )}


      {/* Auto-Backup Toast */}
      {backupToast && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999,
          background: backupToast.startsWith('⚠') ? 'var(--surface)' : 'var(--surface)',
          border: `1px solid ${backupToast.startsWith('⚠') ? 'var(--red)' : 'var(--green)'}`,
          borderRadius: 'var(--radius)', padding: '10px 16px',
          boxShadow: 'var(--shadow-lg)', fontSize: '12px',
          color: backupToast.startsWith('⚠') ? 'var(--red)' : 'var(--green)',
          maxWidth: '360px',
        }}>
          {backupToast}
        </div>
      )}

      {/* Body */}
      <div className="app-body">
        {/* Mobile Sidebar-Backdrop */}
        {sidebarOpen && (
          <div className="mobile-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Left column – einklappbar */}
        <div
          className={`col-left${sidebarOpen ? ' open' : ''}`}
          style={sidebarOpen ? {} : { width: '44px', minWidth: '44px', overflow: 'hidden' }}
        >
          {/* Toggle-Button */}
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen(o => !o)}
            title={sidebarOpen ? 'Sidebar einklappen' : 'Sidebar ausklappen'}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>

          {sidebarOpen && (
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
              <button
                onClick={() => setSelectedId('__todo__')}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: selectedId === '__todo__' ? 'var(--accent)' : 'var(--surface2)',
                  color: selectedId === '__todo__' ? '#fff' : 'var(--text)',
                  fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
                  transition: 'all 0.15s',
                }}
              >
                📋 Aufgaben-Übersicht
              </button>
            </div>
          )}
          {sidebarOpen && (
            <ClientTable
              clients={clients}
              selectedId={selectedId}
              filter={filter}
              mandatsTypFilter={mandatsTypFilter}
              search={search}
              sortCol={sortCol}
              sortDir={sortDir}
              onSelect={(id) => { setDetailInitialTab(0); setSelectedId(id) }}
              onFilterChange={setFilter}
              onMandatsTypFilterChange={setMandatsTypFilter}
              onSearchChange={setSearch}
              onSort={(col) => {
                if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                else { setSortCol(col); setSortDir('asc') }
              }}
            />
          )}
        </div>

        {/* Right column */}
        <div className="col-right">
          {selectedId === '__todo__' ? (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <GlobalTodoView
                clients={clients}
                aufgabenListe={aufgabenListe}
                onUpdateClient={updateClient}
                onSelectClient={id => setSelectedId(id)}
                onAddAufgabe={addAufgabe}
                onUpdateAufgabe={updateAufgabe}
                onDeleteAufgabe={deleteAufgabe}
              />
            </div>
          ) : selectedClient ? (
            <DetailView
              client={selectedClient}
              initialTab={detailInitialTab}
              onUpdate={(patch) => updateClient(selectedClient.id, patch)}
              onAddRueckfrage={(text) => addRueckfrage(selectedClient.id, text)}
              onToggleRueckfrage={(rqId, checked) => toggleRueckfrage(selectedClient.id, rqId, checked)}
              onDeleteRueckfrage={(rqId) => deleteRueckfrage(selectedClient.id, rqId)}
              onUpdateRueckfrageDate={(rqId, date) => updateRueckfrageDate(selectedClient.id, rqId, date)}
              onUpdateRueckfrageAntwort={(rqId, text) => updateRueckfrageAntwort(selectedClient.id, rqId, text)}
              onUpdateRueckfrageBuchungskonto={(rqId, kto) => updateRueckfrageBuchungskonto(selectedClient.id, rqId, kto)}
              onAddErinnerung={(datum, text) => addErinnerung(selectedClient.id, datum, text)}
              onDeleteErinnerung={(erId) => deleteErinnerung(selectedClient.id, erId)}
              onArchive={() => setArchiveTarget(selectedClient.id)}
              onDelete={() => {
                if (window.confirm(`Mandant "${selectedClient.name}" wirklich dauerhaft löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
                  deleteClient(selectedClient.id)
                }
              }}
              onUpdateBerechnungen={(b) => updateBerechnungen(selectedClient.id, b)}
              checklistenTypen={checklistenTypen}
              onUpdateCheckliste={(typId, itemId, data) => updateChecklisteItem(selectedClient.id, typId, itemId, data)}
              onAddRueckfrageFromCheckliste={(rqId, text, typId, itemId, name) =>
                addRueckfrageFromCheckliste(selectedClient.id, rqId, text, typId, itemId, name)}
              vorlagen={vorlagen}
              onUpdateVorlagen={setVorlagen}
              emailVorlagen={emailVorlagen}
              onUpdateEmailVorlagen={setEmailVorlagen}
              emailSignaturen={emailSignaturen}
              onUpdateEmailSignaturen={setEmailSignaturen}
              termine={termine}
              onAddTermin={addTermin}
              onUpdateTermin={updateTermin}
              onDeleteTermin={deleteTermin}
              onedriveTokens={onedriveTokens}
              onUpdateOnedriveTokens={setOnedriveTokens}
              claudeApiKey={claudeApiKey}
              onUpdateClaudeApiKey={setClaudeApiKey}
              formVorlagen={formVorlagen}
              onUpdateFormVorlagen={setFormVorlagen}
            />
          ) : (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <StartseiteHome
                clients={clients}
                onSelectClient={(id) => { setDetailInitialTab(0); setSelectedId(id) }}
                onSelectClientAtKomm={openClientAtKomm}
                onUpdateClient={updateClient}
              />
            </div>
          )}
        </div>

        {/* Right column – Kalender (togglebar) */}
        {calendarOpen && (
          <div className="col-calendar">
            <KalenderSection
              termine={termine}
              clients={clients}
              onAdd={addTermin}
              onUpdate={updateTermin}
              onDelete={deleteTermin}
              eventsOnly={true}
              prefillMandantId={selectedId}
            />
          </div>
        )}
      </div>

      {/* Command Palette */}
      {cmdPaletteOpen && (
        <CommandPalette
          clients={clients}
          onClose={() => setCmdPaletteOpen(false)}
          onSelectClient={id => { setSelectedId(id); setCmdPaletteOpen(false) }}
          onNewClient={() => { setShowNewModal(true); setCmdPaletteOpen(false) }}
        />
      )}

      {showNewModal && (
        <NewClientModal onClose={() => setShowNewModal(false)} onSubmit={addClient} />
      )}
      {archiveTarget && (
        <ArchiveModal
          client={clients.find(c => c.id === archiveTarget)}
          onClose={() => setArchiveTarget(null)}
          onArchive={(summary, exportFn) => archiveClient(archiveTarget, summary, exportFn)}
        />
      )}
      {showChecklistEditor && (
        <ChecklistenEditor
          typen={checklistenTypen}
          onSave={setChecklistenTypen}
          onClose={() => setShowChecklistEditor(false)}
          vorlagen={vorlagen}
          onUpdateVorlagen={setVorlagen}
        />
      )}
    </div>
  )
}
