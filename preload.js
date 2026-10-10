const { ipcRenderer } = require('electron');

window.electronAPI = {
  getGlobalCursor: () => ipcRenderer.invoke('gaze:get-global-cursor'),
  setGlobalTracking: (enabled) => ipcRenderer.send('gaze:set-tracking', !!enabled),
  onGlobalCursor: (callback) => {
    const listener = (_event, pos) => callback(pos);
    ipcRenderer.on('gaze:cursor', listener);
    return () => ipcRenderer.removeListener('gaze:cursor', listener);
  },
};
