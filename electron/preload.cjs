const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Datei via Dialog öffnen → { name, mimeType, data (base64), size, path }
  openFile: (options) =>
    ipcRenderer.invoke('dialog:openFile', options),

  // Datei in Excel öffnen (speichert in Temp-Ordner, öffnet shell.openPath)
  // Gibt den Temp-Pfad zurück (für späteren file:watch)
  saveAndOpen: (name, base64Data, mimeType) =>
    ipcRenderer.invoke('file:saveAndOpen', name, base64Data, mimeType),

  // Datei von Pfad lesen → { data (base64), size, mtime }
  readFile: (filePath) =>
    ipcRenderer.invoke('file:read', filePath),

  // Datei-Änderungen überwachen (sendet 'file:changed' events)
  watchFile: (filePath) =>
    ipcRenderer.invoke('file:watch', filePath),

  // Datei-Überwachung beenden
  unwatchFile: (filePath) =>
    ipcRenderer.invoke('file:unwatch', filePath),

  // Event-Listener: Datei wurde extern geändert (z. B. Excel-Speichern)
  onFileChanged: (callback) =>
    ipcRenderer.on('file:changed', (_event, filePath) => callback(filePath)),

  offFileChanged: (callback) =>
    ipcRenderer.removeListener('file:changed', callback),
})
