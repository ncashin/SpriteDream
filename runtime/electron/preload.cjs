const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("spriteDream", {
  openFolder() {
    return ipcRenderer.invoke("open-folder");
  },
});
