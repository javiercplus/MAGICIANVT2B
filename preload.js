const { ipcRenderer } = require('electron');

window.electronAPI = {
  getGlobalCursor: () => ipcRenderer.invoke('gaze:get-global-cursor'),
  setGlobalTracking: (enabled) => ipcRenderer.send('gaze:set-tracking', !!enabled),
  onGlobalCursor: (callback) => {
    const listener = (_event, pos) => callback(pos);
    ipcRenderer.on('gaze:cursor', listener);
    return () => ipcRenderer.removeListener('gaze:cursor', listener);
  },
  // VMC protocol: send and receive OSC datagrams via the main process.
  vmcSetEnabled: (enabled) => ipcRenderer.send('vmc:set-enabled', !!enabled),
  vmcConfigureSend: (cfg) => ipcRenderer.send('vmc:configure-send', cfg),
  vmcConfigureReceive: (cfg) => ipcRenderer.send('vmc:configure-receive', cfg),
  vmcSend: (buffer) => ipcRenderer.send('vmc:send', buffer),
  onVmcPacket: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('vmc:packet', listener);
    return () => ipcRenderer.removeListener('vmc:packet', listener);
  },
  onVmcReceiveStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('vmc:receive-status', listener);
    return () => ipcRenderer.removeListener('vmc:receive-status', listener);
  },
};
