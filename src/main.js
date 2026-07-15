const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,    // מסך מלא
    frame: false,         // בלי מסגרת חלון
    kiosk: true,          // מצב קיוסק - נועל את המק
    alwaysOnTop: true,    // שהעובדים לא יפתחו משהו אחר בטעות
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // טעינת השרת המקומי בפורט 4028
  mainWindow.loadURL('http://localhost:4028');

  // שורה מבוטלת - שלא יפתח דיבאג
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});