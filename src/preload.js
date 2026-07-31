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

  runTranscriber: (selectedFilePath, timestamp) => {
    console.log("PRELOAD runTranscriber");
    return ipcRenderer.invoke("run-transcriber", selectedFilePath, timestamp);
  },

  silenceDetect: (selectedFile, fileEvent, filePath, silenceDb, mode) => {
    return ipcRenderer.invoke(
      "silence-detect",
      selectedFile,
      fileEvent,
      filePath,
      silenceDb,
      mode,
    );
  },

  trimVideo: (silences, dataOutput, filePath) => {
    return ipcRenderer.invoke("trim-video", silences, dataOutput, filePath);
  },
  detectSilence: (
    filePath,
    textItem,
    nextTextStartPoint,
    selectedFile,
    dataOutput,
  ) => {
    return ipcRenderer.invoke(
      "detect-silence",
      filePath,
      textItem,
      nextTextStartPoint,
      selectedFile,
      dataOutput,
    );
  },
});
