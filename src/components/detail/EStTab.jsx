import { useState, useCallback } from 'react'

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function genId() { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }

function fmtDatum(iso) {
  if (!iso) return ''
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
}

// ── Relevanz-Konfiguration ────────────────────────────────────────────────────
const RELEVANZ = {
  offen:           { label: 'Offen',          color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.3)'  },
  relevant:        { label: 'Relevant',        color: '#2563eb', bg: 'rgba(37,99,235,0.1)',    border: 'rgba(37,99,235,0.3)'    },
  nicht_relevant:  { label: 'Nicht relevant',  color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)'  },
}

// ── Relevanz-Toggle ───────────────────────────────────────────────────────────
function RelevanzToggle({ value = 'offen', onChange }) {
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {Object.entries(RELEVANZ).map(([key, cfg]) => (
        <button key={key} onClick={e => { e.stopPropagation(); onChange(key) }} style={{
          padding: '2px 9px', borderRadius: '10px', fontSize: '11px', fontWeight: value === key ? 700 : 400,
          border: `1px solid ${value === key ? cfg.color : 'var(--border)'}`,
          background: value === key ? cfg.bg : 'transparent',
          color: value === key ? cfg.color : 'var(--text-muted)',
          cursor: 'pointer', transition: 'all 0.12s',
        }}>
          {cfg.label}
        </button>
      ))}
    </div>
  )
}

// ── Block-Container ───────────────────────────────────────────────────────────
function Block({ title, icon, relevanz, onRelevanz, summary, children, defaultOpen = false, badge }) {
  const [open, setOpen] = useState(defaultOpen)
  const cfg = RELEVANZ[relevanz ?? 'offen']

  return (
    <div style={{ border: `1px solid ${relevanz === 'relevant' ? 'rgba(37,99,235,0.25)' : 'var(--border)'}`, borderRadius: '10px', overflow: 'hidden', marginBottom: '8px' }}>
      {/* Block-Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ padding: '9px 14px', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: open ? '1px solid var(--border)' : 'none', userSelect: 'none' }}
      >
        <span style={{ fontSize: '16px', flexShrink: 0 }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>{title}</span>
        {badge && (
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '1px 8px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', flexShrink: 0 }}>
            {badge}
          </span>
        )}
        {summary && !open && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
        )}
        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '10px', background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, flexShrink: 0 }}>
          {cfg.label}
        </span>
        <RelevanzToggle value={relevanz} onChange={onRelevanz} />
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '2px' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ background: 'var(--surface2)', padding: '14px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Notizfeld ─────────────────────────────────────────────────────────────────
function Notizfeld({ value, onChange, placeholder = 'Notizen…' }) {
  return (
    <textarea
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', resize: 'vertical', boxSizing: 'border-box', marginTop: '8px' }}
    />
  )
}

// ── Checkbox-Zeile ─────────────────────────────────────────────────────────────
function CheckRow({ label, checked, onChange, warn, children }) {
  return (
    <div style={{ marginBottom: '4px' }}>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', padding: '4px 6px', borderRadius: '5px', background: checked && warn ? 'rgba(249,115,22,0.05)' : 'transparent' }}>
        <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)}
          style={{ marginTop: '2px', accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }} />
        <span style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.4 }}>
          {label}
          {warn && checked && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#f97316', fontWeight: 700 }}>⚠ prüfen</span>}
        </span>
      </label>
      {checked && children && <div style={{ paddingLeft: '24px', marginTop: '2px' }}>{children}</div>}
    </div>
  )
}

// ── Eingabefeld ───────────────────────────────────────────────────────────────
function Feld({ label, value, onChange, type = 'text', placeholder = '', small }) {
  return (
    <div style={{ marginBottom: small ? '4px' : '8px' }}>
      {label && <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>{label}</label>}
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '5px 9px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', boxSizing: 'border-box' }}
      />
    </div>
  )
}

// ── Rückfragen-Button ──────────────────────────────────────────────────────────
function RQButton({ text, onAdd }) {
  const [done, setDone] = useState(false)
  function handle() {
    onAdd(text)
    setDone(true)
    setTimeout(() => setDone(false), 2000)
  }
  return (
    <button onClick={handle} style={{
      padding: '2px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer',
      border: '1px solid rgba(37,99,235,0.3)', background: done ? 'rgba(37,99,235,0.1)' : 'transparent',
      color: done ? '#2563eb' : 'var(--text-muted)', marginLeft: '6px',
    }}>
      {done ? '✓ Als RQ markiert' : '❓ Als RQ'}
    </button>
  )
}

// ── Abschnitt-Trenner ──────────────────────────────────────────────────────────
function Trenner({ label }) {
  return (
    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '10px 0 6px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
      {label}
    </div>
  )
}

// ── 2-spaltig Layout ──────────────────────────────────────────────────────────
function Grid2({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>{children}</div>
}

// ═══════════════════════ BLÖCKE ════════════════════════════════════════════════

// Block 1: Stammdaten / Mantelbogen
function BlockStammdaten({ daten = {}, onChange, onRQ }) {
  const s = v => onChange({ ...daten, ...v })
  const KIRCHEN = ['keine', 'ev', 'rk', 'andere']

  return (
    <div>
      <Trenner label="Allgemein" />
      <Grid2>
        <CheckRow label="Adresse geprüft / aktuell" checked={daten.adresse} onChange={v => s({ adresse: v })} />
        <CheckRow label="Bankverbindung vorhanden" checked={daten.bank} onChange={v => s({ bank: v })} />
        <CheckRow label="Identifizierung (GwG)" checked={daten.gwg} onChange={v => s({ gwg: v })} />
      </Grid2>

      <Trenner label="Kirchensteuer" />
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
        {['keine', 'ev', 'rk', 'andere'].map(k => (
          <button key={k} onClick={() => s({ kirche: k })} style={{
            padding: '3px 10px', borderRadius: '10px', fontSize: '12px', cursor: 'pointer',
            border: `1px solid ${daten.kirche === k ? 'var(--accent)' : 'var(--border)'}`,
            background: daten.kirche === k ? 'rgba(37,99,235,0.1)' : 'transparent',
            color: daten.kirche === k ? 'var(--accent)' : 'var(--text-muted)',
          }}>
            {k === 'keine' ? 'Keine' : k === 'ev' ? 'Evangelisch' : k === 'rk' ? 'Römisch-Kath.' : 'Andere'}
          </button>
        ))}
      </div>

      <Trenner label="Besondere Ereignisse" />
      <Grid2>
        <CheckRow label="Heirat im Jahr" checked={daten.heirat} onChange={v => s({ heirat: v })} warn>
          {daten.heirat && <Feld label="Datum" type="date" value={daten.heiratDatum} onChange={v => s({ heiratDatum: v })} small />}
        </CheckRow>
        <CheckRow label="Scheidung im Jahr" checked={daten.scheidung} onChange={v => s({ scheidung: v })} warn />
        <CheckRow label="Todesfall" checked={daten.tod} onChange={v => s({ tod: v })} warn />
        <CheckRow label="Umzug" checked={daten.umzug} onChange={v => s({ umzug: v })} />
      </Grid2>

      <Trenner label="Lohnersatzleistungen" />
      <Grid2>
        <CheckRow label="Arbeitslosengeld" checked={daten.alg} onChange={v => s({ alg: v })} warn />
        <CheckRow label="Kurzarbeitergeld" checked={daten.kug} onChange={v => s({ kug: v })} warn />
        <CheckRow label="Krankengeld" checked={daten.krankengeld} onChange={v => s({ krankengeld: v })} warn />
        <CheckRow label="Elterngeld" checked={daten.elterngeld} onChange={v => s({ elterngeld: v })} warn />
        <CheckRow label="Mutterschaftsgeld" checked={daten.mutterschaft} onChange={v => s({ mutterschaft: v })} warn />
      </Grid2>

      <Notizfeld value={daten.notiz} onChange={v => s({ notiz: v })} />
    </div>
  )
}

// Block 2: Kinder
function KindCard({ kind, onChange, onDelete, onRQ }) {
  const s = v => onChange({ ...kind, ...v })
  const STATUS18 = ['Ausbildung', 'Studium', 'FSJ/BFD', 'Übergangszeit', 'Abgeschlossen']

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', marginBottom: '8px', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{ fontSize: '16px' }}>👶</span>
        <Grid2>
          <Feld label="Name" value={kind.name} onChange={v => s({ name: v })} placeholder="Vorname" />
          <Feld label="Geburtsdatum" type="date" value={kind.geb} onChange={v => s({ geb: v })} />
        </Grid2>
        <button onClick={onDelete} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}>🗑</button>
      </div>

      {kind.geb && new Date().getFullYear() - new Date(kind.geb).getFullYear() >= 18 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Status ab 18:</div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {STATUS18.map(s18 => (
              <button key={s18} onClick={() => s({ status18: s18 })} style={{
                padding: '2px 9px', borderRadius: '10px', fontSize: '11px', cursor: 'pointer',
                border: `1px solid ${kind.status18 === s18 ? 'var(--accent)' : 'var(--border)'}`,
                background: kind.status18 === s18 ? 'rgba(37,99,235,0.1)' : 'transparent',
                color: kind.status18 === s18 ? 'var(--accent)' : 'var(--text-muted)',
              }}>{s18}</button>
            ))}
          </div>
        </div>
      )}

      <Grid2>
        <CheckRow label="Behinderung" checked={kind.behinderung} onChange={v => s({ behinderung: v })} warn>
          <Feld label="GdB" value={kind.gdb} onChange={v => s({ gdb: v })} placeholder="z.B. 50" small />
        </CheckRow>
        <CheckRow label="Eigene Einkünfte > 624 €" checked={kind.eigeneEinkuenfte} onChange={v => s({ eigeneEinkuenfte: v })} warn />
        <CheckRow label="Kinderbetreuungskosten" checked={kind.betreuung} onChange={v => s({ betreuung: v })} >
          <Feld label="Betrag €" type="number" value={kind.betreuungBetrag} onChange={v => s({ betreuungBetrag: v })} small />
        </CheckRow>
        <CheckRow label="Schulgeld §10 Abs.1 Nr.9" checked={kind.schulgeld} onChange={v => s({ schulgeld: v })} >
          <Feld label="Betrag €" type="number" value={kind.schulgeldBetrag} onChange={v => s({ schulgeldBetrag: v })} small />
        </CheckRow>
      </Grid2>
      <Notizfeld value={kind.notiz} onChange={v => s({ notiz: v })} placeholder="Notizen zu diesem Kind…" />
    </div>
  )
}

function BlockKinder({ daten = {}, onChange, onRQ }) {
  const kinder = daten.liste ?? []
  const s = v => onChange({ ...daten, ...v })

  function addKind() {
    s({ liste: [...kinder, { id: genId(), name: '', geb: '' }] })
  }
  function updateKind(id, val) {
    s({ liste: kinder.map(k => k.id === id ? val : k) })
  }
  function deleteKind(id) {
    s({ liste: kinder.filter(k => k.id !== id) })
  }

  return (
    <div>
      {kinder.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '12px 0' }}>Noch keine Kinder erfasst.</div>
      )}
      {kinder.map(k => (
        <KindCard key={k.id} kind={k} onChange={val => updateKind(k.id, val)} onDelete={() => deleteKind(k.id)} onRQ={onRQ} />
      ))}
      <button className="btn btn-ghost btn-sm" onClick={addKind} style={{ fontSize: '12px', marginBottom: '8px' }}>
        ➕ Kind hinzufügen
      </button>
      <CheckRow label="Entlastungsbetrag Alleinerziehende prüfen §24b" checked={daten.alleinerziehend} onChange={v => s({ alleinerziehend: v })} warn />
      <Notizfeld value={daten.notiz} onChange={v => s({ notiz: v })} />
    </div>
  )
}

// Block 3: Sonderausgaben
function BlockSonderausgaben({ daten = {}, onChange, onRQ }) {
  const s = v => onChange({ ...daten, ...v })
  return (
    <div>
      <Trenner label="Versicherungen" />
      <Grid2>
        <CheckRow label="Kranken- und Pflegeversicherung" checked={daten.kvPv} onChange={v => s({ kvPv: v })} />
        <CheckRow label="Weitere Vorsorgeaufwendungen" checked={daten.weitereVorsorge} onChange={v => s({ weitereVorsorge: v })} />
        <CheckRow label="Riester / Rürup" checked={daten.riester} onChange={v => s({ riester: v })} />
      </Grid2>
      <Trenner label="Spenden / Kirchensteuer" />
      <Grid2>
        <CheckRow label="Spenden vorhanden" checked={daten.spenden} onChange={v => s({ spenden: v })} >
          <Feld label="Betrag €" type="number" value={daten.spendenBetrag} onChange={v => s({ spendenBetrag: v })} small />
        </CheckRow>
        <CheckRow label="Kirchensteuer" checked={daten.kirchensteuer} onChange={v => s({ kirchensteuer: v })} />
        <CheckRow label="Mitgliedsbeiträge" checked={daten.mitgliedsbeitraege} onChange={v => s({ mitgliedsbeitraege: v })} />
      </Grid2>
      <Trenner label="Ausbildung / Unterhalt" />
      <Grid2>
        <CheckRow label="Berufsausbildungskosten" checked={daten.ausbildung} onChange={v => s({ ausbildung: v })} />
        <CheckRow label="Unterhalt an geschiedenen Partner" checked={daten.realsplitting} onChange={v => s({ realsplitting: v })} warn />
      </Grid2>
      <Notizfeld value={daten.notiz} onChange={v => s({ notiz: v })} />
    </div>
  )
}

// Block 4: Außergewöhnliche Belastungen
function BlockAGB({ daten = {}, onChange, onRQ }) {
  const s = v => onChange({ ...daten, ...v })
  return (
    <div>
      <Grid2>
        <CheckRow label="Behinderung §33b" checked={daten.behinderung} onChange={v => s({ behinderung: v })} warn>
          <Feld label="GdB (z.B. 50)" value={daten.gdb} onChange={v => s({ gdb: v })} placeholder="Grad der Behinderung" small />
          <CheckRow label="Merkzeichen H / Bl / aG" checked={daten.merkzeichen} onChange={v => s({ merkzeichen: v })} />
        </CheckRow>
        <CheckRow label="Krankheitskosten §33" checked={daten.krankheit} onChange={v => s({ krankheit: v })} warn>
          <Feld label="Betrag €" type="number" value={daten.krankheitBetrag} onChange={v => s({ krankheitBetrag: v })} small />
        </CheckRow>
        <CheckRow label="Pflegekosten §33" checked={daten.pflege} onChange={v => s({ pflege: v })} warn />
        <CheckRow label="Beerdigungskosten" checked={daten.beerdigung} onChange={v => s({ beerdigung: v })} warn />
        <CheckRow label="Unterhalt §33a" checked={daten.unterhalt} onChange={v => s({ unterhalt: v })} warn>
          <Feld label="Empfänger" value={daten.unterhaltEmpfaenger} onChange={v => s({ unterhaltEmpfaenger: v })} small />
        </CheckRow>
        <CheckRow label="Heimkosten" checked={daten.heim} onChange={v => s({ heim: v })} warn />
      </Grid2>
      <Notizfeld value={daten.notiz} onChange={v => s({ notiz: v })} />
    </div>
  )
}

// Block 5: §35a
function Par35aCard({ eintrag, onChange, onDelete }) {
  const s = v => onChange({ ...eintrag, ...v })
  const ARTEN = ['Handwerkerleistung', 'Haushaltsnahe Dienstleistung', 'Minijobbeschäftigung', 'Pflege/Betreuung']
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', marginBottom: '8px', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {ARTEN.map(a => (
          <button key={a} onClick={() => s({ art: a })} style={{
            padding: '2px 9px', borderRadius: '10px', fontSize: '11px', cursor: 'pointer',
            border: `1px solid ${eintrag.art === a ? 'var(--accent)' : 'var(--border)'}`,
            background: eintrag.art === a ? 'rgba(37,99,235,0.1)' : 'transparent',
            color: eintrag.art === a ? 'var(--accent)' : 'var(--text-muted)',
          }}>{a}</button>
        ))}
        <button onClick={onDelete} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer' }}>🗑</button>
      </div>
      <Grid2>
        <Feld label="Anbieter / Firma" value={eintrag.anbieter} onChange={v => s({ anbieter: v })} />
        <Feld label="Gesamtbetrag €" type="number" value={eintrag.betrag} onChange={v => s({ betrag: v })} />
        <Feld label="davon Lohnanteil €" type="number" value={eintrag.lohnanteil} onChange={v => s({ lohnanteil: v })} />
      </Grid2>
      <CheckRow label="Zahlung unbar (Überweisung / Lastschrift)" checked={eintrag.unbar} onChange={v => s({ unbar: v })} />
      {!eintrag.unbar && eintrag.unbar !== undefined && (
        <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px', paddingLeft: '24px' }}>⚠ Barzahlung nicht begünstigt!</div>
      )}
      <Notizfeld value={eintrag.notiz} onChange={v => s({ notiz: v })} placeholder="Notiz zu dieser Leistung…" />
    </div>
  )
}

function BlockPar35a({ daten = {}, onChange, onRQ }) {
  const liste = daten.liste ?? []
  const s = v => onChange({ ...daten, ...v })
  return (
    <div>
      {liste.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '10px 0' }}>Noch keine Einträge.</div>
      )}
      {liste.map(e => (
        <Par35aCard key={e.id} eintrag={e}
          onChange={val => s({ liste: liste.map(x => x.id === e.id ? val : x) })}
          onDelete={() => s({ liste: liste.filter(x => x.id !== e.id) })}
        />
      ))}
      <button className="btn btn-ghost btn-sm" onClick={() => s({ liste: [...liste, { id: genId() }] })} style={{ fontSize: '12px', marginBottom: '8px' }}>
        ➕ Leistung hinzufügen
      </button>
      <Notizfeld value={daten.notiz} onChange={v => s({ notiz: v })} />
    </div>
  )
}

// Block 6: Anlage N
function AnlageNCard({ ag, onChange, onDelete }) {
  const s = v => onChange({ ...ag, ...v })
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', marginBottom: '8px', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px' }}>👔</span>
        <Feld label="Arbeitgeber" value={ag.arbeitgeber} onChange={v => s({ arbeitgeber: v })} placeholder="Firmenname" />
        <div style={{ minWidth: '100px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Steuerkl.</div>
          <div style={{ display: 'flex', gap: '3px' }}>
            {[1,2,3,4,5,6].map(k => (
              <button key={k} onClick={() => s({ steuerkl: k })} style={{
                width: '24px', height: '24px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer',
                border: `1px solid ${ag.steuerkl === k ? 'var(--accent)' : 'var(--border)'}`,
                background: ag.steuerkl === k ? 'rgba(37,99,235,0.15)' : 'transparent',
                color: ag.steuerkl === k ? 'var(--accent)' : 'var(--text-muted)', fontWeight: ag.steuerkl === k ? 700 : 400,
              }}>{k}</button>
            ))}
          </div>
        </div>
        <button onClick={onDelete} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', marginLeft: 'auto' }}>🗑</button>
      </div>

      <CheckRow label="Lohnersatzleistungen (Anlage N-AUS)" checked={ag.lohnersatz} onChange={v => s({ lohnersatz: v })} warn />

      <Trenner label="Werbungskosten" />
      <Grid2>
        <CheckRow label="Entfernungspauschale" checked={ag.entfernung} onChange={v => s({ entfernung: v })} >
          <Feld label="km einfach" type="number" value={ag.km} onChange={v => s({ km: v })} small />
          <Feld label="Tage/Jahr" type="number" value={ag.tage} onChange={v => s({ tage: v })} small />
        </CheckRow>
        <CheckRow label="Dienstreisen / Reisekosten" checked={ag.dienstreisen} onChange={v => s({ dienstreisen: v })} >
          <Feld label="Betrag €" type="number" value={ag.dienstreisenBetrag} onChange={v => s({ dienstreisenBetrag: v })} small />
        </CheckRow>
        <CheckRow label="Arbeitsmittel" checked={ag.arbeitsmittel} onChange={v => s({ arbeitsmittel: v })} >
          <Feld label="Betrag €" type="number" value={ag.arbeitsmittelBetrag} onChange={v => s({ arbeitsmittelBetrag: v })} small />
        </CheckRow>
        <CheckRow label="Fortbildungskosten" checked={ag.fortbildung} onChange={v => s({ fortbildung: v })} >
          <Feld label="Betrag €" type="number" value={ag.fortbildungBetrag} onChange={v => s({ fortbildungBetrag: v })} small />
        </CheckRow>
        <CheckRow label="Gewerkschaft / Berufsverband" checked={ag.verband} onChange={v => s({ verband: v })} />
        <CheckRow label="Typische Berufskleidung" checked={ag.kleidung} onChange={v => s({ kleidung: v })} />
        <CheckRow label="Homeoffice-Pauschale" checked={ag.homeoffice} onChange={v => s({ homeoffice: v })} >
          <Feld label="Tage" type="number" value={ag.hometage} onChange={v => s({ hometage: v })} small />
        </CheckRow>
      </Grid2>
      <Notizfeld value={ag.notiz} onChange={v => s({ notiz: v })} placeholder="Notizen zu diesem Arbeitsverhältnis…" />
    </div>
  )
}

function BlockAnlageN({ daten = {}, onChange, onRQ }) {
  const liste = daten.liste ?? []
  const s = v => onChange({ ...daten, ...v })
  return (
    <div>
      {liste.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '10px 0' }}>Noch kein Arbeitsverhältnis erfasst.</div>
      )}
      {liste.map(ag => (
        <AnlageNCard key={ag.id} ag={ag}
          onChange={val => s({ liste: liste.map(x => x.id === ag.id ? val : x) })}
          onDelete={() => s({ liste: liste.filter(x => x.id !== ag.id) })}
        />
      ))}
      <button className="btn btn-ghost btn-sm" onClick={() => s({ liste: [...liste, { id: genId() }] })} style={{ fontSize: '12px', marginBottom: '8px' }}>
        ➕ Arbeitsverhältnis hinzufügen
      </button>
      <Notizfeld value={daten.notiz} onChange={v => s({ notiz: v })} />
    </div>
  )
}

// Block 7: Anlage KAP
function BlockAnlageKap({ daten = {}, onChange, onRQ }) {
  const s = v => onChange({ ...daten, ...v })
  return (
    <div>
      <Grid2>
        <CheckRow label="Steuerbescheinigungen vorhanden" checked={daten.bescheinigungen} onChange={v => s({ bescheinigungen: v })} />
        <CheckRow label="Günstigerprüfung prüfen" checked={daten.guenstiger} onChange={v => s({ guenstiger: v })} warn />
        <CheckRow label="Auslandsdepot / -konto" checked={daten.ausland} onChange={v => s({ ausland: v })} warn>
          <Feld label="Land / Institut" value={daten.auslandInst} onChange={v => s({ auslandInst: v })} small />
        </CheckRow>
        <CheckRow label="Kryptowährungen" checked={daten.krypto} onChange={v => s({ krypto: v })} warn />
        <CheckRow label="Verlustverrechnungstopf" checked={daten.verlust} onChange={v => s({ verlust: v })} />
        <CheckRow label="Kirchensteuer auf Kapitalerträge" checked={daten.kircheKap} onChange={v => s({ kircheKap: v })} />
      </Grid2>
      <Notizfeld value={daten.notiz} onChange={v => s({ notiz: v })} />
    </div>
  )
}

// Block 8: Anlage V
function AnlageVCard({ objekt, onChange, onDelete }) {
  const s = v => onChange({ ...objekt, ...v })
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', marginBottom: '8px', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px' }}>🏘</span>
        <Feld label="Objekt / Adresse" value={objekt.adresse} onChange={v => s({ adresse: v })} placeholder="z.B. Musterstr. 1, 12345 Stadt" />
        <button onClick={onDelete} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', marginLeft: 'auto' }}>🗑</button>
      </div>
      <Grid2>
        <Feld label="Mieteinnahmen €" type="number" value={objekt.einnahmen} onChange={v => s({ einnahmen: v })} />
        <Feld label="Werbungskosten gesamt €" type="number" value={objekt.werbungskosten} onChange={v => s({ werbungskosten: v })} />
      </Grid2>
      <Grid2>
        <CheckRow label="Verwalterabrechnung vorhanden" checked={objekt.verwalter} onChange={v => s({ verwalter: v })} />
        <CheckRow label="Darlehen vorhanden" checked={objekt.darlehen} onChange={v => s({ darlehen: v })} />
        <CheckRow label="Denkmalschutz §7i/7h" checked={objekt.denkmal} onChange={v => s({ denkmal: v })} warn />
        <CheckRow label="Ferienwohnung" checked={objekt.ferienwohnung} onChange={v => s({ ferienwohnung: v })} warn />
      </Grid2>
      <Notizfeld value={objekt.notiz} onChange={v => s({ notiz: v })} placeholder="Besonderheiten zu diesem Objekt…" />
    </div>
  )
}

function BlockAnlageV({ daten = {}, onChange, onRQ }) {
  const liste = daten.liste ?? []
  const s = v => onChange({ ...daten, ...v })
  return (
    <div>
      {liste.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '10px 0' }}>Noch kein Objekt erfasst.</div>
      )}
      {liste.map(o => (
        <AnlageVCard key={o.id} objekt={o}
          onChange={val => s({ liste: liste.map(x => x.id === o.id ? val : x) })}
          onDelete={() => s({ liste: liste.filter(x => x.id !== o.id) })}
        />
      ))}
      <button className="btn btn-ghost btn-sm" onClick={() => s({ liste: [...liste, { id: genId() }] })} style={{ fontSize: '12px', marginBottom: '8px' }}>
        ➕ Objekt hinzufügen
      </button>
    </div>
  )
}

// Block 9: Anlage R
function BlockAnlageR({ daten = {}, onChange, onRQ }) {
  const s = v => onChange({ ...daten, ...v })
  return (
    <div>
      <Grid2>
        <CheckRow label="Rentenbezugsmitteilungen vorhanden" checked={daten.mitteilungen} onChange={v => s({ mitteilungen: v })} />
        <CheckRow label="Rentenbeginn im laufenden Jahr" checked={daten.rentenbeginn} onChange={v => s({ rentenbeginn: v })} warn>
          <Feld label="Datum" type="date" value={daten.rentenbeginnDatum} onChange={v => s({ rentenbeginnDatum: v })} small />
        </CheckRow>
        <CheckRow label="Ausländische Rente" checked={daten.auslaendisch} onChange={v => s({ auslaendisch: v })} warn>
          <Feld label="Land" value={daten.auslandLand} onChange={v => s({ auslandLand: v })} small />
        </CheckRow>
        <CheckRow label="DBA prüfen" checked={daten.dba} onChange={v => s({ dba: v })} warn />
        <CheckRow label="Witwen-/Waisenrente" checked={daten.hinterbliebenen} onChange={v => s({ hinterbliebenen: v })} />
        <CheckRow label="Versorgungsbezüge (Beamte)" checked={daten.versorgung} onChange={v => s({ versorgung: v })} />
      </Grid2>
      <Notizfeld value={daten.notiz} onChange={v => s({ notiz: v })} />
    </div>
  )
}

// Block 10: Sonstige Einkünfte
function BlockSonstige({ daten = {}, onChange, onRQ }) {
  const s = v => onChange({ ...daten, ...v })
  return (
    <div>
      <Grid2>
        <CheckRow label="Private Veräußerungsgeschäfte §23" checked={daten.veraeusse} onChange={v => s({ veraeusse: v })} warn>
          <Feld label="Gegenstand" value={daten.veraeusse_was} onChange={v => s({ veraeusse_was: v })} small />
        </CheckRow>
        <CheckRow label="Kryptowährungen Veräußerung" checked={daten.krypto} onChange={v => s({ krypto: v })} warn />
        <CheckRow label="Wiederkehrende Bezüge §22 Nr.1" checked={daten.wiederkehrend} onChange={v => s({ wiederkehrend: v })} />
        <CheckRow label="Leistungen §22 Nr.3" checked={daten.leistungen} onChange={v => s({ leistungen: v })} />
        <CheckRow label="Unterhaltsleistungen (Empfänger)" checked={daten.unterhaltEmpf} onChange={v => s({ unterhaltEmpf: v })} />
        <CheckRow label="Abgeordnetenbezüge / Ehrenamt" checked={daten.ehrenamt} onChange={v => s({ ehrenamt: v })} />
      </Grid2>
      <Notizfeld value={daten.notiz} onChange={v => s({ notiz: v })} />
    </div>
  )
}

// ═══════════════════════ HAUPTKOMPONENTE ══════════════════════════════════════

export default function EStTab({ client, onUpdate, onAddRueckfrage }) {
  const est = client.est ?? {}

  function updateEst(patch) {
    onUpdate({ est: { ...est, ...patch } })
  }

  function updateBlock(blockKey, val) {
    updateEst({ [blockKey]: val })
  }

  function setRelevanz(blockKey, val) {
    updateEst({ [blockKey]: { ...(est[blockKey] ?? {}), relevanz: val } })
  }

  function handleRQ(text) {
    onAddRueckfrage?.(text)
  }

  // Kopfdaten
  const kopf = est.kopf ?? {}
  function updateKopf(v) { updateEst({ kopf: { ...kopf, ...v } }) }

  // Offene Blöcke zählen
  const blockKeys = ['stammdaten','kinder','sonderausgaben','agb','par35a','anlageN','anlageKap','anlageV','anlageR','sonstige']
  const offeneBlocks = blockKeys.filter(k => (est[k]?.relevanz ?? 'offen') === 'offen').length
  const relevanteBlocks = blockKeys.filter(k => est[k]?.relevanz === 'relevant').length

  return (
    <div className="tab-content">

      {/* ═══ KOPFBEREICH ═══ */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <span style={{ fontWeight: 700, fontSize: '14px' }}>📊 Einkommensteuererklärung</span>
          <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '10px', background: 'rgba(37,99,235,0.1)', color: '#2563eb', fontWeight: 700 }}>
            {relevanteBlocks} relevant
          </span>
          {offeneBlocks > 0 && (
            <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '10px', background: 'rgba(148,163,184,0.1)', color: '#64748b', fontWeight: 700 }}>
              {offeneBlocks} offen
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Veranlagungsjahr</label>
            <input type="number" value={kopf.vj ?? client.veranlagungsjahr ?? ''} onChange={e => updateKopf({ vj: e.target.value })}
              style={{ width: '90px', padding: '5px 9px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface2)', color: 'var(--text)', fontSize: '13px', fontWeight: 700 }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Veranlagungsart</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              {['Einzel', 'Zusammen'].map(v => (
                <button key={v} onClick={() => updateKopf({ art: v })} style={{
                  padding: '4px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                  border: `1px solid ${kopf.art === v ? 'var(--accent)' : 'var(--border)'}`,
                  background: kopf.art === v ? 'rgba(37,99,235,0.1)' : 'var(--surface2)',
                  color: kopf.art === v ? 'var(--accent)' : 'var(--text)', fontWeight: kopf.art === v ? 700 : 400,
                }}>{v}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Kinder</label>
            <input type="number" min="0" max="20" value={kopf.kinder ?? ''} onChange={e => updateKopf({ kinder: e.target.value })}
              style={{ width: '60px', padding: '5px 9px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Bearbeitungsstatus</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              {['Offen','In Arbeit','Fertig'].map(v => (
                <button key={v} onClick={() => updateKopf({ status: v })} style={{
                  padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer',
                  border: `1px solid ${kopf.status === v ? (v === 'Fertig' ? '#16a34a' : v === 'In Arbeit' ? '#2563eb' : '#94a3b8') : 'var(--border)'}`,
                  background: kopf.status === v ? (v === 'Fertig' ? 'rgba(22,163,74,0.1)' : v === 'In Arbeit' ? 'rgba(37,99,235,0.1)' : 'rgba(148,163,184,0.1)') : 'var(--surface2)',
                  color: kopf.status === v ? (v === 'Fertig' ? '#16a34a' : v === 'In Arbeit' ? '#2563eb' : '#64748b') : 'var(--text-muted)',
                  fontWeight: kopf.status === v ? 700 : 400,
                }}>{v}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ BLÖCKE ═══ */}
      <Block title="Stammdaten / Mantelbogen" icon="📋"
        relevanz={est.stammdaten?.relevanz} onRelevanz={v => setRelevanz('stammdaten', v)}
        defaultOpen={true}
      >
        <BlockStammdaten daten={est.stammdaten} onChange={v => updateBlock('stammdaten', v)} onRQ={handleRQ} />
      </Block>

      <Block title="Kinder / Anlage Kind" icon="👶"
        relevanz={est.kinder?.relevanz} onRelevanz={v => setRelevanz('kinder', v)}
        badge={(est.kinder?.liste ?? []).length > 0 ? `${est.kinder.liste.length} Kind${est.kinder.liste.length !== 1 ? 'er' : ''}` : null}
      >
        <BlockKinder daten={est.kinder} onChange={v => updateBlock('kinder', v)} onRQ={handleRQ} />
      </Block>

      <Block title="Sonderausgaben" icon="💰"
        relevanz={est.sonderausgaben?.relevanz} onRelevanz={v => setRelevanz('sonderausgaben', v)}
      >
        <BlockSonderausgaben daten={est.sonderausgaben} onChange={v => updateBlock('sonderausgaben', v)} onRQ={handleRQ} />
      </Block>

      <Block title="Außergewöhnliche Belastungen" icon="⚠️"
        relevanz={est.agb?.relevanz} onRelevanz={v => setRelevanz('agb', v)}
      >
        <BlockAGB daten={est.agb} onChange={v => updateBlock('agb', v)} onRQ={handleRQ} />
      </Block>

      <Block title="§35a EStG – Handwerker / Haushalt" icon="🏠"
        relevanz={est.par35a?.relevanz} onRelevanz={v => setRelevanz('par35a', v)}
        badge={(est.par35a?.liste ?? []).length > 0 ? `${est.par35a.liste.length} Eintr.` : null}
      >
        <BlockPar35a daten={est.par35a} onChange={v => updateBlock('par35a', v)} onRQ={handleRQ} />
      </Block>

      <Block title="Anlage N – Nichtselbständige Arbeit" icon="👔"
        relevanz={est.anlageN?.relevanz} onRelevanz={v => setRelevanz('anlageN', v)}
        badge={(est.anlageN?.liste ?? []).length > 0 ? `${est.anlageN.liste.length} AG` : null}
      >
        <BlockAnlageN daten={est.anlageN} onChange={v => updateBlock('anlageN', v)} onRQ={handleRQ} />
      </Block>

      <Block title="Anlage KAP – Kapitalvermögen" icon="📈"
        relevanz={est.anlageKap?.relevanz} onRelevanz={v => setRelevanz('anlageKap', v)}
      >
        <BlockAnlageKap daten={est.anlageKap} onChange={v => updateBlock('anlageKap', v)} onRQ={handleRQ} />
      </Block>

      <Block title="Anlage V – Vermietung & Verpachtung" icon="🏘️"
        relevanz={est.anlageV?.relevanz} onRelevanz={v => setRelevanz('anlageV', v)}
        badge={(est.anlageV?.liste ?? []).length > 0 ? `${est.anlageV.liste.length} Objekt${est.anlageV.liste.length !== 1 ? 'e' : ''}` : null}
      >
        <BlockAnlageV daten={est.anlageV} onChange={v => updateBlock('anlageV', v)} onRQ={handleRQ} />
      </Block>

      <Block title="Anlage R – Renten" icon="👴"
        relevanz={est.anlageR?.relevanz} onRelevanz={v => setRelevanz('anlageR', v)}
      >
        <BlockAnlageR daten={est.anlageR} onChange={v => updateBlock('anlageR', v)} onRQ={handleRQ} />
      </Block>

      <Block title="Sonstige Einkünfte §22" icon="🔄"
        relevanz={est.sonstige?.relevanz} onRelevanz={v => setRelevanz('sonstige', v)}
      >
        <BlockSonstige daten={est.sonstige} onChange={v => updateBlock('sonstige', v)} onRQ={handleRQ} />
      </Block>

    </div>
  )
}
