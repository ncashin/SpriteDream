const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("spriteDream", {
  openFolder() {
    return ipcRenderer.invoke("open-folder");
  },
  openTestFiles() {
    return ipcRenderer.invoke("open-test-files");
  },
  windowChrome() {
    return ipcRenderer.invoke("window-chrome");
  },
  onWindowChrome(callback) {
    const listener = (_event, chrome) => callback(chrome);
    ipcRenderer.on("window-chrome", listener);
    return () => ipcRenderer.removeListener("window-chrome", listener);
  },
});
