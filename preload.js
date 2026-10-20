const { ipcRenderer } = require('electron');

window.electronAPI = {
  getGlobalCursor: () => ipcRenderer.invoke('gaze:get-global-cursor'),
  setGlobalTracking: (enabled) => ipcRenderer.send('gaze:set-tracking', !!enabled),
  onGlobalCursor: (callback) => {
    const listener = (_event, pos) => callback(pos);
    ipcRenderer.on('gaze:cursor', listener);
    return () => ipcRenderer.removeListener('gaze:cursor', listener);
  },
  // VMC protocol: send pre-encoded OSC datagrams to the main process.
  vmcSetEnabled: (enabled) => ipcRenderer.send('vmc:set-enabled', !!enabled),
  vmcSend: (buffer) => ipcRenderer.send('vmc:send', buffer),
};
