
import { useState } from 'react';
import {
  BEREICHE_META, SCORE_LEVEL_META,
  type KlaerungsStand, type KlaerungsPunkt, type KlaerungsTyp,
} from '@easyb2b/lib/klaerungsstand';

interface KlaerungsBoxProps {
  stand: KlaerungsStand;
  typ: KlaerungsTyp;
  /** Wenn nicht angegeben, ist die Box read-only. */
  onBestaetigen?: (punktId: string, notiz?: string) => void;
  onEntfernen?: (punktId: string) => void;
  /** Variante: 'voll' (Standard, mit Bereichen) oder 'kompakt' (nur Score + Liste) */
  variante?: 'voll' | 'kompakt';
  /** Wenn true: zeigt den „Vorschau auf Marktplatz" Hinweis bei Anfragen */
  zeigeVorschauHinweis?: boolean;
}

export default function KlaerungsBox({ stand, typ, onBestaetigen, onEntfernen, variante = 'voll', zeigeVorschauHinweis }: KlaerungsBoxProps) {
  const meta = SCORE_LEVEL_META[stand.scoreLevel];

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', backgroundColor: meta.bg, borderBottom: `1px solid ${meta.color}30`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ✓ Von Easy-B2B geklärte Punkte
          </div>
          <div style={{ fontSize: '14px', color: meta.color, marginTop: '3px', fontWeight: 600 }}>
            {meta.label}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: meta.color, opacity: 0.7 }}>Klärungsgrad</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: meta.color, lineHeight: 1 }}>{stand.score}%</div>
          </div>
          <ScoreCircle score={stand.score} color={meta.color} />
        </div>
      </div>

      {/* Bereiche */}
      <div style={{ padding: variante === 'voll' ? '14px 18px' : '12px 14px' }}>
        {zeigeVorschauHinweis && (
          <div style={{ marginBottom: '12px', padding: '8px 12px', backgroundColor: '#f0f4ff', borderRadius: '6px', fontSize: '11px', color: '#003366' }}>
            💡 Diese Punkte signalisieren Interessenten, dass die Anfrage durchdacht ist und sich ihre Zeit lohnt.
          </div>
        )}

        {stand.bereiche.map(({ bereich, punkte, erfuellt, gesamt }) => {
          const bMeta = BEREICHE_META[bereich];
          return (
            <BereichBlock
              key={bereich}
              icon={bMeta.icon}
              label={bMeta.label}
              erfuellt={erfuellt}
              gesamt={gesamt}
              punkte={punkte}
              typ={typ}
              onBestaetigen={onBestaetigen}
              onEntfernen={onEntfernen}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── BEREICH-BLOCK ────────────────────────────────────────────

function BereichBlock({ icon, label, erfuellt, gesamt, punkte, typ, onBestaetigen, onEntfernen }: {
  icon: string; label: string; erfuellt: number; gesamt: number; punkte: KlaerungsPunkt[];
  typ: KlaerungsTyp;
  onBestaetigen?: (punktId: string, notiz?: string) => void;
  onEntfernen?: (punktId: string) => void;
}) {
  const alleErfuellt = erfuellt === gesamt;
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#003366' }}>
          {icon} {label}
        </div>
        <div style={{ fontSize: '11px', color: alleErfuellt ? '#2e7d32' : '#888', fontWeight: 600 }}>
          {erfuellt} / {gesamt} geklärt
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {punkte.map(p => (
          <PunktZeile key={p.id} punkt={p} typ={typ} onBestaetigen={onBestaetigen} onEntfernen={onEntfernen} />
        ))}
      </div>
    </div>
  );
}

// ─── PUNKT-ZEILE ──────────────────────────────────────────────

function PunktZeile({ punkt: p, onBestaetigen, onEntfernen }: {
  punkt: KlaerungsPunkt;
  typ: KlaerungsTyp;
  onBestaetigen?: (punktId: string, notiz?: string) => void;
  onEntfernen?: (punktId: string) => void;
}) {
  const [editOffen, setEditOffen] = useState(false);
  const [notiz, setNotiz] = useState('');

  const isReadOnly = !onBestaetigen;
  const istErfuelltDaten = p.erfuellt && !p.manuellBestaetigt;
  const istErfuelltManuell = p.erfuellt && p.manuellBestaetigt;

  const symbolColor =
    istErfuelltManuell ? '#1565C0' :
    istErfuelltDaten   ? '#2e7d32' :
    '#bbb';
  const symbol = p.erfuellt ? '✓' : '○';
  const titelColor = p.erfuellt ? '#333' : '#999';

  return (
    <div>
      <div
        title={!p.erfuellt && p.hinweis ? p.hinweis : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', fontSize: '13px' }}
      >
        <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: p.erfuellt ? symbolColor : 'transparent', border: p.erfuellt ? 'none' : `2px solid ${symbolColor}`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
          {p.erfuellt ? symbol : ''}
        </span>
        <span style={{ flex: 1, color: titelColor }}>{p.titel}</span>
        {istErfuelltManuell && <span style={{ fontSize: '10px', color: '#1565C0', fontWeight: 600 }}>manuell</span>}

        {!isReadOnly && (
          <>
            {p.manuellBestaetigt ? (
              <button
                onClick={() => onEntfernen?.(p.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', color: '#999', padding: '2px 6px' }}
                title="Bestätigung entfernen"
              >
                ✕
              </button>
            ) : !p.erfuellt ? (
              <button
                onClick={() => setEditOffen(true)}
                style={{ background: 'none', border: '1px solid #1565C0', color: '#1565C0', cursor: 'pointer', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}
              >
                bestätigen
              </button>
            ) : null}
          </>
        )}
      </div>

      {/* Inline Notiz / Hinweis */}
      {istErfuelltManuell && p.notiz && (
        <div style={{ marginLeft: '26px', fontSize: '11px', color: '#1565C0', fontStyle: 'italic', marginBottom: '4px', padding: '4px 8px', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
          „{p.notiz}" · {p.bestaetigtVon}, {p.bestaetigtAm}
        </div>
      )}

      {editOffen && (
        <div style={{ marginLeft: '26px', padding: '8px', backgroundColor: '#f0f4ff', borderRadius: '6px', marginBottom: '4px' }}>
          {p.hinweis && <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px', fontStyle: 'italic' }}>💡 {p.hinweis}</div>}
          <textarea
            value={notiz}
            onChange={e => setNotiz(e.target.value)}
            placeholder="Notiz (optional) — was wurde geklärt?"
            rows={2}
            style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '6px', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => { onBestaetigen?.(p.id, notiz || undefined); setEditOffen(false); setNotiz(''); }}
              style={{ padding: '4px 10px', backgroundColor: '#1565C0', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
            >
              ✓ Manuell bestätigen
            </button>
            <button
              onClick={() => { setEditOffen(false); setNotiz(''); }}
              style={{ padding: '4px 10px', backgroundColor: 'transparent', color: '#666', border: '1px solid #ddd', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KOMPAKTE SCORE-KREISE (für Headers) ─────────────────────

export function ScoreCircle({ score, color, size = 44 }: { score: number; color: string; size?: number }) {
  const radius = size / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f0f0f0" strokeWidth="3" />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.32} fontWeight="700" fill={color}>{score}</text>
    </svg>
  );
}
