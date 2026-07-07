import React from "react";
import { useState, forwardRef, useImperativeHandle } from "react";
import { useEffect } from "react";
import { useRef } from "react";
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const { pipeline } = require("@xenova/transformers");

import { generateXML, parseFrameRate } from "../generateXML";
const crypto = require("crypto");
const { webUtils } = require("electron");
const path = require("path");
const fs = require("fs");
const { start } = require("repl");
const { pathToFileURL } = require("url");
const fileInput = document.getElementById("fileInput");
let isDialogOpen = false;

const Renderer = forwardRef(
  ({ mode, setTranscribedText, transcribedText }, ref) => {
    const [isDisabled, setIsDisabled] = useState(false);
    const fileInputRef = useRef(null);
    const transText = [...transcribedText];
    const [filePath, setFilePath] = useState("");
    let sampleData = "";

    useEffect(() => {
      console.log(transcribedText);
    }, [transcribedText]);
    async function fileChanged(fileEvent) {
      const selectedFile = fileEvent.target.files[0];
      const outputLog = document.getElementById("outputLog");
      setFilePath(webUtils.getPathForFile(selectedFile));

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

    useImperativeHandle(ref, () => ({
      extractSilences,
    }));

    function extractSilences() {
      const silences = [];
      transcribedText.forEach((element) => {
        if (element.type === "silence" && element.selected === true) {
          silences.push(element);
        }
      });
      console.log(filePath, silences, "SILENCES");
      trimVideo(silences, sampleData, filePath);
      //fileEvent.target.value = "";
      console.log(silences, "SILENCES");
    }
    async function audioToText(selectedFile) {
      const transcriber = await pipeline(
        "automatic-speech-recognition",
        "Xenova/whisper-base.en",
      );
      const output = await transcriber(webUtils.getPathForFile(selectedFile), {
        return_timestamps: "word",
      });
      console.log(output);
      transcriber.start;

      for (const [index, chunk] of output.chunks.entries()) {
        const nextChunk = output.chunks[index + 1];
        // let identifyGap = false;

        const textItem = {
          id: crypto.randomUUID(),
          type: "text",
          text: chunk.text,
          startPoint: chunk.timestamp[0],
          endPoint: chunk.timestamp[1],
        };

        let dataOutput = "";

        const nextTextStartPoint =
          typeof nextChunk !== "undefined"
            ? nextChunk.timestamp[0]
            : textItem.endPoint - 0.3;

        if (
          nextTextStartPoint === textItem.endPoint ||
          textItem.endPoint > nextTextStartPoint
        ) {
          transText.push(...transcribedText, textItem);
          console.log(transText);
          continue;
        }
        console.log("processor", textItem.endPoint, nextTextStartPoint);

        const silenceItem = await detectSilence(
          textItem,
          nextTextStartPoint,
          selectedFile,
          dataOutput,
          // identifyGap,
        );

        transText.push(textItem, silenceItem);

        //  console.log(identifyGap);
        // if (identifyGap) {
        //   console.log("GAP SHOULD BE ADDED");
        // }

        // if (!alreadyAdded) {
        // }
        // console.log(
        //   textItem.text,
        //   textItem.startPoint,
        //   textItem.endPoint,
        //   "stamp",
        //   silenceItem,
        // );
      }

      console.log(transText, "TRANSTEXT");
      setTranscribedText(transText);
    }

    async function detectSilence(
      textItem,
      nextTextStartPoint,
      selectedFile,
      dataOutput,
      // identifyGap,
    ) {
      console.log("NOT NULL", textItem.endPoint, nextTextStartPoint);

      return new Promise((resolve) => {
        let silenceItem = null;
        const processor = spawn(ffmpegPath, [
          "-ss",
          `${textItem.endPoint}`,
          "-to",
          `${nextTextStartPoint}`,
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
          sampleData = dataOutput;
          for (const lines of dataOutput.split("\n")) {
            //If any silence is detected
            const silenceDuration = lines.match(
              /silence_duration: (\d+\.?\d*)/,
            );
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
          silences.push({
            startPoint: currentStart,
            endPoint: parseFloat(endMatch[1]),
          });
          currentStart = null;
        }
      }
    }

    function getKeepRanges(silences, duration) {
      const keep = [];
      let cursor = 0;

      for (const silence of silences) {
        if (cursor === 0 && silence.startPoint === 0) {
          cursor = silence.endPoint;
        } else if (cursor < silence.startPoint) {
          keep.push({ startPoint: cursor, endPoint: silence.startPoint });
          cursor = silence.endPoint;
        }

        console.log(
          "cursor:",
          cursor,
          "silence.startPoint:",
          silence.startPoint,
          "silence.endPoint:",
          silence.endPoint,
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
        "silencedetect=noise=-30dB:d=0.1",
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

        trimVideo(silences, dataOutput, filePath);
        fileEvent.target.value = "";
      });
    }
    function trimVideo(silences, dataOutput, filePath) {
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

      outputLog.textContent = "success!: check download folder";
    }
    return (
      <div className="border-amber-50 border-2 flex text-center w-fit">
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
  },
);

export default Renderer;
