import React from "react";
import { useState } from "react";
import { useEffect } from "react";
import { useRef } from "react";
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const { pipeline } = require("@xenova/transformers");
import { generateXML, parseFrameRate } from "../generateXML";
const { webUtils } = require("electron");
const path = require("path");
const fs = require("fs");
const { start } = require("repl");
const { pathToFileURL } = require("url");
const fileInput = document.getElementById("fileInput");
let isDialogOpen = false;

const Renderer = ({ mode, setTranscribedText }) => {
  const [isDisabled, setIsDisabled] = useState(false);
  const fileInputRef = useRef(null);

  async function fileChanged(fileEvent) {
    const selectedFile = fileEvent.target.files[0];
    const outputLog = document.getElementById("outputLog");

    setIsDisabled(true);
    outputLog.textContent = "running...";
    console.log("PATH", webUtils.getPathForFile(selectedFile));

    if (!selectedFile) {
      console.log("canceled");
      return;
    }

    if (mode === 0) {
      silenceDetect(
        selectedFile,
        fileEvent,
        webUtils.getPathForFile(selectedFile),
      );
    } else {
      audioToText(selectedFile);
    }
  }

  async function audioToText(selectedFile) {
    const transcriber = await pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-base.en",
    );
    const output = await transcriber(webUtils.getPathForFile(selectedFile), {
      return_timestamps: "word",
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    console.log(output);
    transcriber.start;

    output.chunks.forEach((chunk, index) => {
      if (index > 0) {
        const textItem = {
          text: chunk.text,
          startPoint: chunk.timestamp[0],
          endPoint: chunk.timestamp[1],
        };
        setTranscribedText((previousContent) => [...previousContent, textItem]);
        console.log(chunk.timestamp[1], "stamp");
      } else {
      }
    });
  }

  function getSilences(dataOutput, currentStart, silences) {
    for (const lines of dataOutput.split("\n")) {
      //Look for silence start/end on the line
      const startMatch = lines.match(/silence_start: (\d+\.?\d*)/);
      const endMatch = lines.match(/silence_end: (\d+\.?\d*)/);

      if (startMatch) {
        currentStart = parseFloat(startMatch[1]); //index 1 catches the value in the regex
      }
      if (endMatch && currentStart !== null) {
        silences.push({ start: currentStart, end: parseFloat(endMatch[1]) });
        currentStart = null;
      }
    }
  }

  function getKeepRanges(silences, duration) {
    const keep = [];
    let cursor = 0;

    for (const silence of silences) {
      if (cursor === 0 && silence.start === 0) {
        cursor = silence.end;
      } else if (cursor < silence.start) {
        keep.push({ start: cursor, end: silence.start });
        cursor = silence.end;
      }

      console.log(
        "cursor:",
        cursor,
        "silence.start:",
        silence.start,
        "silence.end:",
        silence.end,
      );
    }

    console.log("current cursor location", cursor);
    if (cursor <= duration) {
      keep.push({ start: cursor, end: duration });
    }
    // else if (cursor >= duration){

    // }

    return keep;
  }

  function parseDuration(output) {
    const match = output.match(/Duration: (\d+):(\d+):(\d+\.?\d*)/);
    if (!match) {
      console.log("Video duration not found");
      return 0;
    } else {
      return (
        parseFloat(match[1]) * 3600 +
        parseFloat(match[2]) * 60 +
        parseFloat(match[3])
      );
    }
  }

  function silenceDetect(selectedFile, fileEvent, filePath) {
    let dataOutput = "";
    const processor = spawn(ffmpegPath, [
      "-i",
      `${webUtils.getPathForFile(selectedFile)}`,
      "-af",
      "silencedetect=noise=-30dB:d=0.05",
      "-f",
      "null",
      "-",
    ]);

    //FFmpeg uses stderr instead of stdout for its output
    processor.stderr.on("data", (d) => {
      outputLog.textContent = d.toString();
      dataOutput += d.toString();
    });

    processor.on("close", () => {
      const silences = [];

      let currentStart = null;

      setIsDisabled(false);
      console.log(dataOutput);
      getSilences(dataOutput, currentStart, silences);

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
          range.start.toFixed(3),
          "-to",
          range.end.toFixed(3),
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

      fileEvent.target.value = "";
      console.log("success!");
    });
  }

  return (
    <div>
      <input
        disabled={isDisabled}
        onChange={fileChanged}
        ref={fileInputRef}
        type="file"
        id="fileInput"
        accept=".mp4"
      />
    </div>
  );
};

export default Renderer;
