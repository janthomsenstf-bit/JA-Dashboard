import { useState, useMemo, useEffect, useRef, Fragment } from 'react'
import {
  MODULE, BEREICH, VIEW_LABEL, VIEW_ORDER, BEREICH_FARBE, STATUS, AUFTRAG,
  eur, num, uid, vjAbweichung, modLists, vorlageJA, ensureKat, neuerModulPunkt,
  viewsOf, alleP, fortschritt, setStichtag, getStichtag, KFZ_KONTEN, STAMMDATEN_FELDER, ustAbstimmung, UST_KONTEN, ust10Tage,
  klassifiziereKonto, kontoZiele, parseKontenText, applyKonten, fillExisting,
  sammleRueckfragen, aufbereitenText, markRueckfrage, buildExportSheets,
  assistAnalyse, applyAssist, ASS_BEISPIEL,
} from '../../utils/jaCheckliste/registry.js'
import { JAC2_CSS } from '../../utils/jaCheckliste/styles.js'

/*
 * JAChecklisteV2 – Jahresabschluss-Checkliste (native React-Portierung des
 * Prototyps). Volle Fachlogik über die Modul-Registry (registry.js).
 * Daten liegen additiv am Objekt (`au.jaChecklisteV2 = { v:2, kategorien, buchungen }`)
 * und werden über onUpdate(patch) gespeichert (→ Supabase).
 */

// ── Datenmodell (Migration/Aufbau aus vorhandenem au.jaChecklisteV2) ──────────
function buildData(au, gw) {
  const d = au?.jaChecklisteV2
  if (d && Array.isArray(d.kategorien)) return { v: 2, gw, kategorien: d.kategorien, buchungen: d.buchungen || [], stammdaten: d.stammdaten || {} }
  const kategorien = vorlageJA(gw)
  if (d && Array.isArray(d.punkte)) {
    d.punkte.forEach(p => {
      const kat = kategorien.find(k => k.bereich === p.bereich) || kategorien[0]
      if (kat) kat.punkte.push({ id: p.id || uid(), titel: p.titel, typ: p.typ, modul: p.modul, konten: p.konten || [], status: p.status || 'offen', werte: p.werte || { _pos: [] } })
    })
  }
  return { v: 2, gw, kategorien, buchungen: (d && d.buchungen) || [], stammdaten: (d && d.stammdaten) || {} }
}
const clone = o => JSON.parse(JSON.stringify(o))
const findP = (d, pid) => (d.kategorien || []).flatMap(k => k.punkte || []).find(p => p.id === pid)

export default function JAChecklisteV2({ au, client, onUpdate }) {
  const gwRaw = String(au?.gewinnermittlung || client?.gewinnermittlung || '').toLowerCase()
  const gw = gwRaw.includes('ilanz') ? 'bilanz' : 'euer'
  if (au?.jahr) setStichtag(au.jahr)

  const data = useMemo(() => buildData(au, gw), [au?.jaChecklisteV2, gw])
  const ctx = { gw, rechtsform: data.stammdaten?.rechtsform || client?.rechtsform || au?.rechtsform || '',
    mandant: client?.name || '', wj: au?.jahr || '' }

  const bereiche = (() => { const b = viewsOf(data); return b.includes('steuern') ? b : [...b, 'steuern'] })()
  const [view, setView] = useState(bereiche[0] || 'be')
  const [modTab, setModTab] = useState({})
  const [darOpen, setDarOpen] = useState(null)
  const [abstFilter, setAbstFilter] = useState('offen')
  const [pickBereich, setPickBereich] = useState(null)
  const [susaOpen, setSusaOpen] = useState(false)
  const [rueckOpen, setRueckOpen] = useState(false)
  const [assistOpen, setAssistOpen] = useState(false)
  const [flash, setFlash] = useState(null) // {pid,list,i,k}
  const contentRef = useRef(null)

  const activeView = (view === 'abstimmung' || view === 'stammdaten') ? view : (bereiche.includes(view) ? view : (bereiche[0] || 'be'))

  // ── Persistenz ──
  const commit = (d) => onUpdate({ jaChecklisteV2: { ...d, v: 2 } })
  const mutate = (fn) => { const d = clone(data); fn(d); commit(d) }

  // ── Flash/Scroll zu einem Konto nach Sprung aus der Abstimmung ──
  useEffect(() => {
    if (!flash || !contentRef.current) return
    const sel = flash.list
      ? `input[data-pos="${flash.pid}"][data-list="${flash.list}"][data-i="${flash.i}"][data-k="${flash.k}"]`
      : `[data-ppcard="${flash.pid}"]`
    const el = contentRef.current.querySelector(sel)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (el.tagName === 'INPUT') { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600) }
    }
    setFlash(null)
  }, [flash, activeView, modTab])

  // ── Modul-Verwaltung ──
  const addModul = (id) => mutate(d => {
    const m = MODULE[id]; const kat = ensureKat(d, m.bereich)
    if (kat.punkte.some(p => p.modul === id)) return
    const p = neuerModulPunkt(id); kat.punkte.push(p)
    setTimeout(() => setModTab(t => ({ ...t, [m.bereich]: p.id })), 0)
  })
  const removeModul = (id) => { if (!confirm('Modul „' + (MODULE[id]?.name || '') + '" samt erfassten Daten entfernen?')) return
    mutate(d => d.kategorien.forEach(k => { k.punkte = k.punkte.filter(p => p.modul !== id) })) }
  const removePunkt = (pid) => { if (!confirm('Diesen Prüfpunkt bzw. dieses Modul wirklich entfernen?')) return
    mutate(d => d.kategorien.forEach(k => { k.punkte = k.punkte.filter(p => p.id !== pid) })) }

  const jumpToKonto = (bereich, pid, list, i, k) => {
    setView(bereich); setModTab(t => ({ ...t, [bereich]: pid })); setFlash({ pid, list, i, k })
  }

  const prog = fortschritt(data)
  const stats = statusCounts(data)
  const offeneRueck = sammleRueckfragen(data).filter(x => !x.ok).length
  const doExport = async () => {
    const sheets = buildExportSheets(data, { mandant: client?.name, gw, wj: au?.jahr || '', checkliste: au?.titel })
    const { exportSheets } = await import('../../utils/jaCheckliste/exportExcel.js')
    exportSheets(sheets, 'Arbeitspapier_' + (client?.name || 'Mandant') + '_' + (au?.titel || 'JA'))
  }

  const shownPunkte = (activeView === 'abstimmung' || activeView === 'stammdaten') ? [] : ((data.kategorien.find(k => (k.bereich || '_') === activeView) || {}).punkte || [])
  const activeMod = modTab[activeView] || (shownPunkte[0] && shownPunkte[0].id)
  const activePunkt = shownPunkte.find(p => p.id === activeMod) || shownPunkte[0]

  return (
    <div className="jac2" ref={contentRef}>
      <style>{JAC2_CSS}</style>

      {/* Kopf / Statistik + Toolbar */}
      <div className="jac2-statrow">
        <div className="jstat"><b>{prog.total}</b><span>Prüfpunkte</span></div>
        <div className="jstat"><b>{stats.offen + stats.arbeit}</b><span>offen / in Arbeit</span></div>
        <div className="jstat rueck"><b>{stats.rueck}</b><span>Rückfragen</span></div>
        <div className="jstat korr"><b>{stats.korr}</b><span>Korrekturbedarf</span></div>
        <div className="jstat ok"><b>{stats.ok}</b><span>erledigt</span></div>
      </div>

      {/* Toolbar */}
      <div className="jac2-toolbar">
        <button className="btn btn-primary btn-sm" onClick={() => setSusaOpen(true)}>📥 SuSa / Kontenabstimmliste importieren</button>
        <button className="btn btn-sm" onClick={() => setAssistOpen(true)}>🎙️ Assistent</button>
        <button className="btn btn-sm" onClick={() => setRueckOpen(true)}>📨 Rückfragen{offeneRueck ? <span className="rrbadge">{offeneRueck}</span> : null}</button>
        <button className="btn btn-sm" onClick={doExport}>⤓ Excel-Export</button>
      </div>

      {/* Bereichs-Menü */}
      <div className="viewnav">
        <button className={'viewtab stammdaten' + (activeView === 'stammdaten' ? ' on' : '')} onClick={() => setView('stammdaten')}>
          Stammdaten
        </button>
        {bereiche.map(b => (
          <button key={b} className={'viewtab ' + b + (activeView === b ? ' on' : '')} onClick={() => setView(b)}>
            {VIEW_LABEL[b]}<span className="vn"> · {countBereich(data, b)}</span>
          </button>
        ))}
        <button className={'viewtab abst' + (activeView === 'abstimmung' ? ' on' : '')} onClick={() => setView('abstimmung')}>
          Abstimmung
        </button>
      </div>

      {activeView === 'stammdaten' ? (
        <StammdatenView data={data} mutate={mutate} client={client} gw={gw} />
      ) : activeView === 'abstimmung' ? (
        <Abstimmung data={data} filter={abstFilter} setFilter={setAbstFilter} onJump={jumpToKonto} />
      ) : (
        <>
          {/* Modul-Menüband */}
          <div className="modnav">
            {shownPunkte.map(p => {
              const st = STATUS[p.status] || STATUS.offen
              return (
                <button key={p.id} className={'modtab' + (p.id === activeMod ? ' on' : '')} onClick={() => setModTab(t => ({ ...t, [activeView]: p.id }))}>
                  <span className={'mdot ' + st[0]} />{p.titel}
                </button>
              )
            })}
            <button className="modtab add" onClick={() => setPickBereich(activeView)}>+ Modul</button>
          </div>

          {shownPunkte.length === 0 ? (
            <div className="jhint">Noch keine Module in „{VIEW_LABEL[activeView]}". Füge mit „+ Modul" eines hinzu – oder importiere eine SuSa (folgt).</div>
          ) : activePunkt ? (
            <ModulCard key={activePunkt.id} p={activePunkt} ctx={ctx} data={data}
              mutate={mutate} removePunkt={removePunkt}
              darOpen={darOpen} setDarOpen={setDarOpen} />
          ) : null}
        </>
      )}

      {/* Modul-Picker */}
      {pickBereich && (
        <ModulPicker bereich={pickBereich} data={data}
          onAdd={id => { addModul(id) }} onRemove={removeModul} onClose={() => setPickBereich(null)} />
      )}

      {/* SuSa-Import */}
      {susaOpen && (
        <SusaImport
          onApply={rows => { mutate(d => applyKonten(d, rows)); setSusaOpen(false) }}
          onFill={map => { mutate(d => fillExisting(d, map)); setSusaOpen(false) }}
          onClose={() => setSusaOpen(false)} />
      )}

      {/* Rückfragen-Sammler */}
      {rueckOpen && (
        <RueckfragenModal data={data} mandant={client?.name} wj={au?.jahr}
          onMark={(key, checked) => mutate(d => markRueckfrage(d, key, checked))}
          onClose={() => setRueckOpen(false)} />
      )}

      {/* Vorbereitungs-Assistent */}
      {assistOpen && (
        <AssistentModal gw={gw}
          onApply={items => { mutate(d => applyAssist(d, items)); setAssistOpen(false) }}
          onClose={() => setAssistOpen(false)} />
      )}
    </div>
  )
}

// ── Umsatzsteuer-Abstimmung (Custom-Render) ───────────────────────────────────
function BodyUst({ p, ctx, mutate, setStatus }) {
  const w = p.werte
  const setF = (k, v) => mutate(d => { findP(d, p.id).werte[k] = v })
  const tog = (k) => mutate(d => { const q = findP(d, p.id).werte; q[k] = !q[k] })
  const rowSet = (key, i, k, v) => mutate(d => { const q = findP(d, p.id).werte; if (!q[key]) q[key] = []; while (q[key].length <= i) q[key].push({}); q[key][i][k] = v })
  const listAdd = (key, row) => mutate(d => { const q = findP(d, p.id).werte; (q[key] || (q[key] = [])).push(row || {}) })
  const listDel = (key, i) => mutate(d => { findP(d, p.id).werte[key].splice(i, 1) })
  const rfAdd = (t) => mutate(d => { const q = findP(d, p.id).werte; if ((q.rueckfragen || []).some(x => x.t === t && t)) return; (q.rueckfragen || (q.rueckfragen = [])).push({ t: t || '', ok: false }) })
  const rfSet = (i, patch) => mutate(d => { Object.assign(findP(d, p.id).werte.rueckfragen[i], patch) })
  const rfDel = (i) => mutate(d => { findP(d, p.id).werte.rueckfragen.splice(i, 1) })
  const histFromVorschlag = () => mutate(d => {
    const q = findP(d, p.id); const mod = MODULE[q.modul]
    const bs = (mod.rechnen(q.werte, ctx).buchungen) || []
    if (!bs.length) return
    if (!q.werte.buchhistorie) q.werte.buchhistorie = []
    const heute = new Date().toLocaleDateString('de-DE')
    bs.forEach(b => q.werte.buchhistorie.push({ datum: heute, soll: b.s, haben: b.h || '', betrag: b.betr, text: b.text, vermerk: '' }))
  })

  const seg = (k, opts, def) => { const cur = w[k] || def; return (
    <div className="ust-seg">{opts.map(o => <button key={o[0]} className={'ust-segb' + (cur === o[0] ? ' on' : '')} onClick={() => setF(k, o[0])}>{o[1]}</button>)}</div>) }

  const besteuerung = w.besteuerung || 'soll'
  const euer = besteuerung === 'euer'
  const quelle = w.quelle || 'steuerkonto'
  const skr = w.skr === '04' ? '04' : '03'
  const K = UST_KONTEN[skr]
  const jahrWJ = getStichtag().getFullYear()
  const va = w.voranmeldung || 'monat'
  const zeitraeume = va === 'quartal' ? ['Q1', 'Q2', 'Q3', 'Q4'] : (va === 'jahr' || va === 'keine' ? ['Jahr'] : ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'])
  const a = ustAbstimmung(w)
  const rf = Array.isArray(w.rueckfragen) ? w.rueckfragen : []
  const ampel = rf.filter(x => !x.ok).length > 0 ? 'rot' : (Math.abs(a.differenz) < 0.005 ? 'gruen' : 'gelb')
  const ampelTxt = { gruen: 'Buchhaltung und Finanzamt stimmen überein.', gelb: 'Abweichung muss geprüft werden.', rot: 'Unterlagen/Rückfragen offen.' }
  const chk = { chkSteuerkonto: 'Steuerkonto geprüft', chkProtokolle: 'Übermittlungsprotokolle geprüft', chkKonten: 'USt-Konten der Buchhaltung geprüft', chkZahlungen: 'Zahlungen / Erstattungen geprüft', chkDiff: 'Differenzen geklärt', chkBuchung: 'Abschlussbuchung vorgenommen' }
  const fehlendVorlagen = ['Steuerkonto USt', 'USt-Jahreserklärung Vorjahr', 'Zahlungsnachweise', ...zeitraeume.map(z => 'UStVA ' + z)]

  return (
    <>
      <div className="ust-sec"><h6>A · Stammdaten Umsatzsteuer</h6>
        <div className="ust-grid3">
          <div><div className="ust-lbl">Besteuerungsart</div>{seg('besteuerung', [['soll', 'Soll'], ['ist', 'Ist'], ['euer', 'EÜR']], 'soll')}</div>
          <div><div className="ust-lbl">Voranmeldung</div>{seg('voranmeldung', [['monat', 'Monatl.'], ['quartal', 'Quartal'], ['jahr', 'nur Jahr'], ['keine', 'keine']], 'monat')}</div>
          <div><div className="ust-lbl">Dauerfristverlängerung</div>
            <div className="chips2">
              <div className={'chk' + (w.dauerfrist ? ' on' : '')} onClick={() => tog('dauerfrist')}><span className="bx">{w.dauerfrist ? '✓' : ''}</span>vorhanden</div>
              <div className={'chk' + (w.sondervz ? ' on' : '')} onClick={() => tog('sondervz')}><span className="bx">{w.sondervz ? '✓' : ''}</span>Sondervorauszahlung</div>
            </div>
            {w.sondervz && <div className="ust-11">
              <label className="darf"><span>Vorjahres-Zahllast</span><input className="num" value={w.sonderVj || ''} onChange={e => setF('sonderVj', e.target.value)} /></label>
              <button className="ust-qa" onClick={() => setF('sondervzBetrag', String(Math.round(num(w.sonderVj) / 11 * 100) / 100))}>1/11 →</button>
              <label className="darf"><span>Sondervorauszahlung 1/11 ({K.sonder})</span><input className="num" value={w.sondervzBetrag || ''} onChange={e => setF('sondervzBetrag', e.target.value)} /></label>
            </div>}
          </div>
          <div><div className="ust-lbl">Kontenrahmen</div>{seg('skr', [['03', 'SKR 03'], ['04', 'SKR 04']], '03')}</div>
        </div>
        {euer && <div className="ust-euerbadge">EÜR: eigener Prüfbereich – zeitliche Zuordnung der USt-Zahlungen nach § 11 EStG (Zu-/Abfluss), siehe unten.</div>}
      </div>

      <div className="ust-sec"><h6>B · Datenquelle</h6>
        {seg('quelle', [['steuerkonto', 'Steuerkonto liegt vor'], ['protokolle', 'kein Steuerkonto → Übermittlungsprotokolle']], 'steuerkonto')}
      </div>

      <div className="ust-sec"><h6>C · Gemeldet ans Finanzamt</h6>
        {quelle === 'steuerkonto' ? (
          <>
            {seg('skModus', [['jahr', 'Jahresbetrag'], ['einzel', 'Einzelabstimmung']], 'jahr')}
            {(w.skModus || 'jahr') === 'jahr'
              ? <label className="darf" style={{ maxWidth: 360, marginTop: 8 }}><span>USt-Zahllast gesamt lt. Steuerkonto (Zahlungen − Erstattungen)</span><input className="num" value={w.skJahr || ''} onChange={e => setF('skJahr', e.target.value)} /></label>
              : <><table className="ust-tab"><thead><tr><th>Zeitraum</th><th>Art</th><th>Betrag</th><th /></tr></thead><tbody>
                {(w.skPos || []).map((r, i) => <tr key={i}>
                  <td><input value={r.zeitraum || ''} onChange={e => rowSet('skPos', i, 'zeitraum', e.target.value)} /></td>
                  <td><select value={r.art || 'vz'} onChange={e => rowSet('skPos', i, 'art', e.target.value)}><option value="vz">Vorauszahlung</option><option value="erstattung">Erstattung</option></select></td>
                  <td><input className="num" value={r.betrag || ''} onChange={e => rowSet('skPos', i, 'betrag', e.target.value)} /></td>
                  <td><button className="del" onClick={() => listDel('skPos', i)}>×</button></td></tr>)}
              </tbody></table><button className="addbtn" onClick={() => listAdd('skPos', { art: 'vz' })}>+ Zeile</button></>}
          </>
        ) : (
          <table className="ust-tab"><thead><tr><th>Zeitraum</th><th>Bemessungsgrdl.</th><th>USt</th><th>Vorsteuer</th><th>Zahllast/Erst.</th></tr></thead><tbody>
            {zeitraeume.map((z, i) => { const r = (w.uva || [])[i] || {}; return <tr key={z}>
              <td className="ust-tz">{z}</td>
              <td><input className="num" value={r.bmg || ''} onChange={e => rowSet('uva', i, 'bmg', e.target.value)} /></td>
              <td><input className="num" value={r.ust || ''} onChange={e => rowSet('uva', i, 'ust', e.target.value)} /></td>
              <td><input className="num" value={r.vst || ''} onChange={e => rowSet('uva', i, 'vst', e.target.value)} /></td>
              <td><input className="num" value={r.zahllast || ''} onChange={e => rowSet('uva', i, 'zahllast', e.target.value)} /></td></tr> })}
          </tbody></table>
        )}
        <div className="ust-sum">Summe gemeldet: <b>{eur(a.gemeldet)}</b></div>
      </div>

      <div className="ust-sec"><h6>D · Laut Buchhaltung</h6>
        {seg('buchModus', [['gesamt', 'Gesamtbetrag'], ['periodisch', 'periodisch']], 'gesamt')}
        {(w.buchModus || 'gesamt') === 'gesamt'
          ? <label className="darf" style={{ maxWidth: 360, marginTop: 8 }}><span>USt-Vorauszahlungen / USt-Verrechnung lt. Buchhaltung</span><input className="num" value={w.buchGesamt || ''} onChange={e => setF('buchGesamt', e.target.value)} /></label>
          : <table className="ust-tab"><thead><tr><th>Zeitraum</th><th>Betrag lt. Buchhaltung</th></tr></thead><tbody>
            {zeitraeume.map((z, i) => { const r = (w.buchPos || [])[i] || {}; return <tr key={z}><td className="ust-tz">{z}</td><td><input className="num" value={r.betrag || ''} onChange={e => rowSet('buchPos', i, 'betrag', e.target.value)} /></td></tr> })}
          </tbody></table>}
        <div className="ust-sum">Summe gebucht: <b>{eur(a.gebucht)}</b></div>
      </div>

      <div className={'ust-abgleich ' + ampel}>
        <div className="ust-abrow"><span>Gemeldet ans Finanzamt</span><b>{eur(a.gemeldet)}</b></div>
        <div className="ust-abrow"><span>./. in Buchhaltung erfasst</span><b>{eur(a.gebucht)}</b></div>
        <div className="ust-abdiff"><span>= Differenz</span><b>{(a.differenz > 0 ? '+' : '') + eur(a.differenz)}</b></div>
      </div>

      <ErgebnisBox p={p} ctx={ctx} mutate={mutate} />

      <div className="ust-sec"><h6>Buchungs-Historie (dokumentiert · wird exportiert)</h6>
        <button className="ust-qa" onClick={histFromVorschlag}>＋ aktuellen Buchungsvorschlag übernehmen</button>
        {(w.buchhistorie || []).length > 0 && <table className="ust-tab ust-hist"><thead><tr><th>Datum</th><th>Soll</th><th>Haben</th><th>Betrag</th><th>Buchungstext</th><th>Vermerk</th><th /></tr></thead><tbody>
          {(w.buchhistorie || []).map((h, i) => <tr key={i}>
            <td><input value={h.datum || ''} onChange={e => rowSet('buchhistorie', i, 'datum', e.target.value)} /></td>
            <td><input className="mono" value={h.soll || ''} onChange={e => rowSet('buchhistorie', i, 'soll', e.target.value)} /></td>
            <td><input className="mono" value={h.haben || ''} onChange={e => rowSet('buchhistorie', i, 'haben', e.target.value)} /></td>
            <td><input className="num" value={h.betrag || ''} onChange={e => rowSet('buchhistorie', i, 'betrag', e.target.value)} /></td>
            <td><input value={h.text || ''} onChange={e => rowSet('buchhistorie', i, 'text', e.target.value)} /></td>
            <td><input value={h.vermerk || ''} onChange={e => rowSet('buchhistorie', i, 'vermerk', e.target.value)} /></td>
            <td><button className="del" onClick={() => listDel('buchhistorie', i)}>×</button></td></tr>)}
        </tbody></table>}
        <button className="addbtn" onClick={() => listAdd('buchhistorie', {})}>+ Zeile</button>
        <div className="ust-hint">Dokumentiere hier, was wohin gebucht wurde – die Historie erscheint als eigenes Blatt im Excel-Export, damit ein Dritter es nachvollziehen kann.</div>
      </div>

      <div className="ust-sec"><h6>F · Abschluss &amp; Prüfstatus</h6>
        <div className={'ust-ampel ' + ampel}>{ampel === 'gruen' ? '🟢 Abgestimmt' : ampel === 'gelb' ? '🟡 Differenz vorhanden' : '🔴 Abstimmung offen'} — {ampelTxt[ampel]}</div>
        <div className="chips2" style={{ marginTop: 10 }}>
          {Object.keys(chk).map(k => <div key={k} className={'chk' + (w[k] ? ' on' : '')} onClick={() => tog(k)}><span className="bx">{w[k] ? '✓' : ''}</span>{chk[k]}</div>)}
        </div>
        <div className="ust-fehlend">
          <div className="ust-lbl">Fehlende Unterlagen / Rückfragen (→ Mandanten-Rückfragen)</div>
          <div className="ust-quickadd">{fehlendVorlagen.map(t => <button key={t} className="ust-qa" onClick={() => rfAdd(t)}>+ {t}</button>)}</div>
          {rf.map((q, i) => <div className="rritem" key={i}><input type="checkbox" title="erledigt" checked={!!q.ok} onChange={e => rfSet(i, { ok: e.target.checked })} /><input className="rrtext" value={q.t || ''} onChange={e => rfSet(i, { t: e.target.value })} /><button className="del" onClick={() => rfDel(i)}>×</button></div>)}
          <button className="addbtn" onClick={() => rfAdd('')}>+ freie Rückfrage</button>
        </div>
        <div className="darfoot"><label className="darstatussel">Status&nbsp;<select value={p.status} onChange={e => setStatus(e.target.value)}>{Object.keys(STATUS).map(s => <option key={s} value={s}>{STATUS[s][1]}</option>)}</select></label></div>
      </div>

      {euer && <div className="ust-sec euer"><h6>§ 11 · USt-Zahlungen rund um den Jahreswechsel (EÜR · 10-Tage-Regel)</h6>
        <div className="ust-hint">Trage je USt-Vorauszahlung rund um den Jahreswechsel den <b>Zeitraum</b>, das <b>Zahlungsdatum</b> und ggf. <b>SEPA</b> ein. Das System prüft die 10-Tage-Regel (§ 11 Abs. 2 S. 2 EStG) und ordnet dem wirtschaftlichen Jahr <b>{jahrWJ}</b> oder dem Jahr der Zahlung zu.</div>
        <table className="ust-tab"><thead><tr><th>USt-Zeitraum</th><th>Zahlungsdatum</th><th>SEPA</th><th>Betrag</th><th>Fälligkeit</th><th>Zuordnung</th><th /></tr></thead><tbody>
          {(w.euerPos || []).map((r, i) => { const t = ust10Tage(r, jahrWJ, w.dauerfrist, K); return <Fragment key={i}><tr>
            <td><select value={r.zeitraum || 'dez'} onChange={e => rowSet('euerPos', i, 'zeitraum', e.target.value)}><option value="dez">Dezember</option><option value="q4">Q4</option><option value="nov">November</option><option value="sonst">sonstiger</option></select></td>
            <td><input type="date" value={r.zahldatum || ''} onChange={e => rowSet('euerPos', i, 'zahldatum', e.target.value)} /></td>
            <td style={{ textAlign: 'center' }}><input type="checkbox" checked={!!r.sepa} onChange={e => rowSet('euerPos', i, 'sepa', e.target.checked)} /></td>
            <td><input className="num" value={r.betrag || ''} onChange={e => rowSet('euerPos', i, 'betrag', e.target.value)} /></td>
            <td className="ust-tz" style={{ fontWeight: 400 }}>{t.faelligTxt}</td>
            <td><span className={'ust-zuord ' + t.zuordnung} title={t.begr}>{t.zuordnung === 'wirtschaft' ? '→ Jahr ' + t.jahr + (t.weekend ? ' ⚠️' : '') : t.zuordnung === 'zahlung' ? '→ Jahr ' + t.jahrZahlung : '—'}</span></td>
            <td><button className="del" onClick={() => listDel('euerPos', i)}>×</button></td></tr>
            {t.buchung && <tr className="ust-bu-row"><td /><td colSpan={6}><span className="ust-bu-lbl">Buchungsvorschlag § 11:</span> <b>{t.buchung.s}</b> (Umsatzsteuervorauszahlung) an <b>{t.buchung.h}</b> (Sonstige Verbindlichkeiten § 11 Abs. 2 S. 2 EStG) – Betriebsausgabe wirtschaftl. Jahr {t.jahr}; Zahlung {t.jahr + 1}: {t.buchung.h} an Bank. <button className="ust-bu-add" onClick={() => mutate(d => { const q = findP(d, p.id).werte; if (!q.buchhistorie) q.buchhistorie = []; q.buchhistorie.push({ datum: r.zahldatum ? r.zahldatum.split('-').reverse().join('.') : '', soll: t.buchung.s, haben: t.buchung.h, betrag: t.buchung.betr, text: t.buchung.text, vermerk: '§ 11 Abs. 2 S. 2 EStG (10-Tage-Regel)' }) })}>→ in Historie</button></td></tr>}</Fragment> })}
        </tbody></table>
        <button className="addbtn" onClick={() => listAdd('euerPos', { zeitraum: 'dez' })}>+ Zeile</button>
        <div className="ust-hint">„Kurze Zeit" = 10 Tage; maßgeblich die Fälligkeit nach § 18 Abs. 1 S. 4 UStG (10. Tag nach VZ-Zeitraum), § 108 Abs. 3 AO (Werktagsverschiebung) unbeachtlich. <b>SEPA-Lastschrift:</b> Abfluss gilt am Fälligkeitstag (bei Kontodeckung), auch bei späterer Abbuchung. <b>Dauerfristverlängerung</b> verschiebt die Fälligkeit → i. d. R. Jahr der Zahlung (strittig, BFH VIII R 1/20 & 25/20). ⚠️ = 10.01. fällt auf Wochenende/Feiertag → Einzelfall prüfen. Prüfhinweis, keine automatische Entscheidung.</div>
      </div>}

      <div className="darsec"><h6>Konten (Bilanz, SKR{skr})</h6><div className="dargrid">
        <label className="darf"><span>USt-Verrechnung</span><input className="mono" value={w.kVerr || ''} placeholder={K.verr} onChange={e => setF('kVerr', e.target.value)} /></label>
        <label className="darf"><span>Forderung aus USt-VZ</span><input className="mono" value={w.kForderung || ''} placeholder={K.ford} onChange={e => setF('kForderung', e.target.value)} /></label>
        <label className="darf"><span>Verbindlichkeit aus USt-VZ</span><input className="mono" value={w.kVerb || ''} placeholder={K.verb} onChange={e => setF('kVerb', e.target.value)} /></label>
        <label className="darf"><span>USt-Forderung frühere Jahre / BP (→ {K.frueher})</span><input className="num" value={w.fruehereBetrag || ''} onChange={e => setF('fruehereBetrag', e.target.value)} /></label>
      </div>
      </div>
    </>
  )
}

// ── Stammdaten & Auftrag (vorangestellter Reiter) ─────────────────────────────
function StammdatenView({ data, mutate, client, gw }) {
  const sd = data.stammdaten || {}
  const setF = (k, v) => mutate(d => { if (!d.stammdaten) d.stammdaten = {}; d.stammdaten[k] = v })
  const val = (f) => sd[f.k] != null ? sd[f.k] : (f.k === 'gewinnermittlung' ? gw : '')
  const ph = (f) => f.k === 'name' ? (client?.name || '') : ''
  return (
    <div className="stammblock">
      <div className="jhint" style={{ margin: '2px 0 14px' }}>Stammdaten &amp; Auftragsrahmen des Mandanten. Diese Angaben fließen als eigenes Blatt in den Excel-Export ein.</div>
      {STAMMDATEN_FELDER.map(grp => (
        <div className="darsec" key={grp.gruppe}>
          <h6>{grp.gruppe}</h6>
          <div className="dargrid">
            {grp.felder.map(f => f.t === 'area' ? (
              <label className="darf" key={f.k} style={{ gridColumn: '1 / -1' }}><span>{f.l}</span>
                <textarea className="darnotiz" value={val(f)} placeholder={ph(f)} onChange={e => setF(f.k, e.target.value)} /></label>
            ) : f.t === 'select' ? (
              <label className="darf" key={f.k}><span>{f.l}</span>
                <select value={val(f)} onChange={e => setF(f.k, e.target.value)}>{f.opt.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select></label>
            ) : (
              <label className="darf" key={f.k}><span>{f.l}</span>
                <input value={val(f)} placeholder={ph(f)} onChange={e => setF(f.k, e.target.value)} /></label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Rückfragen-Sammler ────────────────────────────────────────────────────────
function RueckfragenModal({ data, mandant, wj, onMark, onClose }) {
  const all = sammleRueckfragen(data); const offen = all.filter(x => !x.ok).length
  const [showTxt, setShowTxt] = useState(false)
  const byB = {}, bOrder = []
  all.forEach(x => { if (!byB[x.bereich]) { byB[x.bereich] = {}; bOrder.push(x.bereich) } const g = byB[x.bereich]; (g[x.quelle] || (g[x.quelle] = [])).push(x) })
  const txt = aufbereitenText(data, mandant, wj)
  const copy = () => { try { navigator.clipboard.writeText(txt).then(() => {}, () => setShowTxt(true)) } catch { setShowTxt(true) } }
  const keyOf = x => x.key || (x.kind + ':' + x.pid + ':' + (x.idx != null ? x.idx : x.zi))
  return (
    <div className="jac2-ov" onClick={e => { if (e.target.classList.contains('jac2-ov')) onClose() }}>
      <div className="jac2-modal">
        <div className="modal__h"><h2>Rückfragen an den Mandanten</h2><button className="x" onClick={onClose}>×</button></div>
        <div className="modal__b">
          {all.length === 0 ? (
            <p className="jhint" style={{ padding: '14px 0' }}>Noch keine Rückfragen. Setze in einem Modul den Haken „Prüfung", oder lege je Konto/Prüfpunkt „＋ Rückfrage" an.</p>
          ) : (
            <>
              <p className="jhint" style={{ marginBottom: '14px' }}>{all.length} Rückfrage(n), davon <b>{offen} offen</b>. Haken = vom Mandanten beantwortet.</p>
              {bOrder.map(b => (
                <div className="rfgrp" key={b}><h4>{b}</h4>
                  {Object.keys(byB[b]).map(q => (
                    <div key={q}><div className="rfq">{q}</div>
                      {byB[b][q].map((x, i) => (
                        <label className={'rfrow' + (x.ok ? ' done' : '')} key={i}><input type="checkbox" checked={x.ok} onChange={e => onMark(keyOf(x), e.target.checked)} /><span>{x.text}</span></label>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
              <div className="ppactions" style={{ marginTop: '8px' }}>
                <button className="btn btn-primary" onClick={copy}>Für Mandanten kopieren</button>
                <button className="btn" onClick={() => setShowTxt(s => !s)}>Klartext anzeigen</button>
              </div>
              {showTxt && <div className="rfcopy">{txt}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Vorbereitungs-Assistent ───────────────────────────────────────────────────
const ASS_BADGE = { be: 'Betriebseinnahmen', ba: 'Betriebsausgaben', aktiva: 'Aktiva', passiva: 'Passiva' }
function AssistentModal({ gw, onApply, onClose }) {
  const [txt, setTxt] = useState('')
  const [res, setRes] = useState(null) // {items,...}
  const [, force] = useState(0); const rerender = () => force(n => n + 1)
  const analyze = () => { const t = txt.trim(); if (!t) return; setRes(assistAnalyse(t, gw)) }
  const inc = res ? res.items.filter(x => x.include) : []

  if (!res) {
    return (
      <div className="jac2-ov" onClick={e => { if (e.target.classList.contains('jac2-ov')) onClose() }}>
        <div className="jac2-modal">
          <div className="modal__h"><h2>🎙️ Vorbereitungs-Assistent</h2><button className="x" onClick={onClose}>×</button></div>
          <div className="modal__b">
            <p className="jhint" style={{ marginBottom: '12px' }}>Schreibe frei, was dir bei der ersten Durchsicht auffällt (Fahrzeuge, Darlehen, Rechnungsabgrenzung, Sachentnahmen, „Konto 8401 …" …). Der Assistent leitet Modul-Vorschläge ab – <b>übernommen wird nichts ohne deine Bestätigung.</b></p>
            <textarea value={txt} onChange={e => setTxt(e.target.value)} style={{ width: '100%', minHeight: '150px', font: 'inherit', fontSize: '15px', lineHeight: 1.6, padding: '14px', border: '1px solid #cbd5e1', borderRadius: '10px', boxSizing: 'border-box' }}
              placeholder={'z. B. „Drei neue Fahrzeuge, ein Lkw am 03.05.2024 … Sieben Darlehen. Rechnungsabgrenzung, ungefähr 15 Posten. Sachentnahmen Gastronomie."'} />
            <div className="ppactions" style={{ marginTop: '10px' }}>
              <button className="btn btn-primary" onClick={analyze}>Analysieren →</button>
              <button className="btn" onClick={() => setTxt(ASS_BEISPIEL)}>Beispiel einsetzen</button>
            </div>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="jac2-ov" onClick={e => { if (e.target.classList.contains('jac2-ov')) onClose() }}>
      <div className="jac2-modal">
        <div className="modal__h"><h2>Vorschlag des Assistenten</h2><button className="x" onClick={onClose}>×</button></div>
        <div className="modal__b">
          {res.items.length === 0 ? (
            <>
              <p className="jhint" style={{ padding: '10px 0' }}>Keine bekannten Sachverhalte erkannt. Formuliere ausführlicher (z. B. „Fahrzeuge angeschafft", „Darlehen", „Rechnungsabgrenzung", „Sachentnahmen Gastronomie").</p>
              <div className="ppactions"><button className="btn btn-primary" onClick={() => setRes(null)}>◂ Zurück</button></div>
            </>
          ) : (
            <>
              <p className="jhint" style={{ marginBottom: '8px' }}>Erkannt: <b>{res.items.length}</b> Sachverhalt(e). Prüfe, korrigiere Anzahlen, wähle Rückfragen – <b>übernommen wird erst auf „Übernehmen".</b></p>
              <div className="asssum">{inc.map(x => '✓ ' + x.name).join('   ') || '– nichts ausgewählt –'}</div>
              <div className="asscards">
                {res.items.map((it, i) => (
                  <div className={'asscard' + (it.include ? '' : ' off')} key={i}>
                    <label className="assinc">
                      <input type="checkbox" checked={it.include} onChange={e => { it.include = e.target.checked; rerender() }} />
                      <span className="asstitle">{it.name}</span>
                      <span className={'assbadge ' + it.bereich}>{ASS_BADGE[it.bereich] || it.bereich}</span>
                      {it.status === 'unvoll' && <span className="assunvoll">unvollständig</span>}
                    </label>
                    <div className="assaktion">▸ {it.aktion}</div>
                    {(it.kind === 'konten' || it.kind === 'modulKonten') && (
                      <div className="asskonten">{it.konten.map((k, j) => (
                        <label className="assrfitem" key={j}><input type="checkbox" checked={k.keep} onChange={e => { k.keep = e.target.checked; rerender() }} /><span><b className="mono">{k.konto}</b> {k.bez || ''}</span></label>
                      ))}</div>
                    )}
                    {it.positionen && <div className="asspos">{it.positionen.rows.length} Position(en){it.positionen.rows.some(r => r.bez) ? ': ' + it.positionen.rows.map(r => r.bez || '—').slice(0, 8).join(', ') : ''}</div>}
                    {it.positionen && it.key !== 'anlage' && (
                      <label className="asscount">Anzahl vorbereiten: <input type="number" min="0" value={it.positionen.rows.length} onChange={e => { const n = Math.max(0, +e.target.value || 0); const r = it.positionen.rows; while (r.length < n) r.push(it.listBez ? { bez: it.listBez + ' ' + (r.length + 1) } : {}); r.length = n; it.count = n; rerender() }} /></label>
                    )}
                    {it.fehlend && it.fehlend.length > 0 && <div className="assfehlt">Noch offen: {it.fehlend.join('; ')}</div>}
                    {it.rueckfragen.length > 0 && (
                      <div className="assrf"><div className="assrfh">Intelligente Rückfragen (fließen ins Rückfragen-Modul)</div>
                        {it.rueckfragen.map((t, j) => (
                          <label className="assrfitem" key={j}><input type="checkbox" checked={it.rfKeep[j]} onChange={e => { it.rfKeep[j] = e.target.checked; rerender() }} /><span>{t}</span></label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="ppactions" style={{ marginTop: '18px' }}>
                <button className="btn btn-primary" onClick={() => onApply(res.items)}>Übernehmen ({inc.length})</button>
                <button className="btn" onClick={() => setRes(null)}>◂ Zurück zum Text</button>
                <button className="btn" onClick={onClose}>Verwerfen</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── SuSa-/Kontenabstimmliste-Import (Upload/Einfügen → Zuordnung → Übernehmen) ─
const SUSA_DEMO = '8401 ; steuerpflichtige Erlöse ; 245000 ; 231000\n8300 ; Erlöse ermäßigt 7% ; 88000 ; 91500\n8120 ; Ausfuhrlieferungen ; 30000 ; 12000\n0410 ; Maschinen ; 120000 ; 95000\n0520 ; Fuhrpark ; 48000 ; 52000\n1200 ; Bank ; 91000 ; 60000\n1400 ; Forderungen aLL ; 42000 ; 38000\n1576 ; Vorsteuer ; 26400 ; 25100\n0630 ; Darlehen Bank ; 180000 ; 200000\n4120 ; Löhne und Gehälter ; 96000 ; 88000\n4930 ; Bürobedarf ; 3200 ; 2800'

function SusaImport({ onApply, onFill, onClose }) {
  const [txt, setTxt] = useState('')
  const [info, setInfo] = useState('')
  const [rows, setRows] = useState(null) // Zuordnungsschritt
  const ziele = useMemo(() => kontoZiele(), [])
  const grp = {}; ziele.forEach(z => { (grp[z.bereich] || (grp[z.bereich] = [])).push(z) })

  const onFile = async e => {
    const f = e.target.files[0]; if (!f) return
    setInfo('Lese ' + f.name + ' …')
    try { const { readSusaFile } = await import('../../utils/jaCheckliste/susaReader.js')
      const r = await readSusaFile(f); if (!r.length) throw new Error('leer')
      setTxt(r.map(x => x.konto + ' ; ' + x.bez + ' ; ' + x.saldo + ' ; ' + x.vj).join('\n'))
      setInfo(f.name + ' – ' + r.length + ' Konten gelesen. Jetzt „Analysieren & zuordnen".')
    } catch (err) { setInfo(f.name + ' – konnte nicht gelesen werden. Bitte als CSV speichern oder Zeilen einfügen.') }
  }
  const analyze = () => { const r = parseKontenText(txt); if (!r.length) { setInfo('Keine Konten erkannt. Format: Konto ; Bezeichnung ; Saldo ; Vorjahr'); return }
    r.forEach(x => { x.ziel = klassifiziereKonto(x.konto, x.bez) }); setRows(r) }
  const fill = () => { const map = {}; parseKontenText(txt).forEach(r => { map[r.konto] = { s: r.saldo, v: r.vj } }); onFill(map) }

  const opts = (sel, i) => (
    <select value={sel} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, ziel: e.target.value } : x))}>
      {VIEW_ORDER.filter(bz => grp[bz]).map(bz => (
        <optgroup key={bz} label={VIEW_LABEL[bz] || bz}>{grp[bz].map(z => <option key={z.k} value={z.k}>{z.name}</option>)}</optgroup>
      ))}
      <option value="__ignore">— ignorieren —</option>
    </select>
  )

  const unklar = rows ? rows.filter(r => r.ziel === 'konUnklar').length : 0

  return (
    <div className="jac2-ov" onClick={e => { if (e.target.classList.contains('jac2-ov')) onClose() }}>
      <div className="jac2-modal">
        {!rows ? (
          <>
            <div className="modal__h"><h2>Konten / SuSa hochladen & zuordnen</h2><button className="x" onClick={onClose}>×</button></div>
            <div className="modal__b">
              <p className="jhint" style={{ marginBottom: '12px' }}>Lade die Summen- & Saldenliste als <b>Excel (.xlsx)</b> oder <b>CSV</b> hoch (direkt aus DATEV) – Konto, Bezeichnung, Saldo und Vorjahr werden automatisch erkannt. Alternativ Zeilen einfügen (<b>Konto ; Bezeichnung ; Saldo ; Vorjahr</b>).</p>
              <label className="btn" style={{ position: 'relative', overflow: 'hidden', display: 'inline-block', marginBottom: '10px' }}>📄 Datei wählen (.xlsx / .csv)
                <input type="file" accept=".csv,.txt,.xlsx,.xls" onChange={onFile} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} /></label>
              {info && <span className="jhint" style={{ marginLeft: '10px' }}>{info}</span>}
              <textarea value={txt} onChange={e => setTxt(e.target.value)} style={{ width: '100%', minHeight: '150px', fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: '12.5px', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', marginTop: '4px' }}
                placeholder={'8401 ; steuerpflichtige Erlöse ; 245000 ; 231000\n0520 ; Fuhrpark ; 48000 ; 52000\n1200 ; Bank ; 91000 ; 60000'} />
              <div className="ppactions" style={{ marginTop: '4px' }}>
                <button className="btn btn-primary" onClick={analyze}>Analysieren & zuordnen →</button>
                <button className="btn" onClick={fill}>Nur bestehende Konten füllen</button>
                <button className="btn" onClick={() => setTxt(SUSA_DEMO)}>Beispiel</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="modal__h"><h2>Kontenzuordnung – Vorschlag</h2><button className="x" onClick={onClose}>×</button></div>
            <div className="modal__b">
              <p className="jhint" style={{ marginBottom: '10px' }}><b>{rows.length}</b> Konten erkannt{unklar ? <>, davon <b style={{ color: '#c2410c' }}>{unklar} unklar</b> (rot – bitte zuordnen)</> : null}. Prüfe/korrigiere die Zuordnung – <b>übernommen wird erst auf „Übernehmen".</b></p>
              <div className="kztab"><table className="kz"><thead><tr><th>Konto</th><th>Bezeichnung</th><th>Saldo</th><th>→ Modul / Kategorie</th></tr></thead>
                <tbody>{rows.map((r, i) => (
                  <tr key={i} className={r.ziel === 'konUnklar' ? 'kz-unklar' : ''}>
                    <td className="mono">{r.konto}</td><td>{r.bez || ''}</td><td className="num">{r.saldo ? eur(num(r.saldo)) : '—'}</td>
                    <td>{opts(r.ziel, i)}</td>
                  </tr>
                ))}</tbody></table></div>
              <div className="ppactions" style={{ marginTop: '16px' }}>
                <button className="btn btn-primary" onClick={() => onApply(rows)}>Übernehmen</button>
                <button className="btn" onClick={() => setRows(null)}>◂ Zurück</button>
                <button className="btn" onClick={onClose}>Verwerfen</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Statistik-Helfer ──────────────────────────────────────────────────────────
function statusCounts(cl) { const c = { offen: 0, arbeit: 0, rueck: 0, ok: 0, korr: 0 }; alleP(cl).forEach(p => { c[p.status] = (c[p.status] || 0) + 1 }); return c }
function countBereich(cl, b) { return (cl.kategorien.find(k => (k.bereich || '_') === b)?.punkte || []).length }

/* Beipackzettel eines überarbeiteten Moduls: Stand, Konten je Kontenrahmen,
   Rechenweg und Fundstellen. Speist sich allein aus der Registry — ein Modul mit
   `stand` bekommt den Block automatisch, ohne dass hier etwas zu ergänzen wäre. */
function ModulInfo({ mod }) {
  const [offen, setOffen] = useState(false)
  const konten = mod.konten && typeof mod.konten === 'object' ? mod.konten : null
  const rollen = { aufwand: 'Aufwand', nichtAbz: 'nicht abziehbar', gegen: 'Gegenkonto',
    entnahme7: 'Entnahme 7 %', entnahme19: 'Entnahme 19 %', ust7: 'USt 7 %', ust19: 'USt 19 %' }
  return (
    <aside className="modinfo">
      {(mod.rechenweg || []).length > 0 && (
        <>
          <div className="modinfo__t">Rechenweg</div>
          <table className="modweg"><tbody>
            {mod.rechenweg.map(([a, b], i) => <tr key={i}><td className="l">{a}</td><td>{b}</td></tr>)}
          </tbody></table>
        </>
      )}
      {konten && (
        <>
          <div className="modinfo__t">Konten</div>
          {Object.entries(konten).map(([skr, k]) => (
            <div className="modkonten" key={skr}>
              <b>SKR{skr}</b>
              {Object.entries(k).map(([rolle, nr]) => (
                <span key={rolle}><code>{nr}</code> {rollen[rolle] || rolle}</span>
              ))}
            </div>
          ))}
        </>
      )}
      {(mod.quellen || []).length > 0 && (
        <>
          <div className="modinfo__t">
            Quellen · Stand {mod.stand}
            <button className="linkmehr" onClick={() => setOffen(o => !o)}>{offen ? 'weniger' : 'zeigen'}</button>
          </div>
          {offen && <ul className="modquellen">{mod.quellen.map((q, i) => <li key={i}>{q}</li>)}</ul>}
        </>
      )}
    </aside>
  )
}

/* Download der Mandanten-Vorlage. Erscheint automatisch bei jedem Modul, das in
   registry.js eine `vorlage` meldet — vorlagen.js wird erst beim Klick geladen. */
function VorlagenKnopf({ mod, ctx, werte }) {
  const [laeuft, setLaeuft] = useState(false)
  const holen = async () => {
    setLaeuft(true)
    try {
      const { vorlageHerunterladen } = await import('../../utils/jaCheckliste/vorlagen.js')
      // Die Vorlage folgt der im Modul gewählten Objektart, damit der Mandant
      // nur die Felder bekommt, die für seinen Fall gelten.
      vorlageHerunterladen(mod.vorlage.id, {
        mandant: ctx?.mandant || '', jahr: ctx?.wj || '', objekt: (werte && werte.objekt) || 'miete' })
    } catch (e) {
      alert('Vorlage konnte nicht erzeugt werden: ' + e.message)
    } finally { setLaeuft(false) }
  }
  return (
    <button className="btn btn-sm" onClick={holen} disabled={laeuft}
      title="Ausfüll-Vorlage als Excel herunterladen und dem Mandanten schicken">
      {laeuft ? '…' : '⤓ ' + (mod.vorlage.titel || 'Vorlage')}
    </button>
  )
}

// ── Modul-Karte (ein Prüfpunkt) ───────────────────────────────────────────────
function ModulCard({ p, ctx, data, mutate, removePunkt, darOpen, setDarOpen }) {
  const st = STATUS[p.status] || STATUS.offen
  const mod = MODULE[p.modul]
  const setStatus = s => mutate(d => { findP(d, p.id).status = s })
  return (
    <div className={'pp open' + (mod && mod.stand ? ' neu' : '')} data-ppcard={p.id}>
      <div className="pp__h" style={{ cursor: 'default' }}>
        <span className={'pp__typ ' + p.typ}>TYP {p.typ}</span>
        <span className="pp__titel">{p.titel}</span>
        {mod && mod.stand && <span className="stand" title={(mod.quellen || []).join(' · ')}>überarbeitet {mod.stand}</span>}
        <span className="pp__konten">{(p.konten || []).filter(x => x && x !== '—').map((k, i) => <span key={i} className="kchip">{k}</span>)}</span>
        {mod && mod.vorlage && <VorlagenKnopf mod={mod} ctx={ctx} werte={p.werte} />}
        <span className={'stpill ' + st[0]}>{st[1]}</span>
      </div>
      <div className="pp__b">
        {mod && mod.veraltet && (
          <div className="jhint" style={{ margin: '0 0 12px', padding: '9px 12px', borderRadius: '8px', background: 'rgba(250,178,25,.16)' }}>
            ⚠️ {mod.veraltet.text}
          </div>
        )}
        {/* Überarbeitete Module bekommen die Seitenspalte mit Rechenweg, Konten
            und Quellen. Der Altbestand bleibt in der bisherigen vollen Breite. */}
        <div className={mod && mod.stand && (mod.rechenweg || mod.quellen) ? 'modzwei' : ''}>
          <div>
            {mod && mod.custom === 'darlehen'
              ? <Darlehen p={p} mutate={mutate} darOpen={darOpen} setDarOpen={setDarOpen} />
              : mod && mod.custom === 'kfz'
                ? <BodyKfz p={p} ctx={ctx} mutate={mutate} setStatus={setStatus} />
                : mod && mod.custom === 'ust'
                  ? <BodyUst p={p} ctx={ctx} mutate={mutate} setStatus={setStatus} />
                  : <BodyByType p={p} ctx={ctx} mutate={mutate} setStatus={setStatus} />}
          </div>
          {mod && mod.stand && (mod.rechenweg || mod.quellen) && <ModulInfo mod={mod} />}
        </div>
        {/* Erläuterungen: bei JEDEM Prüfpunkt, unabhängig von Typ und Modul.
            Nutzt weiterhin werte.notiz, damit bereits geschriebene Texte erhalten
            bleiben; die frueheren Einzelfelder je Typ sind dafuer entfallen. */}
        <div className="erl">
          <label htmlFor={'erl-' + p.id}>Erläuterungen</label>
          <textarea id={'erl-' + p.id} value={p.werte.notiz || ''}
            placeholder="Wie geprüft, worauf gestützt, was bleibt offen? Der Text erscheint im Excel-Export."
            onChange={e => mutate(d => { findP(d, p.id).werte.notiz = e.target.value })} />
        </div>
        <div className="ppfoot"><button className="linkdel" onClick={() => removePunkt(p.id)}>🗑&nbsp;Prüfpunkt entfernen</button></div>
      </div>
    </div>
  )
}

function StatusSelect({ p, setStatus }) {
  return (
    <div className="fld"><label>Status</label>
      <select value={p.status} onChange={e => setStatus(e.target.value)}>
        {Object.keys(STATUS).map(s => <option key={s} value={s}>{STATUS[s][1]}</option>)}
      </select>
    </div>
  )
}
function QuickCheck({ p, mutate, label }) {
  const on = !!p.werte.plaus
  const toggle = e => mutate(d => { const q = findP(d, p.id); q.werte.plaus = e.target.checked; if (e.target.checked) q.status = 'ok'; else if (q.status === 'ok') q.status = 'offen' })
  return <label className={'quickcheck' + (on ? ' on' : '')}><input type="checkbox" checked={on} onChange={toggle} /><span>{label}</span></label>
}

function BodyByType({ p, ctx, mutate, setStatus }) {
  const setF = (k, v) => mutate(d => { findP(d, p.id).werte[k] = v })
  if (p.typ === 'A') return <BodyA p={p} setF={setF} mutate={mutate} setStatus={setStatus} />
  if (p.typ === 'B') return <BodyB p={p} setF={setF} mutate={mutate} setStatus={setStatus} />
  return <BodyC p={p} ctx={ctx} setF={setF} mutate={mutate} setStatus={setStatus} />
}

function BodyA({ p, setF, mutate, setStatus }) {
  const w = p.werte
  return (
    <>
      <QuickCheck p={p} mutate={mutate} label="Geprüft & plausibel – ohne weitere Erfassung" />
      <div className="grid">
        <StatusSelect p={p} setStatus={setStatus} />
        <div className="fld"><label>Konto (optional)</label><input className="mono" value={w.konto || (p.konten || [])[0] || ''} onChange={e => setF('konto', e.target.value)} /></div>
        <div className="fld"><label>Betrag</label><input className="num" value={w.betrag || ''} placeholder="0,00" onChange={e => setF('betrag', e.target.value)} /></div>
      </div>
    </>
  )
}

function BodyB({ p, setF, mutate, setStatus }) {
  // Abweichung über vjAbweichung: Beträge vergleichen, nicht Vorzeichen — sonst
  // liest sich eine wachsende Verbindlichkeit als Minus. Vorzeichenwechsel extra.
  const w = p.werte; const s = num(w.saldo), v = num(w.vj)
  const a = vjAbweichung(s, v); const d = a.betrag; const dp = a.prozent
  return (
    <>
      <QuickCheck p={p} mutate={mutate} label="Vorjahresvergleich plausibel – ohne weitere Erfassung" />
      <div className="grid">
        <div className="fld"><label>Konto</label><input className="mono" value={w.konto || ''} onChange={e => setF('konto', e.target.value)} /></div>
        <div className="fld"><label>Bezeichnung</label><input value={w.bez || ''} onChange={e => setF('bez', e.target.value)} /></div>
        <div className="fld"><label>Saldo aktuell</label><input className="num" value={w.saldo || ''} placeholder="0,00" onChange={e => setF('saldo', e.target.value)} /></div>
        <div className="fld"><label>Saldo Vorjahr</label><input className="num" value={w.vj || ''} placeholder="0,00" onChange={e => setF('vj', e.target.value)} /></div>
        <div className="fld"><label>Abweichung</label><div style={{ padding: '8px 0' }}>
          <span className={'abw ' + (d >= 0 ? 'up' : 'down')}>{eur(d)}{dp != null ? ` (${dp > 0 ? '+' : ''}${dp}%)` : ''}</span>
          {a.vzWechsel && <span className="abw up" title="Konto ist gegenüber dem Vorjahr von Soll auf Haben gekippt – immer erklären" style={{ marginLeft: 8 }}>⇄ Vorzeichenwechsel</span>}
        </div></div>
        <StatusSelect p={p} setStatus={setStatus} />
      </div>
    </>
  )
}

function BodyC({ p, ctx, setF, mutate, setStatus }) {
  const mod = MODULE[p.modul]
  const struktur = mod && (mod.flags || mod.felder || mod.positionen || mod.listen)
  if (!mod || (!mod.rechnen && !struktur)) {
    return (
      <>
        <div className="jhint" style={{ margin: '10px 0' }}>{mod && mod.hinweis ? mod.hinweis + ' – ' : ''}Dieses Modul ist als Vorlage angelegt. Bis der Rechner ergänzt ist, dokumentierst du hier wie bei einem einfachen Prüfpunkt.</div>
        <BodyA p={p} setF={setF} mutate={mutate} setStatus={setStatus} />
      </>
    )
  }
  const w = p.werte
  const felder = mod.felder ? (typeof mod.felder === 'function' ? mod.felder(ctx, w) : mod.felder) : null
  // 'notiz' wird zentral als Erläuterungsbereich gerendert – hier ausblenden,
  // damit dasselbe Feld nicht zweimal auf der Karte steht.
  const sichtbar = felder ? felder.filter(f => f.k !== 'notiz') : null
  const toggleFlag = k => mutate(d => { const q = findP(d, p.id).werte; q[k] = !q[k] })

  return (
    <>
      <QuickCheck p={p} mutate={mutate} label="Geprüft & plausibel – ohne weitere Erfassung" />
      {mod.flags && (
        <div className="chips2" style={{ marginBottom: '14px' }}>
          {mod.flags.map(fl => { const on = !!w[fl.k]
            return <div key={fl.k} className={'chk' + (on ? ' on' : '')} onClick={() => toggleFlag(fl.k)}><span className="bx">{on ? '✓' : ''}</span>{fl.label}</div> })}
        </div>
      )}
      <div className="grid">
        {sichtbar && sichtbar.map(f => {
          const cur = (w[f.k] != null && w[f.k] !== '') ? w[f.k] : (f.def != null ? f.def : '')
          if (f.t === 'select') return (
            <div key={f.k} className={'fld' + (f.full ? ' full' : '')}><label>{f.l}</label>
              <select value={String(cur)} onChange={e => setF(f.k, e.target.value)}>{f.opt.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select></div>)
          if (f.t === 'area') return (
            <div key={f.k} className="fld full"><label>{f.l}</label><textarea value={cur} onChange={e => setF(f.k, e.target.value)} /></div>)
          const cls = f.t === 'num' ? 'num' : (/^k[A-Z]/.test(f.k) ? 'mono' : '')
          return (
            <div key={f.k} className={'fld' + (f.full || (f.t === 'text' && f.k === 'anlass') ? ' full' : '')}><label>{f.l}</label>
              <input className={cls} value={cur} onChange={e => setF(f.k, e.target.value)} /></div>)
        })}
        <StatusSelect p={p} setStatus={setStatus} />
      </div>

      {modLists(mod).map(L => <KontoListe key={L.key} p={p} L={L} mutate={mutate} />)}

      {mod.rechnen && <ErgebnisBox p={p} ctx={ctx} mutate={mutate} />}
    </>
  )
}

// ── Konten-/Positions-Liste (inkl. rowNotes: Status/Rückfrage/Hinweis) ─────────
function KontoListe({ p, L, mutate }) {
  const arr = p.werte[L.key] && p.werte[L.key].length ? p.werte[L.key] : [{}]
  const textF = L.felder.filter(f => f.t !== 'check')
  const checkF = L.felder.filter(f => f.t === 'check')
  const chkInline = checkF.length <= 1 && !checkF.some(f => f.warn)

  const row = (i) => (fn) => mutate(d => { const w = findP(d, p.id).werte; if (!w[L.key]) w[L.key] = []; while (w[L.key].length <= i) w[L.key].push({}); fn(w[L.key][i], w[L.key]) })
  const addRow = () => mutate(d => { const w = findP(d, p.id).werte; (w[L.key] || (w[L.key] = [])).push({}) })
  const delRow = (i) => mutate(d => { findP(d, p.id).werte[L.key].splice(i, 1) })

  return (
    <div className="posblock">
      <h5 className="posH">{L.label || 'Positionen'}</h5>
      {arr.map((r, i) => {
        const rr = Array.isArray(r.rueck) ? r.rueck : []; const offRR = rr.filter(x => !x.ok).length
        const done = r.fertig || r.ok
        return (
          <div className="posrow2" key={i}>
            <div className="posgrid">
              {L.rowNotes && <span className={'posdot ' + (done ? 'ok' : (offRR ? 'rueck' : ''))} title={done ? 'erledigt/geprüft' : (offRR ? offRR + ' Rückfrage(n) offen' : 'offen')} />}
              {textF.map(f => (
                <div key={f.k} className={'fld ' + ((f.k === 'konto' || f.k === 'buchungskonto') ? 'w-konto' : (f.t === 'num' ? 'w-num' : ''))}>
                  <label>{f.l}</label>
                  {f.t === 'select'
                    ? <select value={r[f.k] || ''} onChange={e => row(i)(x => { x[f.k] = e.target.value })}>{f.opt.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
                    : <input className={f.t === 'num' ? 'num' : (/konto|^k[A-Z]/.test(f.k) ? 'mono' : '')}
                        type={f.t === 'date' ? 'date' : 'text'}
                        data-pos={p.id} data-list={L.key} data-i={i} data-k={f.k}
                        value={r[f.k] || f.def || ''} onChange={e => row(i)(x => { x[f.k] = e.target.value })} />}
                </div>
              ))}
              {chkInline && checkF.map(f => (
                <label key={f.k} className={'poscheck inline' + (r[f.k] ? ' on' : '')}><input type="checkbox" checked={!!r[f.k]} onChange={e => row(i)(x => { x[f.k] = e.target.checked })} /><span>{f.l}</span></label>
              ))}
              <button className="del" onClick={() => delRow(i)} title="Zeile löschen">×</button>
            </div>

            {!chkInline && checkF.length > 0 && (
              <div className="poschecks">{checkF.map(f => (
                <label key={f.k} className={'poscheck' + (r[f.k] ? ' on' : '') + (f.warn ? ' warn' : '')}><input type="checkbox" checked={!!r[f.k]} onChange={e => row(i)(x => { x[f.k] = e.target.checked })} /><span>{f.l}</span></label>
              ))}</div>
            )}

            {L.rowNotes && (
              <div className="posextra">
                {L.rowFertig && <label className={'rowfertig' + (r.fertig ? ' on' : '')}><input type="checkbox" checked={!!r.fertig} onChange={e => row(i)(x => { x.fertig = e.target.checked })} /><span>erledigt / geklärt</span></label>}
                <button className="rueckadd" onClick={() => row(i)(x => { (x.rueck || (x.rueck = [])).push({ t: '', ok: false }) })}>＋ Rückfrage{offRR ? <span className="rrbadge">{offRR}</span> : null}</button>
                {r.notiz == null && <button className="hinweisadd" onClick={() => row(i)(x => { x.notiz = '' })}>＋ Hinweis (intern)</button>}
                {rr.length > 0 && (
                  <div className="rowrueck">{rr.map((q, ri) => (
                    <div className="rritem" key={ri}>
                      <input type="checkbox" title="beantwortet" checked={!!q.ok} onChange={e => row(i)(x => { x.rueck[ri].ok = e.target.checked })} />
                      <input className="rrtext" value={q.t || ''} placeholder="Frage zu diesem Konto …" onChange={e => row(i)(x => { x.rueck[ri].t = e.target.value })} />
                      <button className="del" title="Rückfrage löschen" onClick={() => row(i)(x => { x.rueck.splice(ri, 1) })}>×</button>
                    </div>
                  ))}</div>
                )}
                {r.notiz != null && (
                  <div className="rowhinweis">
                    <span className="rhlabel">🛈 intern</span>
                    <textarea className="rhtext" value={r.notiz || ''} placeholder="Nur interne Notiz – erscheint NICHT in der Mandanten-Rückfragenliste" onChange={e => row(i)(x => { x.notiz = e.target.value })} />
                    <button className="del" title="Hinweis entfernen" onClick={() => row(i)(x => { delete x.notiz })}>×</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
      <button className="addbtn" onClick={addRow}>+ Position</button>
    </div>
  )
}

// ── Rechner-Ausgabe ───────────────────────────────────────────────────────────
function ErgebnisBox({ p, ctx, mutate }) {
  const mod = MODULE[p.modul]; if (!mod || !mod.rechnen) return null
  const r = mod.rechnen(p.werte, ctx)
  const buch = (r.buchungen || []).filter(b => b.betr > 0)
  const uebernehmen = () => mutate(d => {
    (r.buchungen || []).filter(b => b.betr > 0).forEach(b => { (d.buchungen || (d.buchungen = [])).push({ id: uid(), quelle: p.titel, ...b }) })
    const q = findP(d, p.id); if (q.status === 'offen') q.status = 'arbeit'
  })
  return (
    <div className="ergebnis">
      <h4>Berechnung</h4>
      {r.ergebnisse.map((e, i) => <div className="erow" key={i}><span>{e.l}</span><span><b>{eur(e.v)}</b></span></div>)}
      {r.total && <div className="erow total"><span>{r.total.l}</span><b>{eur(r.total.v)}</b></div>}
      {(r.hinweise || []).filter(Boolean).map((h, i) => <div className="ergHinweis" key={i}>{h}</div>)}
      {buch.length > 0 && (
        <div className="buchung"><div className="bh">Buchungsvorschlag</div>
          {buch.map((b, i) => <div className="bl" key={i}><span><span className="s">{b.s}</span> {b.st} {b.h ? <>an <span className="s">{b.h}</span> {b.ht}</> : null} <span style={{ color: '#64748b' }}>– {b.text}</span></span><span className="betr">{eur(b.betr)}</span></div>)}
        </div>
      )}
      {buch.length > 0 && <div className="ppactions"><button className="btn btn-sm btn-primary" onClick={uebernehmen}>Buchungsvorschlag in Stapel übernehmen</button><span className="jhint2">{buch.length} Buchung(en)</span></div>}
    </div>
  )
}

// ── Abstimmungs-Cockpit ───────────────────────────────────────────────────────
function sammleKonten(cl) {
  const out = []
  ;(cl.kategorien || []).forEach(k => { (k.punkte || []).forEach(p => { const w = p.werte || {}; const mod = MODULE[p.modul]
    const quelle = mod ? mod.name : (p.titel || '—')
    if (p.typ === 'B') { const konto = String(w.konto || (p.konten || [])[0] || '').trim()
      if (konto) out.push({ konto, bez: w.bez || p.titel || '', quelle, bereich: k.bereich || '_', done: p.status === 'ok', offen: 0, jump: { pid: p.id } }) }
    if (mod) modLists(mod).forEach(L => { (w[L.key] || []).forEach((row, i) => { if (!row) return
      const kf = (row.konto != null && row.konto !== '') ? 'konto' : ((row.buchungskonto != null && row.buchungskonto !== '') ? 'buchungskonto' : null)
      if (!kf) return; const konto = String(row[kf] || '').trim(); if (!konto) return
      const off = (Array.isArray(row.rueck) ? row.rueck : []).filter(r => !r.ok).length
      out.push({ konto, bez: row.bez || '', quelle, bereich: k.bereich || '_', done: !!(row.fertig || row.ok), offen: off, jump: { pid: p.id, list: L.key, i, k: kf } }) }) })
  }) })
  return out
}
function Abstimmung({ data, filter, setFilter, onJump }) {
  const konten = sammleKonten(data)
  const total = konten.length, done = konten.filter(x => x.done).length, offen = total - done
  const list = konten.filter(x => filter === 'alle' ? true : filter === 'ok' ? x.done : !x.done)
  const grp = {}, ord = []; list.forEach(x => { const b = x.bereich || '_'; if (!grp[b]) { grp[b] = []; ord.push(b) } grp[b].push(x) })
  const fbtn = (v, l, n) => <button className={'abstf' + (filter === v ? ' on' : '')} onClick={() => setFilter(v)}>{l}{n != null ? ` (${n})` : ''}</button>
  return (
    <div className="abstwrap">
      <div className="absthead">
        <div className="abststat"><b>{done}</b> / {total} abgestimmt · <b>{offen}</b> offen</div>
        <div className="abstfilters">{fbtn('offen', 'Offen', offen)}{fbtn('ok', 'Abgestimmt', done)}{fbtn('alle', 'Alle', total)}</div>
      </div>
      {total === 0 ? <div className="jhint" style={{ padding: '16px' }}>Noch keine Konten erfasst. Importiere eine SuSa (folgt) oder lege in den Modulen Konten an – dann erscheinen hier alle Konten zur Abstimmung.</div>
        : list.length === 0 ? <div className="jhint" style={{ padding: '16px' }}>Keine Konten in diesem Filter. 🎉</div>
          : ord.map(b => (
            <div className="abstgrp" key={b}>
              <h4 style={{ color: BEREICH_FARBE[b] || '#334155' }}>{VIEW_LABEL[b] || b}</h4>
              {grp[b].map((x, i) => { const stat = x.done ? 'ok' : (x.offen ? 'rueck' : 'offen'); const ic = x.done ? '✓' : (x.offen ? '●' : '○')
                return (
                  <div className={'abstrow ' + stat} key={i} onClick={() => onJump(x.bereich, x.jump.pid, x.jump.list, x.jump.i, x.jump.k)}>
                    <span className="abstic">{ic}</span>
                    <span className="abstk mono">{x.konto}</span>
                    <span className="abstbez">{x.bez}</span>
                    <span className="abstq">{x.quelle}{x.offen ? ` · ${x.offen} Rückfrage(n)` : ''}</span>
                    <span className="abstgo">→</span>
                  </div>
                )
              })}
            </div>
          ))}
    </div>
  )
}

// ── Modul-Picker ──────────────────────────────────────────────────────────────
function ModulPicker({ bereich, data, onAdd, onRemove, onClose }) {
  const vorhanden = new Set(alleP(data).map(p => p.modul).filter(Boolean))
  // Abgelöste Module werden nicht mehr angeboten. Sie bleiben in der Registry,
  // damit bereits angelegte Prüfpunkte weiter angezeigt werden.
  const list = Object.entries(MODULE).filter(([id, m]) => m.bereich === bereich && !m.veraltet)
  return (
    <div className="jac2-ov" onClick={e => { if (e.target.classList.contains('jac2-ov')) onClose() }}>
      <div className="jac2-modal">
        <div className="modal__h"><h2>Module: {VIEW_LABEL[bereich]}</h2><button className="x" onClick={onClose}>×</button></div>
        <div className="modal__b">
          <p className="jhint" style={{ marginBottom: '14px' }}>Wähle die Module, die du für „{VIEW_LABEL[bereich]}" brauchst. Jedes Modul erscheint danach als eigener Prüfpunkt.
            {' '}<span className="stand">überarbeitet</span> heißt: Fachlogik, Konten und Fundstellen sind auf dem angegebenen Stand geprüft.</p>
          <div className="modlist">
            {list.map(([id, m]) => { const on = vorhanden.has(id); const rechner = m.typ === 'C' && m.rechnen
              return (
                <div className={'moditem' + (on ? ' on' : '') + (m.stand ? ' neu' : '')} key={id}>
                  <div>
                    <div className="nm">{m.name}{m.stand && <span className="stand" style={{ marginLeft: 7 }}>überarbeitet {m.stand}</span>}</div>
                    <div className="ty">Typ {m.typ}{rechner ? ' · Rechner' : (m.custom ? ' · Fachmodul' : (m.hinweis ? ' · Vorlage' : ''))}</div>
                  </div>
                  {on ? <button className="add rem" onClick={() => onRemove(id)}>✓ drin · entfernen</button>
                    : <button className="add" onClick={() => onAdd(id)}>+ hinzufügen</button>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modul „Darlehen" ──────────────────────────────────────────────────────────
function darHints(d) {
  const z = (d.zweck || '').toLowerCase(); const h = []
  if (/fahrzeug|kfz|pkw|lkw|auto|transporter|wagen|sattel|zugmaschine/.test(z)) h.push({ t: 'Fahrzeugfinanzierung erkannt – Zugang im Anlagevermögen erfassen und private Kfz-Nutzung (1-%-Methode/Fahrtenbuch) prüfen.', act: 'kfz' })
  else if (/immobil|gebäude|gebaeude|grundstück|grundstueck|haus|halle|büro|buero|lager/.test(z)) h.push({ t: 'Immobilienfinanzierung – AfA und Kaufpreisaufteilung (Grund/Boden vs. Gebäude) beachten.', act: 'immo' })
  else if (/maschine|anlage|investit|gerät|geraet|ausstattung|einrichtung|photovolt|pv-/.test(z)) h.push({ t: 'Investition erkannt – Zugang im Anlagevermögen vorbereiten?', act: 'av' })
  if (!d.dVertrag) h.push({ t: 'Darlehensvertrag fehlt – beim Mandanten anfordern.' })
  if (!d.dTilgplan) h.push({ t: 'Tilgungsplan fehlt – für die Aufteilung Tilgung/Zins anfordern.' })
  if (!d.dSalden) h.push({ t: 'Saldenbestätigung der Bank zum Stichtag fehlt – einholen.' })
  if (num(d.zinsaufwand) > 0 && !d.pZinsen) h.push({ t: 'Zinsabgrenzung zum Stichtag prüfen (aufgelaufene, noch nicht gezahlte Zinsen → RAP / sonstige Verbindlichkeiten).' })
  if (num(d.restschuld) > 0 && !d.pFrist) h.push({ t: 'Kurzfristigen Tilgungsanteil (≤ 1 Jahr) für den Verbindlichkeitenspiegel ermitteln.' })
  return h
}
function Darlehen({ p, mutate, darOpen, setDarOpen }) {
  const list = Array.isArray(p.werte.darlehen) ? p.werte.darlehen : []
  const sRest = list.reduce((s, d) => s + num(d.restschuld), 0), sZins = list.reduce((s, d) => s + num(d.zinsaufwand), 0), sTilg = list.reduce((s, d) => s + num(d.tilgungWj), 0)
  const dar = (i) => (fn) => mutate(d => { const arr = findP(d, p.id).werte.darlehen; fn(arr[i], arr) })
  const add = () => { const nd = { id: uid(), status: 'offen', offen: [] }; mutate(d => { const w = findP(d, p.id).werte; if (!Array.isArray(w.darlehen)) w.darlehen = []; w.darlehen.push(nd) }); setDarOpen(nd.id) }
  const del = (i) => { if (!confirm('Dieses Darlehen wirklich entfernen?')) return; mutate(d => { findP(d, p.id).werte.darlehen.splice(i, 1) }); setDarOpen(null) }
  const aktion = (i, act) => mutate(d => {
    const cl = d; const q = findP(d, p.id); const dd = q.werte.darlehen[i]
    const addMod = (key, bereich) => { let m = alleP(cl).find(x => x.modul === key); if (!m) { const kat = ensureKat(cl, bereich); m = neuerModulPunkt(key); kat.punkte.push(m) } return m }
    const av = addMod('anlagevermoegen', 'aktiva'); if (!Array.isArray(av.werte.zugaenge)) av.werte.zugaenge = []
    av.werte.zugaenge = av.werte.zugaenge.filter(r => r && (r.bez || r.buchungskonto)); av.werte.zugaenge.push({ bez: (dd.zweck || dd.geber || 'Finanzierter Zugang') })
    if (act === 'kfz') addMod('kfz1prozent', 'ba')
    else if (act === 'immo') { (dd.offen || (dd.offen = [])).push('Immobilie: Kaufpreisaufteilung Grund/Boden ↔ Gebäude + AfA prüfen.') }
  })

  return (
    <>
      <div className="darkopf">
        <div className="darkpi"><small>Darlehen</small><b>{list.length}</b></div>
        <div className="darkpi"><small>Restschuld gesamt</small><b>{eur(sRest)}</b></div>
        <div className="darkpi"><small>Zinsen p.a.</small><b>{eur(sZins)}</b></div>
        <div className="darkpi"><small>Tilgung im WJ</small><b>{eur(sTilg)}</b></div>
        <div style={{ flex: 1 }} /><button className="btn btn-primary btn-sm" onClick={add}>+ Darlehen</button>
      </div>
      {list.length === 0 ? <div className="jhint" style={{ padding: '16px' }}>Noch keine Darlehen erfasst. Lege mit „+ Darlehen" das erste an – Details klappen bei Klick auf.</div>
        : <div className="darlist">{list.map((d, i) => <DarCard key={d.id || i} d={d} i={i} exp={d.id === darOpen} onExp={() => setDarOpen(darOpen === d.id ? null : d.id)} dar={dar(i)} del={() => del(i)} aktion={aktion} />)}</div>}
    </>
  )
}
function DarCard({ d, i, exp, onExp, dar, del, aktion }) {
  const st = STATUS[d.status || 'offen']; const n = v => v ? eur(num(v)) : '—'
  const F = (k, l, t) => t === 'sel'
    ? <label className="darf"><span>{l}</span><select value={d[k] || ''} onChange={e => dar(x => { x[k] = e.target.value })}><option value="">—</option>{[['kurz', 'kurzfristig (≤ 1 J.)'], ['lang', 'langfristig (> 1 J.)'], ['gemischt', 'teils/teils']].map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select></label>
    : <label className="darf"><span>{l}</span><input className={t === 'num' ? 'num' : ''} type={t === 'date' ? 'date' : 'text'} value={d[k] || ''} onChange={e => dar(x => { x[k] = e.target.value })} /></label>
  const CK = (k, l) => <label className={'darck' + (d[k] ? ' on' : '')}><input type="checkbox" checked={!!d[k]} onChange={e => dar(x => { x[k] = e.target.checked })} /><span>{l}</span></label>
  const hints = darHints(d); const offen = d.offen || []
  return (
    <div className={'darcard' + (exp ? ' open' : '')}>
      <div className="darhead" onClick={e => { if (e.target.closest('input,select,button,textarea,.dardetail')) return; onExp() }}>
        <span className={'darstat ' + st[0]} title={st[1]} />
        <div className="darmain"><b>{d.geber || '(Darlehensgeber?)'}</b><span className="darsub">{d.zweck || '—'}</span></div>
        <div className="darnums">
          <span><small>Restschuld</small><b>{n(d.restschuld)}</b></span>
          <span><small>Zins p.a.</small><b>{n(d.zinsaufwand)}</b></span>
          <span><small>Tilgung</small><b>{n(d.tilgungWj)}</b></span>
          <span><small>bis</small><b>{d.laufzeitBis || '—'}</b></span>
        </div>
        <span className="chev">▸</span>
      </div>
      {exp && (
        <div className="dardetail">
          <div className="darsec"><h6>Stammdaten</h6><div className="dargrid">{F('geber', 'Darlehensgeber')}{F('vertragsnr', 'Vertragsnummer')}{F('zweck', 'Verwendungszweck')}{F('vertragsdatum', 'Vertragsdatum', 'date')}{F('auszahlung', 'Auszahlungsdatum', 'date')}{F('laufzeitBis', 'Laufzeit bis', 'date')}{F('zinssatz', 'Zinssatz % p.a.', 'num')}</div></div>
          <div className="darsec"><h6>Finanzdaten</h6><div className="dargrid">{F('betrag', 'Ursprungsbetrag', 'num')}{F('restschuld', 'Restschuld 31.12.', 'num')}{F('tilgungWj', 'Tilgung im WJ', 'num')}{F('zinsaufwand', 'Zinsaufwand', 'num')}{F('sondertilgung', 'Sondertilgungen', 'num')}{F('art', 'Fristigkeit', 'sel')}</div></div>
          <div className="darsec"><h6>Unterlagen</h6><div className="darcks">{CK('dVertrag', 'Darlehensvertrag')}{CK('dTilgplan', 'Tilgungsplan')}{CK('dSalden', 'Saldenbestätigung')}</div></div>
          <div className="darsec"><h6>Prüfungen</h6><div className="darcks">{CK('pSaldo', 'Saldo mit Bank abgestimmt')}{CK('pTilgung', 'Tilgungen plausibel')}{CK('pZinsen', 'Zinsen vollständig')}{CK('pRestschuld', 'Restschuld plausibel')}{CK('pFrist', 'Fristigkeit geprüft')}{CK('pBesonder', 'Besonderheiten dokumentiert')}</div></div>
          {hints.length > 0 && (
            <div className="darsec"><h6>💡 Hinweise des Assistenten</h6><div className="darhints">{hints.map((h, hi) => (
              <div className="darhint" key={hi}><span>{h.t}</span><span className="darhintacts">{h.act && <button className="btn btn-sm" onClick={() => aktion(i, h.act)}>{h.act === 'kfz' ? '→ Kfz + Anlagevermögen' : '→ Anlagevermögen'}</button>}<button className="btn btn-sm" onClick={() => dar(x => { (x.offen || (x.offen = [])).push(h.t) })}>＋ als Punkt</button></span></div>
            ))}</div></div>
          )}
          <div className="darsec"><h6>Notiz</h6><textarea className="darnotiz" value={d.notiz || ''} placeholder="Bearbeitungsvermerk, Besonderheiten …" onChange={e => dar(x => { x.notiz = e.target.value })} /></div>
          <div className="darsec"><h6>📌 Offene Punkte</h6>{offen.map((o, oi) => (
            <div className="darofrow" key={oi}><input value={o} onChange={e => dar(x => { x.offen[oi] = e.target.value })} /><button className="del" onClick={() => dar(x => { x.offen.splice(oi, 1) })}>×</button></div>
          ))}<button className="addbtn" onClick={() => dar(x => { (x.offen || (x.offen = [])).push('') })}>+ offener Punkt</button></div>
          <div className="darfoot">
            <label className="darstatussel">Status&nbsp;<select value={d.status || 'offen'} onChange={e => dar(x => { x.status = e.target.value })}>{Object.keys(STATUS).map(s => <option key={s} value={s}>{STATUS[s][1]}</option>)}</select></label>
            <button className="linkdel" onClick={del}>🗑&nbsp;Darlehen entfernen</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Firmenfahrzeug (Unternehmer) – Custom-Render: Grundfragen + Methoden-Reiter ─
function BodyKfz({ p, ctx, mutate, setStatus }) {
  const w = p.werte
  const list = Array.isArray(w._pos) ? w._pos : []
  const methode = w.methodeAktiv || 'pauschal'
  const fUst = !!w.fUst
  const skr = w.skr === '04' ? '04' : '03'
  const KK = KFZ_KONTEN[skr]

  const setW = (k, v) => mutate(d => { findP(d, p.id).werte[k] = v })
  const veh = (i) => (fn) => mutate(d => { const arr = findP(d, p.id).werte._pos; if (arr && arr[i]) fn(arr[i], arr) })
  const addVeh = () => mutate(d => { const q = findP(d, p.id).werte; if (!Array.isArray(q._pos)) q._pos = []; q._pos.push({ art: 'verbrenner', methode, monate: '12' }) })
  const delVeh = (i) => mutate(d => { findP(d, p.id).werte._pos.splice(i, 1) })

  const rows = list.map((v, i) => ({ v, i })).filter(x => (x.v.methode || 'pauschal') === methode)

  return (
    <>
      <div className="kfz-grundfragen">
        <div className="kfz-gf">
          <div className="kfz-frage">1 · Umsatzsteuer</div>
          <div className="kfz-seg">
            <button className={'kfz-segbtn' + (fUst ? ' on' : '')} onClick={() => setW('fUst', true)}>vorsteuerabzugsberechtigt · USt ansetzen</button>
            <button className={'kfz-segbtn' + (!fUst ? ' on' : '')} onClick={() => setW('fUst', false)}>keine USt</button>
          </div>
        </div>
        <div className="kfz-gf">
          <div className="kfz-frage">2 · Methode</div>
          <div className="kfz-seg">
            <button className={'kfz-segbtn' + (methode === 'pauschal' ? ' on' : '')} onClick={() => setW('methodeAktiv', 'pauschal')}>1-%-Methode</button>
            <button className={'kfz-segbtn fb' + (methode === 'fahrtenbuch' ? ' on' : '')} onClick={() => setW('methodeAktiv', 'fahrtenbuch')}>Fahrtenbuch</button>
          </div>
        </div>
        <div className="kfz-gf">
          <div className="kfz-frage">3 · Kontenrahmen</div>
          <div className="kfz-seg">
            <button className={'kfz-segbtn' + (skr === '03' ? ' on' : '')} onClick={() => setW('skr', '03')}>SKR 03</button>
            <button className={'kfz-segbtn' + (skr === '04' ? ' on' : '')} onClick={() => setW('skr', '04')}>SKR 04</button>
          </div>
        </div>
      </div>

      {methode === 'fahrtenbuch' && (
        <div className="chips2" style={{ marginBottom: '14px' }}>
          {[['fFbOrdnung', 'Fahrtenbuch ordnungsgemäß (zeitnah, geschlossen, vollständig)'], ['fFbBelege', 'Gesamtkosten vollständig belegt (keine geschätzten Kraftstoffkosten)']].map(([k, l]) => (
            <div key={k} className={'chk' + (w[k] ? ' on' : '')} onClick={() => setW(k, !w[k])}><span className="bx">{w[k] ? '✓' : ''}</span>{l}</div>
          ))}
        </div>
      )}

      <div className="darkopf">
        <div className="darkpi"><small>Fahrzeuge · {methode === 'pauschal' ? '1-%-Methode' : 'Fahrtenbuch'}</small><b>{rows.length}</b></div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary btn-sm" onClick={addVeh}>+ Fahrzeug</button>
      </div>
      {rows.length === 0
        ? <div className="jhint" style={{ padding: '14px' }}>Noch kein Fahrzeug mit {methode === 'pauschal' ? '1-%-Methode' : 'Fahrtenbuch'}. Lege mit „+ Fahrzeug" eines an.</div>
        : <div className="darlist">{rows.map(({ v, i }) => <KfzCard key={i} v={v} i={i} methode={methode} fUst={fUst} veh={veh(i)} del={() => delVeh(i)} />)}</div>}

      <div className="darsec"><h6>Konten &amp; Buchung · SKR{skr}</h6><div className="dargrid">
        <KfzF wv={w} setW={setW} k="kEntnahme" l="Gegenkonto (Privat/Verrechnung)" def={KK.gegen} />
        {fUst && <KfzF wv={w} setW={setW} k="kErtragUst" l={'Kfz-Nutzung m. USt (' + KK.mitUst + ')'} def={KK.mitUst} />}
        <KfzF wv={w} setW={setW} k="kErtragOhneUst" l={'Kfz-Nutzung o. USt (' + KK.ohneUst + ')'} def={KK.ohneUst} />
        {fUst && <KfzF wv={w} setW={setW} k="kUst" l={'Umsatzsteuer 19 % (' + KK.ust + ')'} def={KK.ust} />}
      </div></div>
      <div className="darfoot">
        <label className="darstatussel">Status&nbsp;<select value={p.status} onChange={e => setStatus(e.target.value)}>{Object.keys(STATUS).map(s => <option key={s} value={s}>{STATUS[s][1]}</option>)}</select></label>
      </div>

      <ErgebnisBox p={p} ctx={ctx} mutate={mutate} />
    </>
  )
}
function KfzF({ wv, setW, k, l, def }) {
  return <label className="darf"><span>{l}</span><input className="mono" value={wv[k] == null ? '' : wv[k]} placeholder={def || ''} onChange={e => setW(k, e.target.value)} /></label>
}
function KfzCard({ v, i, methode, fUst, veh, del }) {
  const F = (k, l, t, opt) => {
    const val = v[k] == null ? '' : v[k]
    if (t === 'select') return <label className="darf"><span>{l}</span><select value={val} onChange={e => veh(x => { x[k] = e.target.value })}><option value="">—</option>{opt.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select></label>
    return <label className="darf"><span>{l}</span><input className={t === 'num' ? 'num' : ''} type={t === 'date' ? 'date' : 'text'} value={val} placeholder={k === 'monate' ? '12' : ''} onChange={e => veh(x => { x[k] = e.target.value })} /></label>
  }
  const art = v.art || 'verbrenner'
  const istE = art === 'elektro' || art === 'brennstoff' || art === 'hybrid'
  const artOpt = [['verbrenner', 'Verbrenner'], ['mildhybrid', 'Mild-Hybrid'], ['hybrid', 'Plug-in-Hybrid'], ['elektro', 'Elektro (BEV)'], ['brennstoff', 'Brennstoffzelle'], ['sonstiges', 'Sonstiges']]
  return (
    <div className="darcard open">
      <div className="dardetail" style={{ paddingTop: '4px' }}>
        <div className="kfzcardhead"><b>{v.bez || '(Fahrzeug / Kennzeichen?)'}</b><button className="linkdel" onClick={del}>🗑&nbsp;entfernen</button></div>
        <div className="darsec"><h6>Fahrzeug</h6><div className="dargrid">
          {F('bez', 'Fahrzeug / Kennzeichen', 'text')}
          {F('art', 'Antrieb', 'select', artOpt)}
          {F('betrAnteil', 'betriebl. Nutzung %', 'num')}
          {F('erstzulassung', 'Erstzulassung (BLP)', 'date')}
          {F('anschaffung', 'Anschaffung/Leasingbeginn', 'date')}
          {F('blp', 'Bruttolistenpreis', 'num')}
          {F('monate', 'Monate mit Privatnutzung', 'num')}
          {istE && F('reichweite', 'E-Reichweite km (Hybrid)', 'num')}
          {istE && F('co2', 'CO₂ g/km (Hybrid)', 'num')}
        </div></div>
        {methode === 'pauschal' ? (
          <>
            <div className="darsec"><h6>Wege &amp; Fahrten</h6><div className="dargrid">
              {F('entfernung', 'Entfernung Whg–Betrieb (km)', 'num')}
              {F('pendelTage', 'Pendeltage/Jahr', 'num')}
              {F('heimEntfernung', 'Familienheimfahrt km (dopp. HH)', 'num')}
              {F('heimFahrten', 'zusätzl. Heimfahrten (Anzahl)', 'num')}
            </div></div>
            <div className="darsec"><h6>Kostendeckelung{fUst ? ' · USt' : ''}</h6><div className="dargrid">
              {F('kosten', 'tats. Gesamtkosten (Deckelung)', 'num')}
              {fUst && F('kostenVst', 'davon vorsteuerbelastet', 'num')}
              {fUst && F('ustAnteil', 'USt-Privatanteil % (bei Deckelung)', 'num')}
            </div></div>
          </>
        ) : (
          <>
            <div className="darsec"><h6>Fahrtenbuch</h6><div className="dargrid">
              {F('kosten', 'Gesamtkosten (begünstigt)', 'num')}
              {fUst && F('kostenVst', 'davon vorsteuerbelastet', 'num')}
              {F('kmGesamt', 'Gesamt-km', 'num')}
              {F('kmPrivat', 'Privat-km', 'num')}
              {F('kmPendel', 'km Whg–Betrieb', 'num')}
            </div></div>
            <div className="darsec"><h6>Entfernungspauschale</h6><div className="dargrid">
              {F('entfernung', 'Entfernung Whg–Betrieb (km)', 'num')}
              {F('pendelTage', 'Pendeltage/Jahr', 'num')}
            </div></div>
          </>
        )}
      </div>
    </div>
  )
}
