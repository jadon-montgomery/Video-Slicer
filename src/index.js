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

ipcMain.handle(
  "detect-silence",
  async (
    event,
    filePath,
    textItem,
    nextTextStartPoint,
    selectedFile,
    dataOutput,
    // identifyGap,
  ) => {
    console.log("NOT NULL", textItem.endPoint, nextTextStartPoint, filePath);

    return new Promise((resolve) => {
      let silenceItem = null;
      const processor = spawn(ffmpegPath, [
        "-ss",
        `${textItem.endPoint}`,
        "-to",
        `${nextTextStartPoint}`,
        "-i",
        `${filePath}`,
        "-af",
        "silencedetect=noise=-30dB:d=0.05",
        "-f",
        "null",
        "-",
      ]);

      //FFmpeg uses stderr instead of stdout for its output
      processor.stderr.on("data", (d) => {
        //outputLog.textContent = d.toString();
        dataOutput += d.toString();
      });

      processor.on("close", () => {
        sampleData = dataOutput;
        for (const lines of dataOutput.split("\n")) {
          //If any silence is detected
          const silenceDuration = lines.match(/silence_duration: (\d+\.?\d*)/);
          if (silenceDuration !== null) {
            // identifyGap = true;

            silenceItem = {
              type: "silence",
              id: crypto.randomUUID(),
              startPoint: textItem.endPoint,
              endPoint: textItem.endPoint + parseFloat(silenceDuration[1]),
              selected: true,
            };

            console.log("identifyGap", silenceItem);
            resolve(silenceItem);
          }
          //console.log("output", dataOutput);
        }
      });
    });
  },
);

ipcMain.handle(
  "silence-detect",
  async (event, selectedFile, fileEvent, filePath) => {
    let dataOutput = "";
    const processor = spawn(ffmpegPath, [
      "-i",
      `${filePath}`,
      "-af",
      "silencedetect=noise=-30dB:d=0.1",
      "-f",
      "null",
      "-",
    ]);

    //FFmpeg uses stderr instead of stdout for its output
    processor.stderr.on("data", (d) => {
      // outputLog.textContent = d.toString();
      dataOutput += d.toString();
    });

    processor.on("close", () => {
      const silences = [];

      let currentStart = null;

      setIsDisabled(false);
      console.log(dataOutput);
      getSilences(dataOutput, currentStart, silences);

      trimVideo(silences, dataOutput, filePath);
      fileEvent.target.value = "";
    });
  },
);

ipcMain.handle("trim-video", (event, silences, dataOutput, filePath) => {
  console.log(silences, dataOutput, filePath);
  const outputDir = path.join(path.dirname(filePath), "clips");
  const durationInSeconds = parseDuration(dataOutput);
  const keepRanges = getKeepRanges(silences, durationInSeconds);
  const fps = parseFrameRate(dataOutput);
  const videoInfo = { width: 3840, height: 2160 };
  const xml = generateXML(
    keepRanges,
    filePath,
    fps,
    durationInSeconds,
    videoInfo,
  );
  console.log(xml);
  fs.writeFileSync(
    path.join(path.dirname(filePath), "choppedSequence.xml"),
    xml,
  );
  // console.log("video duration", durationInSeconds);
  // console.log(keepRanges);
  // console.log("silences", silences);
  // console.log("duration", durationInSeconds);

  fs.mkdirSync(outputDir, { recursive: true });

  keepRanges.forEach((range, index) => {
    const fileName = `clip_${String(index + 1).padStart(3, "0")}.mp4`;
    const outputPath = path.join(outputDir, fileName);

    const cut = spawn(ffmpegPath, [
      "-ss",
      range.startPoint.toFixed(3),
      "-to",
      range.endPoint.toFixed(3),
      "-i",
      filePath,
      "-c",
      "copy",
      "-y",
      outputPath,
    ]);

    cut.on("close", (code) => {
      if (code === 0) {
        console.log(`done ${fileName}`);
      } else {
        console.log(`failed ${fileName}, code ${code}`);
      }
    });
  });

  console.log("success!: check download folder");
  //outputLog.textContent = "success!: check download folder";
});

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
  return new Promise((resolve, reject) => {
    console.log("PATH EXISTS", ffmpegPath, "SELEC", selectedFilePath);
    let outputLog = "";
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
      "s16",
      "-y", //Overwrite without asking
      outputPath,
    ]);

    processor.stderr.on("data", (d) => {
      outputLog += d.toString();
      console.log(outputLog);
    });

    processor.on("close", async (code) => {
      let url = outputPath;
      console.log(url, "URL");
      let wavFileBytes = await filesys.readFile(outputPath);

      // Read .wav file and convert it to required format
      let wavFile = new wavefile.WaveFile(wavFileBytes);
      wavFile.toBitDepth("32f"); //convert audio samples to 32float format
      resolve((audioData = wavFile.getSamples(true, Float32Array))); //grab audio samples and store in 32float array
    });
  });
};

function trimVideo(event, silences, dataOutput, filePath) {
  console.log(silences, dataOutput, filePath);
  const outputDir = path.join(path.dirname(filePath), "clips");
  const durationInSeconds = parseDuration(dataOutput);
  const keepRanges = getKeepRanges(silences, durationInSeconds);
  const fps = parseFrameRate(dataOutput);
  const videoInfo = { width: 3840, height: 2160 };
  const xml = generateXML(
    keepRanges,
    filePath,
    fps,
    durationInSeconds,
    videoInfo,
  );
  console.log(xml);
  fs.writeFileSync(
    path.join(path.dirname(filePath), "choppedSequence.xml"),
    xml,
  );
  // console.log("video duration", durationInSeconds);
  // console.log(keepRanges);
  // console.log("silences", silences);
  // console.log("duration", durationInSeconds);

  fs.mkdirSync(outputDir, { recursive: true });

  keepRanges.forEach((range, index) => {
    const fileName = `clip_${String(index + 1).padStart(3, "0")}.mp4`;
    const outputPath = path.join(outputDir, fileName);

    const cut = spawn(ffmpegPath, [
      "-ss",
      range.startPoint.toFixed(3),
      "-to",
      range.endPoint.toFixed(3),
      "-i",
      filePath,
      "-c",
      "copy",
      "-y",
      outputPath,
    ]);

    cut.on("close", (code) => {
      if (code === 0) {
        console.log(`done ${fileName}`);
      } else {
        console.log(`failed ${fileName}, code ${code}`);
      }
    });
  });

  console.log("success!: check download folder");
  // outputLog.textContent = "success!: check download folder";
}
