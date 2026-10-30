const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("spritedream", {
  openFolder() {
    return ipcRenderer.invoke("open-folder");
  },
});
