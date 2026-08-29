const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path  = require('path')
const fs    = require('fs')
const os    = require('os')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ── Datei-Watcher-Map ────────────────────────────────────────────────────────
const watchers = {}   // path → FSWatcher

// ── Fenster erstellen ────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width:  1400,
    height: 900,
    minWidth:  900,
    minHeight: 600,
    title: "Jan's Spielbuch",
    webPreferences: {
      preload:          path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  return win
}

app.whenReady().then(() => {
  const win = createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // ── IPC: Datei über Dialog öffnen ─────────────────────────────────────────
  ipcMain.handle('dialog:openFile', async (_event, options = {}) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: options.filters ?? [
        { name: 'Excel', extensions: ['xlsx', 'xls'] },
        { name: 'Alle Dateien', extensions: ['*'] },
      ],
    })
    if (canceled || filePaths.length === 0) return null
    const filePath = filePaths[0]
    const data     = fs.readFileSync(filePath)
    const stat     = fs.statSync(filePath)
    return {
      name:     path.basename(filePath),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data:     data.toString('base64'),
      size:     stat.size,
      path:     filePath,
    }
  })

  // ── IPC: Datei in Temp-Ordner schreiben + in Excel öffnen ─────────────────
  ipcMain.handle('file:saveAndOpen', async (_event, name, base64Data, _mimeType) => {
    // Sicherer Dateiname (keine Sonderzeichen)
    const safeName = name.replace(/[<>:"/\\|?*]/g, '_')
    const tmpPath  = path.join(os.tmpdir(), `spielbuch_${Date.now()}_${safeName}`)
    const buf      = Buffer.from(base64Data, 'base64')
    fs.writeFileSync(tmpPath, buf)
    const err = await shell.openPath(tmpPath)
    if (err) throw new Error(err)
    return tmpPath
  })

  // ── IPC: Datei aus Pfad lesen ─────────────────────────────────────────────
  ipcMain.handle('file:read', async (_event, filePath) => {
    if (!fs.existsSync(filePath)) throw new Error('Datei nicht gefunden: ' + filePath)
    const data = fs.readFileSync(filePath)
    const stat = fs.statSync(filePath)
    return {
      data:     data.toString('base64'),
      size:     stat.size,
      mtime:    stat.mtimeMs,
    }
  })

  // ── IPC: Datei überwachen ─────────────────────────────────────────────────
  ipcMain.handle('file:watch', (event, filePath) => {
    if (watchers[filePath]) return   // bereits überwacht

    let debounceTimer = null
    let lastMtime     = 0

    watchers[filePath] = fs.watch(filePath, () => {
      // Kurzes Debounce – Excel speichert oft mehrfach hintereinander
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        try {
          const stat = fs.statSync(filePath)
          if (stat.mtimeMs === lastMtime) return  // kein echter Inhalt-Change
          lastMtime = stat.mtimeMs
          // Nur senden wenn das Fenster noch offen ist
          if (!event.sender.isDestroyed()) {
            event.sender.send('file:changed', filePath)
          }
        } catch { /* Datei evtl. kurz nicht verfügbar während Excel speichert */ }
      }, 600)
    })
  })

  // ── IPC: Datei-Überwachung stoppen ────────────────────────────────────────
  ipcMain.handle('file:unwatch', (_event, filePath) => {
    if (watchers[filePath]) {
      watchers[filePath].close()
      delete watchers[filePath]
    }
  })
})

app.on('window-all-closed', () => {
  // Alle Watcher aufräumen
  Object.values(watchers).forEach(w => w.close())
  if (process.platform !== 'darwin') app.quit()
})
