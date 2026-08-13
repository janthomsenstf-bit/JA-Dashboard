import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import EStAuftragSections from './src/components/detail/EStSections.jsx'

function Demo() {
  const [au, setAu] = useState({
    typ: 'est',
    estVeranlagungsjahr: 2025,
    estVeranlagungsart: 'zusammen',
    estEhepartner: { name: 'Mette Sørensen', idNr: '' },
    estSteuerId: '',
    estSteuernummer: '',
    estEinkunftsarten: ['Nichtselbständige Arbeit', 'Vermietung und Verpachtung'],
    estAnlagen: ['Anlage N', 'Anlage Kind', 'Außergewöhnliche Belastungen', 'Anlage V'],
    estAnlagenData: {
      'Anlage N': {
        positionen: [
          { id: 'p1', label: 'Entfernungspauschale / Fahrten', betrag: '1.840,00' },
          { id: 'p2', label: 'Arbeitsmittel', betrag: '320,50' },
          { id: 'p3', label: 'Fortbildung', betrag: '650,00' },
        ],
        rueckfragen: [{ id: 'rf1', text: 'Wie viele Arbeitstage im Büro vs. Homeoffice?', erledigt: false }],
        fehlend: [{ id: 'fu1', label: 'Fahrtenaufstellung / Kilometer', checked: false }],
        hinweise: '',
      },
      'Anlage Kind': {
        kinder: [
          { id: 'k1', name: 'Lars Sørensen', geburt: '2004-05-12', steuerId: '', kindergeld: true, grund: 'Studium' },
          { id: 'k2', name: 'Emma Sørensen', geburt: '2015-09-03', steuerId: '', kindergeld: true, grund: '' },
        ],
        rueckfragen: [{ id: 'rf2', text: 'Immatrikulationsbescheinigung für Lars vorhanden?', erledigt: false }],
        fehlend: [{ id: 'fu2', label: 'Studienbescheinigung Lars', checked: false }],
        hinweise: 'Lars studiert seit WS 2023 in Kiel.',
      },
      'Außergewöhnliche Belastungen': {
        positionen: [
          { id: 'p4', label: 'Krankheitskosten', betrag: '1.240,00' },
          { id: 'p5', label: 'Zahnersatz (Eigenanteil)', betrag: '890,00' },
        ],
        rueckfragen: [],
        fehlend: [{ id: 'fu3', label: 'Rezepte / Rechnungen Apotheke', checked: false }],
        hinweise: '',
      },
    },
    estErgebnis: { art: 'erstattung', betrag: '' },
    estUebermittlung: ['ELSTER'],
    estWorkflowStatus: 'unterlagen_erhalten',
    estWorkflowStatusDatum: '2026-07-14',
    eilig: true,
    eiligBis: '2026-08-15',
    frist: '2027-02-28',
    estNotiz: '',
  })
  const onUpdate = patch => setAu(a => ({ ...a, ...patch }))

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 20 }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
        Lokale Vorschau · Einkommensteuer-Auftrag (aufgeklappt) · Demo-Daten
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '14px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, paddingBottom:10, borderBottom:'1px solid var(--border)' }}>
          <span style={{ fontSize:18 }}>🧑‍💼</span>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>Einkommensteuer {au.estVeranlagungsjahr}</div>
            <div style={{ display:'flex', gap:5, marginTop:3 }}>
              <span style={{ fontSize:10, fontWeight:600, color:'#4f46e5', background:'rgba(79,70,229,0.08)', padding:'1px 6px', borderRadius:8, border:'1px solid rgba(79,70,229,0.25)' }}>Einkommensteuer</span>
            </div>
          </div>
        </div>
        <EStAuftragSections au={au} onUpdate={onUpdate} />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<Demo />)
