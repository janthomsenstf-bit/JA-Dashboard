import { useState, useEffect, useCallback, useRef } from 'react'
import { sampleClients } from './utils/sampleData.js'
import { calculateProgress, getOverdueClients } from './utils/progress.js'
import { loadChecklistenTypen, saveChecklistenTypen } from './utils/checklistenStorage.js'
import { loadVorlagen, saveVorlagen } from './utils/vorlagenStorage.js'
import { isSupported as fsSupported, pickBackupDir, loadBackupDir, clearBackupDir, writeBackup, pruneOldBackups } from './utils/autoBackup.js'
import AlertBanner from './components/AlertBanner.jsx'
import ClientTable from './components/ClientTable.jsx'
import DetailView from './components/detail/DetailView.jsx'
import NewClientModal from './components/NewClientModal.jsx'
import ArchiveModal from './components/ArchiveModal.jsx'
import ChecklistenEditor from './components/ChecklistenEditor.jsx'
import KalenderSection from './components/KalenderSection.jsx'
import GlobalTodoView  from './components/GlobalTodoView.jsx'
import { supabase } from './utils/supabaseClient.js'
import { cloudLoadAll, cloudSave, cloudSaveNow, cloudSnapshot, migrateLocalStorageToCloud } from './utils/cloudStorage.js'
import LoginPage from './components/LoginPage.jsx'

const BACKUP_INTERVAL_MS = 30 * 60 * 1000  // 30 Minuten

const STORAGE_KEY       = 'jans-spielbuch-v1'
const LAST_SAVE_KEY     = 'jans-spielbuch-last-save'
const LAST_BACKUP_KEY   = 'jans-spielbuch-last-backup'

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
    kommunikation:               c.kommunikation               ?? { events: [] },
    abschluss:                   (() => {
      const base = c.abschluss ?? {}
      return { punkte: [], ...base, checkliste: base.checkliste ?? null }
    })(),
    steuerarten:                 c.steuerarten                 ?? {},
    ustSystem:                   c.ustSystem                   ?? '',
    lohnIntervall:               c.lohnIntervall               ?? 'monatlich',
    beratung:                    c.beratung                    ?? { branche: '', ergebnis: null, erstelltAm: null },
    jaMonat:                     c.jaMonat                     ?? null,
    zusatzaufgaben:              Array.isArray(c.zusatzaufgaben) ? c.zusatzaufgaben : [],
    rechner:                     Array.isArray(c.rechner)        ? c.rechner        : [],
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

function downloadBackup(clients) {
  const data = JSON.stringify(clients, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  a.href     = url
  a.download = `spielbuch-backup-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function generateId() {
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export default function App() {
  const [authUser,      setAuthUser]      = useState(undefined)  // undefined=laden, null=abgemeldet, obj=eingeloggt
  const [dataLoading,   setDataLoading]   = useState(false)
  const [migrationData, setMigrationData] = useState(null)       // localStorage-Daten gefunden nach Login
  const [clients, setClients]             = useState([])
  const [selectedId, setSelectedId]       = useState(null)
  const [filter, setFilter]               = useState('all')
  const [search, setSearch]               = useState('')
  const [sortCol, setSortCol]             = useState('mandantennummer')
  const [sortDir, setSortDir]             = useState('asc')
  const [showNewModal, setShowNewModal]   = useState(false)
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [importMsg, setImportMsg]         = useState('')
  const [sidebarOpen, setSidebarOpen]     = useState(true)
  const [backupReminder, setBackupReminder]             = useState(false)
  const [checklistenTypen, setChecklistenTypen]         = useState(() => loadChecklistenTypen())  // Fallback: lokal
  const [showChecklistEditor, setShowChecklistEditor]   = useState(false)
  const [vorlagen, setVorlagen]                         = useState(() => loadVorlagen())           // Fallback: lokal
  const importRef                         = useRef(null)

  // ── Termine ───────────────────────────────────────────────────────────────────
  const [termine, setTermine] = useState([])

  // ── Zeitstempel ───────────────────────────────────────────────────────────────
  const [lastSaveAt,   setLastSaveAt]   = useState(null)
  const [lastBackupAt, setLastBackupAt] = useState(null)
  const [startupBanner, setStartupBanner] = useState(true)

  // ── Auto-Backup State ──────────────────────────────────────────────────────────
  const [backupDir, setBackupDir]           = useState(null)          // FileSystemDirectoryHandle
  const [backupDirName, setBackupDirName]   = useState('')            // Anzeigename
  const [backupToast, setBackupToast]       = useState('')            // Erfolgs-/Fehlertext
  const [backupLoading, setBackupLoading]   = useState(false)
  const clientsRef                          = useRef(clients)

  // clientsRef immer aktuell halten (für den Interval-Callback)
  useEffect(() => { clientsRef.current = clients }, [clients])

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
        if (Array.isArray(cloudData['sdb-termine'])) setTermine(cloudData['sdb-termine'])
        if (cloudData['spielbuch-checklisten-v1'])    setChecklistenTypen(cloudData['spielbuch-checklisten-v1'])
        if (cloudData['spielbuch-vorlagen-v1'])       setVorlagen(cloudData['spielbuch-vorlagen-v1'])
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

  // ── Backup-Erinnerung alle 30 Minuten ─────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setBackupReminder(true), 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // ── Gespeicherten Backup-Ordner beim Start laden ───────────────────────────────
  useEffect(() => {
    if (!fsSupported) return
    loadBackupDir().then(handle => {
      if (handle) { setBackupDir(handle); setBackupDirName(handle.name) }
    }).catch(() => {})
  }, [])

  // ── Auto-Backup alle 30 Minuten ────────────────────────────────────────────────
  useEffect(() => {
    if (!backupDir) return
    const id = setInterval(async () => {
      try {
        const filename = await writeBackup(backupDir, clientsRef.current)
        await pruneOldBackups(backupDir, 20)
        const now = new Date().toISOString()
        localStorage.setItem(LAST_BACKUP_KEY, now)
        setLastBackupAt(now)
        setBackupToast(`✓ Auto-Sicherung: ${filename}`)
        setTimeout(() => setBackupToast(''), 5000)
      } catch (e) {
        setBackupToast(`⚠ Auto-Sicherung fehlgeschlagen: ${e.message}`)
        setTimeout(() => setBackupToast(''), 8000)
      }
    }, BACKUP_INTERVAL_MS)
    return () => clearInterval(id)
  }, [backupDir])

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

  async function handleManualBackup() {
    if (!backupDir) { handlePickBackupDir(); return }
    try {
      setBackupLoading(true)
      const filename = await writeBackup(backupDir, clients)
      await pruneOldBackups(backupDir, 20)
      const now = new Date().toISOString()
      localStorage.setItem(LAST_BACKUP_KEY, now)
      setLastBackupAt(now)
      setBackupToast(`✓ Sicherung gespeichert: ${filename}`)
      setTimeout(() => setBackupToast(''), 5000)
    } catch (e) {
      setBackupToast(`⚠ ${e.message}`)
      setTimeout(() => setBackupToast(''), 6000)
    } finally {
      setBackupLoading(false)
    }
  }

  async function handleClearBackupDir() {
    await clearBackupDir()
    setBackupDir(null)
    setBackupDirName('')
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

  const updateClient = useCallback((id, patch) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }, [])

  const selectedClient = clients.find(c => c.id === selectedId) ?? null

  // ── Backup / Import ───────────────────────────────────────────────────────────
  function handleBackup() { downloadBackup(clients) }

  function handleBackupReminder() {
    downloadBackup(clients)
    setBackupReminder(false)
  }

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
        <div className="app-header-logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="var(--accent-dim)"/>
            <path d="M7 8h14M7 14h10M7 20h12" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div>
            <h1>Jan's Spielbuch</h1>
          </div>
          <span style={{color:'var(--text-muted)', fontSize:'12px', marginLeft:'4px'}}>
            Jahresabschluss-Dashboard
          </span>
        </div>

        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
          {importMsg && (
            <span style={{
              fontSize: '11px',
              color: importMsg.startsWith('✓') ? 'var(--green)' : 'var(--orange)',
              fontFamily: 'var(--font-mono)',
            }}>
              {importMsg}
            </span>
          )}
          <span style={{fontFamily:'var(--font-mono)', fontSize:'11px', color:'var(--text-muted)'}}>
            {clients.filter(c => !c.archiviert).length} Mandate
          </span>
          {/* ── Auto-Backup Controls ── */}
          {fsSupported ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleManualBackup}
                disabled={backupLoading}
                title={backupDir ? `Jetzt sichern in: ${backupDirName}` : 'Sicherungsordner wählen & sichern'}
                style={{ fontSize: '12px', color: backupDir ? 'var(--green)' : undefined }}
              >
                {backupLoading ? '⏳' : (backupDir ? '💾 ✓' : '💾 Backup')}
              </button>
              {backupDir ? (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handlePickBackupDir}
                  title={`Ordner: ${backupDirName} – klicken zum Ändern`}
                  style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  📁 {backupDirName}
                </button>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handlePickBackupDir}
                  title="Ordner für automatische Sicherungen wählen"
                  style={{ fontSize: '11px', color: 'var(--orange)' }}
                >
                  📁 Ordner wählen
                </button>
              )}
            </div>
            {/* Zeitstempel-Zeile */}
            <div style={{ display: 'flex', gap: '10px', fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-mono)' }}>
              <span title="Wann wurden die Daten zuletzt gespeichert?">Stand: {fmtZeit(lastSaveAt)}</span>
              {lastBackupAt && <span title="Wann wurde zuletzt eine Sicherungsdatei erstellt?">💾 {fmtZeit(lastBackupAt)}</span>}
            </div>
            </div>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={handleBackup} title="Alle Daten als JSON-Datei sichern" style={{ fontSize: '12px' }}>
              💾 Backup
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => importRef.current?.click()} title="Daten aus Backup-Datei wiederherstellen" style={{ fontSize: '12px' }}>
            📂 Import
          </button>
          <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowChecklistEditor(true)}
            title="Checklisten-Typen verwalten"
            style={{ fontSize: '12px' }}
          >
            ✅ Checklisten
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNewModal(true)}>
            + Neuer Fall
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleLogout}
            title={`Abmelden (${authUser?.email})`}
            style={{ fontSize: '12px', color: 'var(--text-muted)' }}
          >
            🔒 Abmelden
          </button>
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
          <span>💾 Letzte Sicherung: <strong style={{ color: lastBackupAt ? '#86efac' : '#fca5a5' }}>{lastBackupAt ? fmtDatumLang(lastBackupAt) : 'noch keine Sicherung'}</strong></span>
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

      {/* Backup-Erinnerung nach 30 Minuten (nur wenn kein Auto-Backup-Ordner gesetzt) */}
      {backupReminder && !backupDir && (
        <div className="backup-reminder-banner">
          <span className="backup-reminder-icon">⏰</span>
          <span className="backup-reminder-text">
            <strong>Backup-Erinnerung</strong> – 30 Minuten sind vergangen. Daten jetzt sichern?
          </span>
          {fsSupported && (
            <button className="btn btn-primary btn-sm" onClick={() => { handlePickBackupDir(); setBackupReminder(false) }}>
              📁 Auto-Backup einrichten
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={handleBackupReminder}>
            💾 Einmalig herunterladen
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setBackupReminder(false)}>
            Später
          </button>
        </div>
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
        {/* Left column – einklappbar */}
        <div
          className="col-left"
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
              search={search}
              sortCol={sortCol}
              sortDir={sortDir}
              onSelect={setSelectedId}
              onFilterChange={setFilter}
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
            <GlobalTodoView
              clients={clients}
              onUpdateClient={updateClient}
              onSelectClient={id => setSelectedId(id)}
            />
          ) : selectedClient ? (
            <DetailView
              client={selectedClient}
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
              termine={termine}
              onAddTermin={addTermin}
              onUpdateTermin={updateTermin}
              onDeleteTermin={deleteTermin}
            />
          ) : (
            <div className="detail-empty">
              <div className="detail-empty-icon">📂</div>
              <div className="detail-empty-text">Mandant auswählen</div>
              <div style={{fontSize:'12px', color:'var(--text-muted)', marginBottom: '16px'}}>
                Klicken Sie auf einen Mandanten in der linken Spalte
              </div>
              <button onClick={() => setSelectedId('__todo__')} style={{ padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                📋 Aufgaben-Übersicht öffnen
              </button>
            </div>
          )}
        </div>

        {/* Right column – Kalender */}
        <div className="col-calendar">
          <KalenderSection
            termine={termine}
            clients={clients}
            onAdd={addTermin}
            onUpdate={updateTermin}
            onDelete={deleteTermin}
            compact={true}
            prefillMandantId={selectedId}
          />
        </div>
      </div>

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
