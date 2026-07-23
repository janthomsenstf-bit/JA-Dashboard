
import { useState } from 'react';

export interface FeldDef {
  key: string;
  label: string;
  typ?: 'text' | 'textarea' | 'select' | 'tel' | 'email' | 'url';
  optionen?: { value: string; label: string }[];
  pflicht?: boolean;
  spalte?: 1 | 2; // für 2-spaltiges Layout
}

interface EntityModalProps {
  titel: string;
  felder: FeldDef[];
  initial: Record<string, any>;
  onSpeichern: (werte: Record<string, any>) => void;
  onSchliessen: () => void;
}

export default function EntityModal({ titel, felder, initial, onSpeichern, onSchliessen }: EntityModalProps) {
  const [werte, setWerte] = useState<Record<string, any>>(initial);
  const [fehler, setFehler] = useState<string | null>(null);

  const setze = (key: string, val: any) => setWerte(prev => ({ ...prev, [key]: val }));

  const speichern = () => {
    const fehlend = felder.filter(f => f.pflicht && !String(werte[f.key] || '').trim());
    if (fehlend.length > 0) {
      setFehler(`Bitte ausfüllen: ${fehlend.map(f => f.label).join(', ')}`);
      return;
    }
    onSpeichern(werte);
  };

  return (
    <div
      onClick={onSchliessen}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '600px',
          maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #f0f0f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, backgroundColor: 'white', borderRadius: '12px 12px 0 0',
        }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text)' }}>{titel}</h2>
          <button onClick={onSchliessen} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#999' }}>×</button>
        </div>

        {/* Felder */}
        <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {felder.map(f => (
            <div key={f.key} style={{ gridColumn: f.typ === 'textarea' || f.spalte === undefined ? '1 / -1' : 'auto' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '5px' }}>
                {f.label}{f.pflicht && <span style={{ color: '#f44336' }}> *</span>}
              </label>
              {f.typ === 'textarea' ? (
                <textarea
                  value={werte[f.key] || ''}
                  onChange={e => setze(f.key, e.target.value)}
                  rows={3}
                  style={inputStyle}
                />
              ) : f.typ === 'select' ? (
                <select value={werte[f.key] || ''} onChange={e => setze(f.key, e.target.value)} style={inputStyle}>
                  <option value="">— wählen —</option>
                  {f.optionen?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input
                  type={f.typ === 'email' ? 'email' : f.typ === 'tel' ? 'tel' : f.typ === 'url' ? 'url' : 'text'}
                  value={werte[f.key] || ''}
                  onChange={e => setze(f.key, e.target.value)}
                  style={inputStyle}
                />
              )}
            </div>
          ))}
        </div>

        {fehler && (
          <div style={{ margin: '0 24px 16px 24px', padding: '10px 12px', backgroundColor: '#fee', color: '#c00', borderRadius: '6px', fontSize: '13px' }}>
            {fehler}
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: '10px', justifyContent: 'flex-end',
          position: 'sticky', bottom: 0, backgroundColor: 'white', borderRadius: '0 0 12px 12px',
        }}>
          <button onClick={onSchliessen} style={{ padding: '10px 20px', backgroundColor: 'transparent', color: '#666', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
            Abbrechen
          </button>
          <button onClick={speichern} style={{ padding: '10px 24px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: '6px',
  fontSize: '14px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical',
};
