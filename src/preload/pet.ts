import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('petAPI', {
  ping: () => 'pong'
});
