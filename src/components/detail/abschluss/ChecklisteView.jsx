import { useState, useMemo, useEffect } from 'react'
import { PUNKT_STATUS, RISIKO_CONFIG, defaultCheckliste, blockSichtbar } from '../../../utils/checklisteConfig.js'
import { getEffectiveStruktur, saveStruktur } from '../../../utils/checklisteStruktur.js'
import PruefBlock, { computeBlockStats, getPunktPreview } from './PruefBlock.jsx'
import StrukturEditor from './StrukturEditor.jsx'
import ToolFahrzeuge from './ToolFahrzeuge.jsx'
import ToolDarlehen from './ToolDarlehen.jsx'
import ToolGesellschafter from './ToolGesellschafter.jsx'
import ToolVerbindlichkeiten from './ToolVerbindlichkeiten.jsx'
import ToolBewirtung from './ToolBewirtung.jsx'
import { PwbRechner, RapRechner, FremdwaehrungRechner } from './ToolPwbRap.jsx'
import ToolUst from './ToolUst.jsx'
import { ToolGewSt, ToolKSt } from './ToolSteuer.jsx'

function genRqId() { return 'rq' + Date.now().toString(36) + Math.random().toString(36).slice(2,5) }

// ── Export helper ────────────────────────────────────────────────────────────
function exportCheckliste(client, checkliste, struktur) {
  const year = client.veranlagungsjahr ?? ''
  const blockRelevanz = checkliste.blockRelevanz ?? {}
  const lines = []
  lines.push(`JAHRESABSCHLUSS-PRÜFPROTOKOLL – ${client.name} – VJ ${year}`)
  lines.push(`Exportiert: ${new Date().toLocaleDateString('de-DE')}`)
  lines.push('='.repeat(70))

  // Stats (Gesamtüberblick: offen = nicht nichtRelevant & nicht erledigt)
  let totalPunkte = 0, erledigtPunkte = 0, nichtRelevantPunkte = 0, offenPunkte = 0
  let fertigeBlöcke = 0
  struktur.forEach(b => {
    const isNein = blockRelevanz[b.id] === false
    const bs = computeBlockStats(b, checkliste.punkte ?? {}, isNein)
    totalPunkte      += bs.total
    erledigtPunkte   += bs.erledigt
    nichtRelevantPunkte += bs.nichtRelevant
    offenPunkte      += bs.offen
    if (isNein || (bs.total > 0 && bs.offen === 0)) fertigeBlöcke++
  })
  const pctGesamt = totalPunkte > 0 ? Math.round((erledigtPunkte + nichtRelevantPunkte) / totalPunkte * 100) : 0
  lines.push(`Prüffortschritt: ${pctGesamt}% (${erledigtPunkte} erledigt + ${nichtRelevantPunkte} nicht relevant von ${totalPunkte} Punkten)`)
  lines.push(`Offen: ${offenPunkte} Prüfpunkte | Fertige Blöcke: ${fertigeBlöcke}/${struktur.length}`)
  lines.push(`Offene Rückfragen: ${(checkliste.rueckfragen ?? []).filter(r => r.status === 'offen').length}`)
  lines.push('')

  // Relevante Blöcke (sortiert: JA+offen, JA+fertig, null+offen, null+fertig, dann NEIN im Anhang)
  const irrelevantBlocks = []
  struktur.forEach(b => {
    const bRelev = blockRelevanz[b.id]
    if (bRelev === false) {
      irrelevantBlocks.push(b)
      return
    }
    const bs = computeBlockStats(b, checkliste.punkte ?? {}, false)
    const fertig = bs.total > 0 && bs.offen === 0
    const statusLabel = fertig ? '✓ FERTIG' : `${bs.offen} offen`
    const relevantePunkte = b.punkte.filter(p => checkliste.punkte?.[`${b.id}_${p.id}`]?.relevant !== false)
    const irrelevantePunkte = b.punkte.filter(p => checkliste.punkte?.[`${b.id}_${p.id}`]?.relevant === false)
    lines.push(`── ${b.nr ?? ''} ${b.label} [${statusLabel} | ${bs.erledigt} erl. | ${bs.nichtRelevant} n.rel. | ${bs.total} ges.] ──`)
    relevantePunkte.forEach(p => {
      const d    = checkliste.punkte?.[`${b.id}_${p.id}`]
      const st   = d?.status ?? 'offen'
      const icon = PUNKT_STATUS[st]?.icon ?? '○'
      const preview = getPunktPreview(d)
      // Einträge aus neuen oder migrierten Daten lesen
      const eintraege = Array.isArray(d?.eintraege) && d.eintraege.length > 0
        ? d.eintraege
        : (preview.konto || preview.notiz ? [{ konto: preview.konto, notiz: preview.notiz }] : [])
      if (eintraege.length <= 1) {
        const e = eintraege[0]
        lines.push(`  [${icon}] ${p.label}${e?.konto ? ` | Kto: ${e.konto}` : ''}${d?.risiko ? ` | Risiko: ${d.risiko}` : ''}`)
        if (e?.notiz) lines.push(`       Notiz: ${e.notiz}`)
      } else {
        lines.push(`  [${icon}] ${p.label} (${eintraege.length} Einträge)${d?.risiko ? ` | Risiko: ${d.risiko}` : ''}`)
        eintraege.forEach((e, i) => {
          const kontoTeil = e.konto ? `Kto. ${e.konto}` : ''
          const notizTeil = e.notiz ? e.notiz : ''
          const sep = kontoTeil && notizTeil ? ' – ' : ''
          lines.push(`    ${i + 1}. ${kontoTeil}${sep}${notizTeil}`)
        })
      }
    })
    if (irrelevantePunkte.length > 0) {
      lines.push(`  (${irrelevantePunkte.length} Punkt(e) als nicht relevant markiert – siehe Anhang)`)
    }
    lines.push('')
  })

  // Rückfragen
  lines.push('── RÜCKFRAGEN ──')
  const rqs = checkliste.rueckfragen ?? []
  if (rqs.length === 0) {
    lines.push('(keine Rückfragen)')
  } else {
    rqs.forEach((rq, i) => {
      lines.push(`${i + 1}. [${rq.status === 'erledigt' ? '✓' : '○'}] ${rq.blockLabel} → ${rq.punktLabel}`)
      if (rq.konto) lines.push(`   Konto: ${rq.konto}`)
      if (rq.frage) lines.push(`   Frage: ${rq.frage}`)
    })
  }
  lines.push('')

  // Anhang: nicht relevante Blöcke und Punkte
  const hasIrrelevant = irrelevantBlocks.length > 0 || struktur.some(b => {
    if (blockRelevanz[b.id] === false) return false
    return b.punkte.some(p => checkliste.punkte?.[`${b.id}_${p.id}`]?.relevant === false)
  })
  if (hasIrrelevant) {
    lines.push('='.repeat(70))
    lines.push('ANHANG – NICHT RELEVANTE POSITIONEN')
    lines.push('')
    if (irrelevantBlocks.length > 0) {
      lines.push('Komplett ausgeschlossene Blöcke:')
      irrelevantBlocks.forEach(b => lines.push(`  ✕ ${b.nr ?? ''} ${b.label}`))
      lines.push('')
    }
    struktur.forEach(b => {
      if (blockRelevanz[b.id] === false) return
      const irrelevantePunkte = b.punkte.filter(p => checkliste.punkte?.[`${b.id}_${p.id}`]?.relevant === false)
      if (irrelevantePunkte.length === 0) return
      lines.push(`${b.nr ?? ''} ${b.label}:`)
      irrelevantePunkte.forEach(p => lines.push(`  ✕ ${p.label}`))
    })
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `Pruefprotokoll_${(client.mandantennummer || client.name).replace(/[^a-zA-Z0-9]/g,'_')}_${year}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Rückfragen-Panel ─────────────────────────────────────────────────────────
function RueckfragenPanel({ rueckfragen = [], onUpdate, onDelete }) {
  const [editId, setEditId] = useState(null)
  const [editFrage, setEditFrage] = useState('')
  const offen     = rueckfragen.filter(r => r.status === 'offen')
  const erledigt  = rueckfragen.filter(r => r.status === 'erledigt')

  function saveEdit(id) {
    onUpdate(id, { frage: editFrage })
    setEditId(null)
  }

  function RqRow({ rq }) {
    const isEdit = editId === rq.id
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '5px', background: rq.status === 'erledigt' ? 'rgba(22,163,74,0.03)' : 'var(--surface)', opacity: rq.status === 'erledigt' ? 0.65 : 1 }}>
        <button onClick={() => onUpdate(rq.id, { status: rq.status === 'erledigt' ? 'offen' : 'erledigt' })}
          style={{ fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: '2px', marginTop: '1px' }}>
          {rq.status === 'erledigt' ? '✅' : '⬜'}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600, marginBottom: '2px' }}>
            {rq.blockLabel} → {rq.punktLabel}
          </div>
          {rq.konto && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Kto. {rq.konto}</div>}
          {isEdit ? (
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <input autoFocus value={editFrage} onChange={e => setEditFrage(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit(rq.id)}
                style={{ flex: 1, padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }} />
              <button onClick={() => saveEdit(rq.id)} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>✓</button>
              <button onClick={() => setEditId(null)} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}>✕</button>
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: rq.frage ? 'var(--text)' : 'var(--text-muted)', fontStyle: rq.frage ? 'normal' : 'italic', marginTop: '2px' }}>
              {rq.frage || '(keine Frage hinterlegt – klicken zum Bearbeiten)'}
            </div>
          )}
        </div>
        {!isEdit && (
          <button onClick={() => { setEditId(rq.id); setEditFrage(rq.frage ?? '') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)', padding: '2px 4px', flexShrink: 0 }}>✏️</button>
        )}
        <button onClick={() => onDelete(rq.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#ef4444', opacity: 0.5, padding: '2px 4px', flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.opacity='1'} onMouseLeave={e => e.currentTarget.style.opacity='0.5'}>🗑</button>
      </div>
    )
  }

  return (
    <div style={{ padding: '14px', background: 'var(--surface2)', borderRadius: '10px', border: '1px solid rgba(217,119,6,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '16px' }}>❓</span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>Rückfragen ({offen.length} offen)</span>
        {erledigt.length > 0 && <span style={{ fontSize: '11px', color: '#16a34a' }}>· {erledigt.length} erledigt</span>}
      </div>
      {rueckfragen.length === 0 && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Keine Rückfragen erfasst. Öffne einen Prüfpunkt und klicke auf „Rückfrage hinzufügen".</div>
      )}
      {offen.map(rq => <RqRow key={rq.id} rq={rq} />)}
      {erledigt.length > 0 && offen.length > 0 && <div style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '8px 0 4px', fontWeight: 600 }}>Erledigte Rückfragen</div>}
      {erledigt.map(rq => <RqRow key={rq.id} rq={rq} />)}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function ChecklisteView({ client, onUpdate }) {
  const checkliste = useMemo(() => ({ ...defaultCheckliste(), ...(client.abschluss?.checkliste ?? {}) }), [client.abschluss?.checkliste])
  const [showAlleBlocks, setShowAlleBlocks]   = useState(false)
  const [showRueckfragen, setShowRueckfragen] = useState(false)
  const [showStrukturEditor, setShowStrukturEditor] = useState(false)

  // Aktuelle Struktur aus localStorage (global, mandantenübergreifend)
  const [struktur, setStruktur] = useState(() => getEffectiveStruktur())

  // Struktur nach Editor-Änderung neu laden
  function handleStrukturChange(neueStruktur) {
    saveStruktur(neueStruktur)
    setStruktur(neueStruktur)
  }

  // ── Block-Relevanz ───────────────────────────────────────────────────────
  const blockRelevanz = checkliste.blockRelevanz ?? {}

  function setBlockRelevanz(blockId, value) {
    saveCheckliste({ blockRelevanz: { ...blockRelevanz, [blockId]: value } })
  }

  // ── Update helpers ───────────────────────────────────────────────────────
  function saveCheckliste(patch) {
    const next = { ...checkliste, ...patch }
    onUpdate({ abschluss: { ...(client.abschluss ?? {}), checkliste: next } })
  }

  function setPunktData(blockId, punktId, changes) {
    const key = `${blockId}_${punktId}`
    const cur = checkliste.punkte?.[key] ?? {}
    saveCheckliste({ punkte: { ...checkliste.punkte, [key]: { ...cur, ...changes } } })
  }

  function addRueckfrage({ blockId, punktId, punktLabel, konto, notiz }) {
    const block = struktur.find(b => b.id === blockId)
    const rq = {
      id: genRqId(),
      blockId, punktId,
      blockLabel: block ? `${block.nr ?? ''} ${block.label}`.trim() : blockId,
      punktLabel,
      konto: konto ?? '',
      frage: notiz ?? '',
      status: 'offen',
      erstelltAm: new Date().toISOString(),
    }
    saveCheckliste({ rueckfragen: [...(checkliste.rueckfragen ?? []), rq] })
    setShowRueckfragen(true)
  }

  function updateRueckfrage(id, changes) {
    saveCheckliste({ rueckfragen: (checkliste.rueckfragen ?? []).map(r => r.id === id ? { ...r, ...changes } : r) })
  }

  function deleteRueckfrage(id) {
    saveCheckliste({ rueckfragen: (checkliste.rueckfragen ?? []).filter(r => r.id !== id) })
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  // Fortschritt basiert auf echter Abschlusslogik:
  // offen   = relevant !== false UND nicht erledigt
  // abgeschlossen = erledigt ODER relevant === false (inkl. ganzer NEIN-Block)
  const stats = useMemo(() => {
    let total = 0, erledigt = 0, geprueft = 0, rueckfrage = 0, highRisk = 0
    let nichtRelevant = 0, offen = 0, fertigeBlöcke = 0
    struktur.forEach(b => {
      const isNein = blockRelevanz[b.id] === false
      const bs = computeBlockStats(b, checkliste.punkte ?? {}, isNein)
      total         += bs.total
      erledigt      += bs.erledigt
      nichtRelevant += bs.nichtRelevant
      offen         += bs.offen
      if (isNein || (bs.total > 0 && bs.offen === 0)) fertigeBlöcke++
      // geprueft + rueckfrage + highRisk: nur auf nicht-NEIN-Punkte
      if (!isNein) {
        b.punkte.forEach(p => {
          const d = checkliste.punkte?.[`${b.id}_${p.id}`]
          if (d?.relevant === false) return
          if (d?.status === 'geprueft')   geprueft++
          if (d?.status === 'rueckfrage') rueckfrage++
          if (d?.risiko  === 'hoch')      highRisk++
        })
      }
    })
    // Fortschritt = (erledigt + nichtRelevant) / total
    const pct = total > 0 ? Math.round((erledigt + nichtRelevant) / total * 100) : 0
    const offeneRq = (checkliste.rueckfragen ?? []).filter(r => r.status === 'offen').length
    return { total, erledigt, geprueft, rueckfrage, highRisk, pct, offeneRq, nichtRelevant, offen, fertigeBlöcke }
  }, [checkliste.punkte, checkliste.rueckfragen, checkliste.blockRelevanz, struktur])

  // ── Block visibility + Sortierung ───────────────────────────────────────
  // Reihenfolge:
  //  0 = JA + offen   (relevante, noch offene Arbeit)
  //  1 = JA + fertig  (relevante, vollständig erledigt)
  //  2 = null + offen (unentschieden, noch offen)
  //  3 = null + fertig (unentschieden, aber faktisch fertig)
  //  4 = NEIN         (nicht relevant, ganz unten)
  // Innerhalb jeder Stufe bleibt die fachliche Reihenfolge erhalten.
  function blockSortScore(block) {
    const r = blockRelevanz[block.id]
    if (r === false) return 4
    const bs = computeBlockStats(block, checkliste.punkte ?? {}, false)
    const fertig = bs.total > 0 && bs.offen === 0
    if (r === true)  return fertig ? 1 : 0
    return fertig ? 3 : 2
  }

  const visibleBlocks = useMemo(() => {
    const filtered = struktur.filter(b => showAlleBlocks || blockSichtbar(b, client))
    return [...filtered].sort((a, b) => blockSortScore(a) - blockSortScore(b))
  }, [showAlleBlocks, client, struktur, checkliste.blockRelevanz, checkliste.punkte])

  // ── Tool renderer per block ───────────────────────────────────────────────
  function renderTools(block) {
    const tools = []
    if (block.hasFahrzeugeTool) tools.push(
      <ToolFahrzeuge key="fz" data={checkliste.fahrzeuge ?? []} onChange={v => saveCheckliste({ fahrzeuge: v })} />
    )
    if (block.hasDarlehenTool) tools.push(
      <ToolDarlehen key="dl" data={checkliste.darlehen ?? []} onChange={v => saveCheckliste({ darlehen: v })} />
    )
    if (block.hasGesellschafterTool) tools.push(
      <ToolGesellschafter key="gs"
        data={checkliste.gesellschafter ?? []}
        zinsrechner={checkliste.zinsrechner ?? {}}
        ugRuecklage={checkliste.ugRuecklage ?? {}}
        onChangeList={v => saveCheckliste({ gesellschafter: v })}
        onChangeZins={v => saveCheckliste({ zinsrechner: v })}
        onChangeUg={v => saveCheckliste({ ugRuecklage: v })}
      />
    )
    if (block.hasVerbindlichkeitenTool) tools.push(
      <ToolVerbindlichkeiten key="vb" data={checkliste.verbindlichkeiten ?? {}} onChange={v => saveCheckliste({ verbindlichkeiten: v })} />
    )
    if (block.hasBewirtungTool) tools.push(
      <ToolBewirtung key="bew" data={checkliste.bewirtung ?? {}} onChange={v => saveCheckliste({ bewirtung: v })} />
    )
    if (block.hasPwbTool) tools.push(
      <PwbRechner key="pwb" data={checkliste.pwb ?? {}} onChange={v => saveCheckliste({ pwb: v })} />
    )
    if (block.hasRapAktivTool) tools.push(
      <RapRechner key="rapA" title="📋 Aktiver RAP-Rechner" data={checkliste.rapAktiv ?? {}} onChange={v => saveCheckliste({ rapAktiv: v })} />
    )
    if (block.hasFremdwaehrungTool) tools.push(
      <FremdwaehrungRechner key="fw" data={checkliste.fremdwaehrung ?? {}} onChange={v => saveCheckliste({ fremdwaehrung: v })} />
    )
    if (block.hasRapPassivTool) tools.push(
      <RapRechner key="rapP" title="📋 Passiver RAP-Rechner" data={checkliste.rapPassiv ?? {}} onChange={v => saveCheckliste({ rapPassiv: v })} />
    )
    if (block.hasUstTool) tools.push(
      <ToolUst key="ust" data={checkliste.ust ?? {}} onChange={v => saveCheckliste({ ust: v })} />
    )
    if (block.hasGewstTool) tools.push(
      <ToolGewSt key="gwst" data={checkliste.gewst ?? {}} onChange={v => saveCheckliste({ gewst: v })} />
    )
    if (block.hasKstTool) tools.push(
      <ToolKSt key="kst" data={checkliste.kst ?? {}} onChange={v => saveCheckliste({ kst: v })} />
    )
    if (block.hasZinsrechnerTool || block.hasUgRuecklageTool) return null // handled in Gesellschafter tool
    return tools.length > 0 ? <>{tools}</> : null
  }

  const pctColor = stats.pct >= 80 ? '#16a34a' : stats.pct >= 50 ? '#d97706' : '#2563eb'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* ── Struktur-Editor Modal ── */}
      {showStrukturEditor && (
        <StrukturEditor
          struktur={struktur}
          onChange={handleStrukturChange}
          onClose={() => setShowStrukturEditor(false)}
        />
      )}

      {/* ── Progress Header ── */}
      <div style={{ padding: '14px 16px', background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700 }}>Prüffortschritt</span>
              <span style={{ fontSize: '20px', fontWeight: 800, color: pctColor }}>{stats.pct}%</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(relevante Punkte)</span>
            </div>
            <div style={{ height: '6px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${stats.pct}%`, background: pctColor, borderRadius: '4px', transition: 'width 0.4s' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {[
              { label: 'Offen',          val: stats.offen,         color: '#2563eb', badge: stats.offen > 0 },
              { label: 'Erledigt',       val: stats.erledigt,      color: '#16a34a' },
              { label: 'Nicht relev.',   val: stats.nichtRelevant, color: '#94a3b8' },
              { label: 'Blöcke fertig',  val: `${stats.fertigeBlöcke}/${struktur.length}`, color: stats.fertigeBlöcke === struktur.length ? '#16a34a' : '#2563eb' },
              { label: 'Rückfragen',     val: stats.rueckfrage,    color: '#d97706', badge: stats.rueckfrage > 0 },
              { label: 'High Risk',      val: stats.highRisk,      color: '#dc2626', badge: stats.highRisk > 0 },
              { label: 'Offene RQ',      val: stats.offeneRq,      color: '#d97706', badge: stats.offeneRq > 0 },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', padding: '6px 10px', background: s.badge && s.val > 0 ? `${s.color}14` : 'var(--surface)', borderRadius: '8px', border: `1px solid ${s.badge && s.val > 0 ? s.color + '44' : 'var(--border)'}`, minWidth: '60px' }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: s.val > 0 ? s.color : 'var(--text-muted)' }}>{s.val}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => setShowRueckfragen(r => !r)}
            style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '20px', cursor: 'pointer', fontWeight: showRueckfragen ? 700 : 400,
              border: `1px solid ${showRueckfragen ? '#d97706' : 'var(--border)'}`,
              background: showRueckfragen ? 'rgba(217,119,6,0.1)' : 'transparent',
              color: showRueckfragen ? '#d97706' : 'var(--text-muted)' }}>
            ❓ Rückfragen {stats.offeneRq > 0 ? `(${stats.offeneRq})` : ''}
          </button>
          <button onClick={() => setShowAlleBlocks(a => !a)}
            style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '20px', cursor: 'pointer',
              border: `1px solid ${showAlleBlocks ? 'var(--accent)' : 'var(--border)'}`,
              background: showAlleBlocks ? 'rgba(37,99,235,0.1)' : 'transparent',
              color: showAlleBlocks ? 'var(--accent)' : 'var(--text-muted)' }}>
            {showAlleBlocks ? '👁 Alle Blöcke' : '👁 Nur relevante Blöcke'}
          </button>
          <button onClick={() => setShowStrukturEditor(true)}
            style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '20px', cursor: 'pointer',
              border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)' }}>
            ✏️ Struktur bearbeiten
          </button>
          <button onClick={() => exportCheckliste(client, checkliste, struktur)}
            style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '20px', cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            📄 Prüfprotokoll exportieren
          </button>
        </div>
      </div>

      {/* ── Rückfragen-Panel ── */}
      {showRueckfragen && (
        <RueckfragenPanel
          rueckfragen={checkliste.rueckfragen ?? []}
          onUpdate={updateRueckfrage}
          onDelete={deleteRueckfrage}
        />
      )}

      {/* ── Block-Liste ── */}
      {visibleBlocks.map(block => (
        <PruefBlock
          key={block.id}
          blockCfg={block}
          allPunkteData={checkliste.punkte ?? {}}
          blockRelevanz={blockRelevanz[block.id] ?? null}
          onSetBlockRelevanz={value => setBlockRelevanz(block.id, value)}
          onUpdatePunkt={setPunktData}
          onAddRueckfrage={addRueckfrage}
          toolContent={renderTools(block)}
          rechnerData={client.rechner ?? []}
          onRechnerUpdate={newList => onUpdate({ rechner: newList })}
        />
      ))}

      {!showAlleBlocks && visibleBlocks.length < struktur.length && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px', fontStyle: 'italic' }}>
          {struktur.length - visibleBlocks.length} Block(e) ausgeblendet (nicht relevant für diese Rechtsform / Gewinnermittlung).
          <button onClick={() => setShowAlleBlocks(true)} style={{ marginLeft: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '12px', textDecoration: 'underline' }}>Alle anzeigen</button>
        </div>
      )}
    </div>
  )
}
