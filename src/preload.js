const { contextBridge, ipcRenderer } = require('electron');

/**
 * iCaffe OS Context Bridge
 * Exposes secure API to the Frontend (React VITE)
 */
contextBridge.exposeInMainWorld('electron', {
    /**
     * System Stats & Commands
     */
    getStats: () => ipcRenderer.invoke('get-system-stats'),
    getLogs: (lines) => ipcRenderer.invoke('get-system-logs', lines),
    runCommand: (command) => ipcRenderer.invoke('execute-command', command),

    /**
     * Event Listeners
     */
    onTelemetry: (callback) => {
        ipcRenderer.on('telemetry-update', (event, data) => callback(data));
        return () => ipcRenderer.removeAllListeners('telemetry-update');
    },

    /**
     * Environment Flags
     */
    isElectron: true,
    version: process.versions.electron
});
