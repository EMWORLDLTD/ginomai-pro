const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false
    }
  });

  win.webContents.on('console-message', (event, level, message) => {
    console.log('[Worker]', message);
  });

  win.loadFile(path.join(__dirname, 'render_worker.html'));

  ipcMain.on('done-all', () => {
    console.log('ALL WEBM LOOPS GENERATED SUCCESSFULLY!');
    app.quit();
  });
});
