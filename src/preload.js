const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");
const { webUtils } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getVideoDuration: (filePath) => {
    ipcRenderer.invoke("get-video-duration", filePath);
  },
  getFileBaseName: (sourcePath) => {
    ipcRenderer.invoke("get-base-name", sourcePath);
  },

  getFilePath: (selectedFile) => {
    return webUtils.getPathForFile(selectedFile);
  },
  getFfmpegPath: () => {
    ipcRenderer.invoke("get-ffmpeg-path");
  },

  runTranscriber: (selectedFilePath) => {
    console.log("PRELOAD runTranscriber");
    return ipcRenderer.invoke("run-transcriber", selectedFilePath);
  },
});
