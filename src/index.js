const { app, BrowserWindow } = require("electron");
const { ipcMain } = require("electron");
const { spawn } = require("child_process");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const currentPath = require("node:path");
const crypto = require("crypto");
const fs = require("fs");
const filesys = require("node:fs/promises");
const ffmpegPath = require("ffmpeg-static");
const { start } = require("repl");
const { pathToFileURL } = require("url");
const { pipeline } = require("@xenova/transformers");
const wavefile = require("wavefile");
ipcMain.handle("get-video-duration", async (event, filePath) => {
  console.log("FFMPEGPATH", ffmpegPath);
  return new Promise((resolve, reject) => {
    ffmpegPath.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.log("error");
        reject(err);
      } else {
        const duration = metadata.format.duration;
        resolve(duration);
      }
    });
  });
});

ipcMain.handle("get-ffmpeg-path", async () => {
  return new Promise((resolve, reject) => {
    if (ffmpegPath) {
      //console.log("RESOLVED");
      resolve(ffmpegPath);
    }
    // console.log("REJECTED");
    reject(undefined);
  });
});

ipcMain.handle("get-file-base-name", async (event, sourcePath) => {
  return path.basename(sourcePath);
});
ipcMain.handle("run-transcriber", async (event, selectedFilePath) => {
  const currentDir = currentPath.dirname(selectedFilePath);
  const outputPath = currentPath.join(currentDir, "output.wav");
  console.log(outputPath, "OUTPUTPATH");
  const audioData = await decodeAudio(selectedFilePath, outputPath);
  const transcriber = await pipeline(
    "automatic-speech-recognition",
    "Xenova/whisper-base.en",
  );
  const output = await transcriber(audioData, {
    return_timestamps: "word",
  });
  console.log(output);

  return output;
});
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL("http://localhost:5173/");

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

const decodeAudio = async (selectedFilePath, outputPath) => {
  console.log("PATH EXISTS", ffmpegPath, "SELEC", selectedFilePath);
  const processor = spawn(ffmpegPath, [
    "-i",
    selectedFilePath,
    "-map", //First audio stream (input file 0)
    "0:a",
    "-ac", //audio channels
    "1",
    "-ar", //sample rate
    "16000",
    "-sample_fmt", //bit depth
    "pcm_s16",
    "-y", //Overwrite without asking
    outputPath,
  ]);

  let url = outputPath;
  console.log(url, "URL");
  let wavFileBytes = await filesys.readFile(outputPath);

  // Read .wav file and convert it to required format
  let wavFile = new wavefile.WaveFile(wavFileBytes);
  wavFile.toBitDepth("32f"); //convert audio samples to 32float format
  return (audioData = wavFile.getSamples(true, Float32Array)); //grab audio samples and store in 32float array
};
