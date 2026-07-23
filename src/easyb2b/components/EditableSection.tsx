
import { useState, type ReactNode } from 'react';

interface EditableSectionProps<T extends Record<string, any>> {
  /** Überschrift der Section (z.B. „Beschreibung") */
  titel?: string;
  /** Soll der Stift sichtbar sein? Default true */
  istBearbeitbar?: boolean;
  /** Anfangswerte beim Öffnen des Edit-Modus */
  startWerte: T;
  /** Render-Funktion. Bekommt aktuelle Werte, Setter und ob im Edit-Modus. */
  rendere: (werte: T, setWert: <K extends keyof T>(key: K, v: T[K]) => void, istEdit: boolean) => ReactNode;
  /** Wird beim Klick auf „Speichern" mit den aktuellen Werten aufgerufen */
  beimSpeichern: (werte: T) => void;
  /** Optional: zusätzlich beim Abbrechen aufgerufen */
  beimAbbrechen?: () => void;
  /** Variante: 'voll' (große Sektion) oder 'kompakt' (Sidebar-Card) */
  variante?: 'voll' | 'kompakt';
  /** Hintergrund der Section */
  hintergrund?: string;
}

export default function EditableSection<T extends Record<string, any>>({
  titel, istBearbeitbar = true, startWerte, rendere, beimSpeichern, beimAbbrechen,
  variante = 'voll', hintergrund,
}: EditableSectionProps<T>) {
  const [istEdit, setIstEdit] = useState(false);
  const [werte, setWerte] = useState<T>(startWerte);
  const [gespeichertHervorhebung, setGespeichertHervorhebung] = useState(false);

  const setWert = <K extends keyof T>(key: K, v: T[K]) => {
    setWerte(prev => ({ ...prev, [key]: v }));
  };

  const oeffneEdit = () => {
    setWerte(startWerte); // immer mit aktuellen Werten starten
    setIstEdit(true);
  };

  const abbrechen = () => {
    setWerte(startWerte);
    setIstEdit(false);
    beimAbbrechen?.();
  };

  const speichern = () => {
    beimSpeichern(werte);
    setIstEdit(false);
    setGespeichertHervorhebung(true);
    setTimeout(() => setGespeichertHervorhebung(false), 1200);
  };

  const titelStyle: React.CSSProperties = variante === 'kompakt'
    ? { fontSize: '11px', fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.5px' }
    : { fontSize: '12px', fontWeight: 700, color: '#003366', textTransform: 'uppercase', letterSpacing: '0.5px' };

  return (
    <div
      style={{
        marginBottom: variante === 'voll' ? '20px' : '16px',
        backgroundColor: hintergrund,
        padding: hintergrund ? '14px' : 0,
        borderRadius: hintergrund ? '10px' : 0,
        boxShadow: gespeichertHervorhebung ? '0 0 0 2px #4CAF50' : undefined,
        transition: 'box-shadow 0.3s ease',
      }}
    >
      {/* Header */}
      {(titel || istBearbeitbar) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          {titel ? <h3 style={{ margin: 0, ...titelStyle }}>{titel}</h3> : <span />}
          {istBearbeitbar && !istEdit && (
            <button
              onClick={oeffneEdit}
              title="Bearbeiten"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: '13px', color: '#666', padding: '4px 8px', borderRadius: '4px',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f0f4ff'; e.currentTarget.style.color = '#003366'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#666'; }}
            >
              ✏️ <span style={{ fontSize: '11px' }}>Bearbeiten</span>
            </button>
          )}
        </div>
      )}

      {/* Inhalt */}
      <div>
        {rendere(werte, setWert, istEdit)}
      </div>

      {/* Save / Cancel */}
      {istEdit && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
          <button
            onClick={speichern}
            style={{ padding: '8px 16px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}
          >
            💾 Speichern
          </button>
          <button
            onClick={abbrechen}
            style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#555', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
          >
            Abbrechen
          </button>
        </div>
      )}
    </div>
  );
}

// ─── HILFS-STYLES für Inputs in Edit-Modus ────────────────────

export const editInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #ccc',
  borderRadius: '6px',
  fontSize: '13px',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  backgroundColor: 'white',
  color: '#333',
};

export const editTextareaStyle: React.CSSProperties = {
  ...editInputStyle,
  minHeight: '80px',
  resize: 'vertical',
  lineHeight: 1.5,
};

export const editLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: '#555',
  marginBottom: '4px',
  marginTop: '8px',
};
