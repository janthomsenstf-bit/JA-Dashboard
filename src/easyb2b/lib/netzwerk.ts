// =============================================================
// NETZWERK-MODUL Hilfsfunktionen für Easy-B2B Dashboard
// Das Gedächtnis des deutsch-dänischen Netzwerks
// =============================================================

export function getKontaktKategorieLabel(kat: string): string {
  const labels: Record<string, string> = {
    unternehmer: 'Unternehmer/in',
    verband: 'Verband',
    kammer: 'Kammer / IHK / HK',
    wirtschaftsfoerderung: 'Wirtschaftsförderung',
    kommune: 'Kommune / Verwaltung',
    dienstleister: 'Dienstleister',
    berater: 'Berater/in',
    investor: 'Investor/in',
    journalist: 'Journalist/in / Medien',
    politik: 'Politik',
    sonstiges: 'Sonstiges',
  };
  return labels[kat] || kat;
}

export function getKontaktKategorieIcon(kat: string): string {
  const icons: Record<string, string> = {
    unternehmer: '🏢',
    verband: '🏛',
    kammer: '⚖️',
    wirtschaftsfoerderung: '📈',
    kommune: '🏙',
    dienstleister: '🛠',
    berater: '💡',
    investor: '💰',
    journalist: '📰',
    politik: '🏛',
    sonstiges: '👤',
  };
  return icons[kat] || '👤';
}

export function getKontaktKategorieColor(kat: string): string {
  const colors: Record<string, string> = {
    unternehmer: '#003366',
    verband: '#9C27B0',
    kammer: '#E91E63',
    wirtschaftsfoerderung: '#FF9900',
    kommune: '#4CAF50',
    dienstleister: '#2196F3',
    berater: '#00BCD4',
    investor: '#FF5722',
    journalist: '#795548',
    politik: '#607D8B',
    sonstiges: '#999',
  };
  return colors[kat] || '#999';
}

export function getAktivitaetsLabel(status: string): string {
  const labels: Record<string, string> = {
    aktiv: 'Aktiv',
    passiv: 'Passiv',
    ruhend: 'Ruhend',
    inaktiv: 'Inaktiv',
  };
  return labels[status] || status;
}

export function getAktivitaetsColor(status: string): string {
  const colors: Record<string, string> = {
    aktiv: '#4CAF50',
    passiv: '#FF9900',
    ruhend: '#999',
    inaktiv: '#ccc',
  };
  return colors[status] || '#ccc';
}

export function getHistorieTypLabel(typ: string): string {
  const labels: Record<string, string> = {
    telefonat: 'Telefonat',
    meeting: 'Meeting',
    email: 'E-Mail',
    event: 'Event-Treffen',
    nachricht: 'Nachricht',
    wiedervorlage: 'Wiedervorlage',
    notiz: 'Notiz',
  };
  return labels[typ] || typ;
}

export function getHistorieTypIcon(typ: string): string {
  const icons: Record<string, string> = {
    telefonat: '📞',
    meeting: '🤝',
    email: '📧',
    event: '🎤',
    nachricht: '💬',
    wiedervorlage: '🔔',
    notiz: '📝',
  };
  return icons[typ] || '📋';
}

export function getEmpfehlungsStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    offen: 'Offen',
    kontaktiert: 'Kontaktiert',
    in_pruefung: 'In Prüfung',
    angenommen: 'Angenommen',
    abgelehnt: 'Abgelehnt',
    erfolgreich: 'Erfolgreich',
  };
  return labels[status] || status;
}

export function getEmpfehlungsStatusColor(status: string): string {
  const colors: Record<string, string> = {
    offen: '#2196F3',
    kontaktiert: '#FF9900',
    in_pruefung: '#9C27B0',
    angenommen: '#4CAF50',
    abgelehnt: '#f44336',
    erfolgreich: '#2e7d32',
  };
  return colors[status] || '#999';
}

// ─── NETZWERKWERT BERECHNEN ───────────────────────────────────

export interface NetzwerkWertInput {
  empfehlungenGesamt: number;
  empfehlungenErfolgreich: number;
  eventTeilnahmen: number;
  letzterKontaktTage: number; // Tage seit letztem Kontakt
}

export function berechneNetzwerkWert(input: NetzwerkWertInput): number {
  let wert = 0;

  // Empfehlungen (bis max 40 Punkte)
  wert += Math.min(input.empfehlungenGesamt * 8, 24);
  wert += Math.min(input.empfehlungenErfolgreich * 16, 40);

  // Events (bis max 20 Punkte)
  wert += Math.min(input.eventTeilnahmen * 10, 20);

  // Aktualität (bis max 20 Punkte)
  if (input.letzterKontaktTage <= 30) wert += 20;
  else if (input.letzterKontaktTage <= 90) wert += 10;
  else if (input.letzterKontaktTage <= 180) wert += 5;

  return Math.min(100, wert);
}

export function getNetzwerkWertLabel(wert: number): string {
  if (wert >= 80) return 'Schlüsselkontakt';
  if (wert >= 60) return 'Wertvoller Kontakt';
  if (wert >= 30) return 'Aktiver Kontakt';
  return 'Neuer Kontakt';
}

export function getNetzwerkWertColor(wert: number): string {
  if (wert >= 80) return '#9C27B0';
  if (wert >= 60) return '#4CAF50';
  if (wert >= 30) return '#FF9900';
  return '#2196F3';
}
