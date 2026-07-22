import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../utils/supabaseClient.js'

/**
 * Bereich „Homepages" – zentrale Verwaltung aller Webseiten.
 *
 * Phase 1: Struktur + Anbindung der VORHANDENEN Verbindung.
 * Die einzige bestehende technische Kopplung ist der Eingang der
 * Website-Anfragen (Tabelle `website_anfragen`). Diese wird rein lesend
 * ausgewertet – Deployments und bestehende Abläufe bleiben unangetastet.
 *
 * Alle weiteren Bereiche (Design, Seiten, Beiträge, Medien, Veranstaltungen,
 * SEO, Statistiken, Einstellungen) sind als erweiterbare Struktur vorbereitet.
 */

const FARBE = '#3b82f6' // Farbwelt des Bereichs „Homepages"

// ── Webseiten ─────────────────────────────────────────────────────────────────
export const WEBSEITEN = [
  {
    key: 'etablering',
    name: 'Etablering-Tyskland',
    url: 'https://www.etablering-tyskland.com',
    beschreibung: 'Hauptauftritt für dänische Unternehmen mit Deutschland-Plänen.',
    aktiv: true,
    // Formulare, die auf dieser Seite tatsächlich existieren
    formulare: [
      { key: 'kontakt',    label: 'Kontaktformular',        pfad: '/kontakt' },
      { key: 'check',      label: 'Deutschland-Check',      pfad: '/check' },
      { key: 'ustreg',     label: 'USt-Registrierung DE',   pfad: '/formular/ust-registrierung-de' },
      { key: 'gruendung',  label: 'Gründung',               pfad: '/formular/gruendung' },
      { key: 'adresse',    label: 'Geschäftsadresse',       pfad: '/formular/geschaeftsadresse' },
      { key: 'vorrat',     label: 'Vorratsgesellschaft',    pfad: '/formular/vorratsgesellschaft' },
      { key: 'ideen',      label: 'Ideenbörse (Kooperation)', pfad: '/kooperationen' },
      { key: 'termin',     label: 'Terminanfrage',          pfad: '/termin' },
    ],
  },
  { key: 'hp2', name: 'Homepage 2', aktiv: false },
  { key: 'hp3', name: 'Homepage 3', aktiv: false },
  { key: 'hp4', name: 'Homepage 4', aktiv: false },
]

// ── Verwaltungsbereiche je Webseite ──────────────────────────────────────────
export const HP_BEREICHE = [
  { key: 'dashboard',      label: 'Dashboard',      icon: '📊', bereit: true },
  { key: 'design',         label: 'Design',         icon: '🎨',
    inhalt: ['Layout', 'Farben', 'Komponenten', 'Navigation', 'Seitenstruktur'] },
  { key: 'seiten',         label: 'Seiten',         icon: '📄',
    inhalt: ['Seitenbaum', 'Neue Seite anlegen', 'Landingpages', 'Entwürfe'] },
  { key: 'beitraege',      label: 'Beiträge',       icon: '✍️',
    inhalt: ['Blogbeiträge', 'News', 'Redaktionsplan', 'KI-Textentwürfe'] },
  { key: 'formulare',      label: 'Formulare',      icon: '📋', bereit: true },
  { key: 'medien',         label: 'Medien',         icon: '🖼',
    inhalt: ['Bilder', 'Dokumente', 'Videos', 'Alt-Texte pflegen'] },
  { key: 'veranstaltungen',label: 'Veranstaltungen',icon: '🎪',
    inhalt: ['Veranstaltungen anlegen', 'Veranstaltungsseiten', 'Online-Anmeldung',
             'Teilnehmerverwaltung', 'Wartelisten', 'Erinnerungen',
             'Bestätigungs-E-Mails', 'Teilnehmer-Export', 'Kalenderansicht'] },
  { key: 'seo',            label: 'SEO',            icon: '🔎',
    inhalt: ['Meta-Titel & Beschreibungen', 'Sitemap', 'Indexierung', 'Keywords'] },
  { key: 'statistiken',    label: 'Statistiken',    icon: '📈',
    inhalt: ['Besucher', 'Beliebte Seiten', 'Herkunft', 'Formular-Abschlussquote'] },
  { key: 'einstellungen',  label: 'Einstellungen',  icon: '⚙️',
    inhalt: ['Domain', 'Zugänge', 'Deployment', 'Rechtliches'] },
]

// Ordnet eine Anfrage einem Formular zu (rein lesend, tolerant)
function formularVon(anfrage) {
  const typ = (anfrage.formular_daten?.typ ?? '').toLowerCase()
  const int = (anfrage.interesse ?? '').toLowerCase()
  if (typ.includes('kooperation') || int.includes('kooperation')) return 'ideen'
  if (int.includes('deutschland-check') || typ.includes('check'))  return 'check'
  if (int.includes('umsatzsteuer') || typ.includes('ust'))         return 'ustreg'
  if (int.includes('gmbh') || int.includes('ug-') || typ.includes('gruendung')) return 'gruendung'
  if (int.includes('geschäftsadresse') || typ.includes('adresse')) return 'adresse'
  if (int.includes('vorratsgesellschaft') || typ.includes('vorrat')) return 'vorrat'
  if (typ.includes('termin') || int.includes('termin'))            return 'termin'
  return 'kontakt'
}

export default function HomepagesBereich({ onOeffneAnfragen }) {
  const [gewaehlt, setGewaehlt] = useState(null)   // key der Webseite
  const [bereich, setBereich]   = useState('dashboard')
  const [anfragen, setAnfragen] = useState(null)   // null = lädt
  const [fehler, setFehler]     = useState('')

  // Website-Anfragen rein lesend laden (bestehende Tabelle, nichts wird geschrieben)
  useEffect(() => {
    let abgebrochen = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('website_anfragen')
          .select('id,name,interesse,status,erstellt_am,formular_daten')
          .order('erstellt_am', { ascending: false })
        if (abgebrochen) return
        if (error) { setFehler(error.message); setAnfragen([]); return }
        setAnfragen(data ?? [])
      } catch (e) {
        if (!abgebrochen) { setFehler(e.message ?? 'Laden fehlgeschlagen'); setAnfragen([]) }
      }
    })()
    return () => { abgebrochen = true }
  }, [])

  const statistik = useMemo(() => {
    const a = anfragen ?? []
    const jetzt = Date.now()
    const proFormular = {}
    a.forEach(x => { const k = formularVon(x); proFormular[k] = (proFormular[k] ?? 0) + 1 })
    return {
      gesamt: a.length,
      neu: a.filter(x => (x.status ?? 'neu') === 'neu').length,
      letzte30: a.filter(x => x.erstellt_am && (jetzt - new Date(x.erstellt_am).getTime()) < 30 * 86400000).length,
      proFormular,
      neuesteAm: a[0]?.erstellt_am ?? null,
    }
  }, [anfragen])

  const seite = WEBSEITEN.find(w => w.key === gewaehlt) ?? null

  // ── Übersicht aller Webseiten ──────────────────────────────────────────────
  if (!seite) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '26px 26px 56px' }}>
          <nav aria-label="Pfad" style={{ display: 'flex', gap: '7px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '18px' }}>
            <span>Spielbuch</span><span style={{ opacity: 0.5 }}>›</span>
            <span style={{ color: FARBE, fontWeight: 700 }}>Homepages</span>
          </nav>

          <h2 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Webseiten
          </h2>
          <p style={{ margin: '0 0 26px', fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '620px' }}>
            Zentrale Verwaltung aller Auftritte – Inhalte, Formulare, Veranstaltungen
            und Auswertungen an einem Ort.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {WEBSEITEN.map(w => (
              <div
                key={w.key}
                onClick={() => w.aktiv && (setGewaehlt(w.key), setBereich('dashboard'))}
                style={{
                  padding: '20px', borderRadius: '13px',
                  background: 'var(--surface)',
                  border: `1px solid ${w.aktiv ? 'var(--border)' : 'var(--border)'}`,
                  cursor: w.aktiv ? 'pointer' : 'default',
                  opacity: w.aktiv ? 1 : 0.55,
                  transition: 'border-color 0.15s, transform 0.15s',
                }}
                onMouseEnter={e => { if (w.aktiv) { e.currentTarget.style.borderColor = FARBE + '66'; e.currentTarget.style.transform = 'translateY(-2px)' } }}
                onMouseLeave={e => { if (w.aktiv) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '12px' }}>
                  <span style={{
                    width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                    background: w.aktiv ? FARBE + '14' : 'var(--surface2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '19px',
                  }} aria-hidden="true">{w.aktiv ? '🌐' : '➕'}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>{w.name}</div>
                    {w.url && (
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {w.url.replace('https://', '')}
                      </div>
                    )}
                  </div>
                  {w.aktiv && (
                    <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: 'rgba(22,163,74,0.12)', color: '#16a34a', whiteSpace: 'nowrap' }}>
                      ● Live
                    </span>
                  )}
                </div>

                {w.aktiv ? (
                  <>
                    <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {w.beschreibung}
                    </p>
                    <div style={{ display: 'flex', gap: '18px', paddingTop: '13px', borderTop: '1px solid var(--border)' }}>
                      <span>
                        <span style={{ display: 'block', fontSize: '19px', fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>
                          {anfragen === null ? '…' : statistik.gesamt}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Anfragen</span>
                      </span>
                      <span>
                        <span style={{ display: 'block', fontSize: '19px', fontWeight: 800, color: statistik.neu > 0 ? '#f97316' : 'var(--text-muted)', lineHeight: 1.2 }}>
                          {anfragen === null ? '…' : statistik.neu}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>neu</span>
                      </span>
                      <span>
                        <span style={{ display: 'block', fontSize: '19px', fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>
                          {w.formulare?.length ?? 0}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Formulare</span>
                      </span>
                    </div>
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Platzhalter – Bezeichnung und Anbindung folgen später.
                  </p>
                )}
              </div>
            ))}
          </div>

          {fehler && (
            <div style={{ marginTop: '18px', fontSize: '12px', color: '#dc2626' }}>
              Anfragen konnten nicht geladen werden: {fehler}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Verwaltung einer Webseite ──────────────────────────────────────────────
  const aktBereich = HP_BEREICHE.find(b => b.key === bereich) ?? HP_BEREICHE[0]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Kopf */}
      <div style={{ padding: '13px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <nav aria-label="Pfad" style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span>Spielbuch</span><span style={{ opacity: 0.5 }}>›</span>
          <button onClick={() => setGewaehlt(null)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: FARBE, fontWeight: 700, fontSize: '12px' }}>
            Homepages
          </button>
          <span style={{ opacity: 0.5 }}>›</span>
          <span style={{ color: 'var(--text)', fontWeight: 700 }}>{seite.name}</span>
          {seite.url && (
            <a href={seite.url} target="_blank" rel="noreferrer"
              style={{ marginLeft: '8px', fontSize: '11.5px', color: FARBE, textDecoration: 'none' }}>
              Seite öffnen ↗
            </a>
          )}
          <button onClick={() => setGewaehlt(null)}
            style={{ marginLeft: 'auto', padding: '4px 11px', borderRadius: '7px', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-muted)', fontSize: '11.5px', fontWeight: 600 }}>
            ← Alle Webseiten
          </button>
        </nav>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Bereichsnavigation */}
        <nav aria-label="Webseiten-Bereiche" style={{
          width: '212px', flexShrink: 0, borderRight: '1px solid var(--border)',
          background: 'var(--surface)', padding: '14px 10px', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: '2px',
        }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0 10px 8px' }}>
            {seite.name}
          </div>
          {HP_BEREICHE.map(b => {
            const ist = bereich === b.key
            return (
              <button key={b.key} onClick={() => setBereich(b.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 12px',
                  border: 'none', borderRadius: '9px', cursor: 'pointer', textAlign: 'left', width: '100%',
                  background: ist ? FARBE + '14' : 'transparent',
                  color: ist ? FARBE : 'var(--text-muted)',
                  fontWeight: ist ? 700 : 500, fontSize: '13px',
                  transition: 'background 0.16s, color 0.16s',
                }}
                onMouseEnter={e => { if (!ist) { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' } }}
                onMouseLeave={e => { if (!ist) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' } }}
              >
                <span style={{ width: '18px', textAlign: 'center' }} aria-hidden="true">{b.icon}</span>
                <span style={{ flex: 1 }}>{b.label}</span>
                {!b.bereit && <span style={{ fontSize: '9.5px', opacity: 0.7 }}>bald</span>}
              </button>
            )
          })}
        </nav>

        {/* Inhalt */}
        <div style={{ flex: 1, overflowY: 'auto', minWidth: 0, padding: '26px 28px 56px' }}>

          {/* Dashboard */}
          {bereich === 'dashboard' && (
            <>
              <h3 style={{ margin: '0 0 18px', fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>Dashboard</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '13px', marginBottom: '26px' }}>
                <Kachel titel="Anfragen gesamt" wert={anfragen === null ? '…' : statistik.gesamt} farbe={FARBE} icon="📨" />
                <Kachel titel="Davon neu" wert={anfragen === null ? '…' : statistik.neu} farbe="#f97316" icon="🔔" />
                <Kachel titel="Letzte 30 Tage" wert={anfragen === null ? '…' : statistik.letzte30} farbe="#16a34a" icon="📈" />
                <Kachel titel="Formulare" wert={seite.formulare?.length ?? 0} farbe="#7c3aed" icon="📋" />
              </div>

              {onOeffneAnfragen && (
                <button onClick={onOeffneAnfragen}
                  style={{ padding: '10px 16px', borderRadius: '9px', border: 'none', cursor: 'pointer', background: FARBE, color: '#fff', fontSize: '13px', fontWeight: 700, marginBottom: '26px' }}>
                  Alle Website-Anfragen ansehen →
                </button>
              )}

              <div style={{ padding: '15px 17px', borderRadius: '11px', background: 'var(--surface)', border: '1px solid var(--border)', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '640px' }}>
                <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '5px' }}>Bestehende Verbindung</strong>
                Formularabsendungen dieser Seite laufen unverändert über die vorhandene
                Schnittstelle in dein Spielbuch. Veröffentlichung und Design der Seite
                erfolgen weiterhin über den bestehenden Ablauf – hier wird nichts umgestellt.
              </div>
            </>
          )}

          {/* Formulare – echte Formulare der Seite mit echten Zahlen */}
          {bereich === 'formulare' && (
            <>
              <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>Formulare</h3>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '620px' }}>
                Alle Formulare dieser Webseite. Die Zahlen stammen aus den tatsächlich
                eingegangenen Anfragen.
              </p>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                {(seite.formulare ?? []).map((f, i) => (
                  <div key={f.key} style={{
                    display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: '17px' }} aria-hidden="true">📋</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 700, fontSize: '13.5px', color: 'var(--text)' }}>{f.label}</span>
                      <code style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{f.pfad}</code>
                    </span>
                    <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'block', fontSize: '17px', fontWeight: 800, color: (statistik.proFormular[f.key] ?? 0) > 0 ? 'var(--text)' : 'var(--text-muted)', lineHeight: 1.2 }}>
                        {anfragen === null ? '…' : (statistik.proFormular[f.key] ?? 0)}
                      </span>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Anfragen</span>
                    </span>
                    {seite.url && (
                      <a href={seite.url + f.pfad} target="_blank" rel="noreferrer"
                        title="Formular auf der Website öffnen"
                        style={{ fontSize: '12px', color: FARBE, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        öffnen ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
              <p style={{ marginTop: '14px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Weitere Formulare lassen sich später ergänzen – Newsletter und
                Veranstaltungsanmeldung sind bereits vorgesehen.
              </p>
            </>
          )}

          {/* Alle übrigen Bereiche: vorbereitete Struktur */}
          {bereich !== 'dashboard' && bereich !== 'formulare' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '10px' }}>
                <span style={{ fontSize: '24px' }} aria-hidden="true">{aktBereich.icon}</span>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>{aktBereich.label}</h3>
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: FARBE + '18', color: FARBE }}>
                  vorbereitet
                </span>
              </div>
              <p style={{ margin: '0 0 22px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '620px' }}>
                Dieser Bereich ist angelegt. Vorgesehen sind:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '11px', maxWidth: '820px' }}>
                {(aktBereich.inhalt ?? []).map(p => (
                  <div key={p} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '13px 15px', borderRadius: '10px',
                    background: 'var(--surface)', border: '1px dashed var(--border)',
                    fontSize: '12.5px', color: 'var(--text-muted)',
                  }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: FARBE, flexShrink: 0 }} />
                    {p}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Kachel({ titel, wert, farbe, icon }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '13px',
      padding: '15px 17px', borderRadius: '12px',
      background: 'var(--surface)', border: '1px solid var(--border)',
    }}>
      <span style={{
        width: '38px', height: '38px', flexShrink: 0, borderRadius: '10px',
        background: farbe + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px',
      }} aria-hidden="true">{icon}</span>
      <span>
        <span style={{ display: 'block', fontSize: '22px', fontWeight: 800, color: 'var(--text)', lineHeight: 1.15 }}>{wert}</span>
        <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{titel}</span>
      </span>
    </div>
  )
}
