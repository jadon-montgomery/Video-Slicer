import React from "react";
import { useState, forwardRef, useImperativeHandle } from "react";
import { useEffect } from "react";
import { useRef } from "react";
import { generateXML, parseFrameRate } from "../generateXML";

const fileInput = document.getElementById("fileInput");
let isDialogOpen = false;

const Renderer = forwardRef(
  ({ mode, setTranscribedText, transcribedText, setFileName }, ref) => {
    const [isDisabled, setIsDisabled] = useState(false);
    const fileInputRef = useRef(null);
    const transText = [...transcribedText];
    const [filePath, setFilePath] = useState("");
    const [currentFile, setCurrentFile] = useState("");

    let sampleData = "";

    useEffect(() => {
      console.log("PATH", filePath);
      console.log(transcribedText);
    }, [transcribedText]);

    useEffect(() => {
      if (currentFile !== "") processFile();
    }, [filePath]);

    async function fileChanged(fileEvent) {
      const selectedFile = fileEvent.target.files[0];
      setCurrentFile(selectedFile);
      console.log("SL", selectedFile);
      if (!selectedFile) {
        console.log("canceled");
        return;
      }
      setFileName(selectedFile.name);
      console.log("FILENAME", selectedFile);
      const ffmpegPath = await window.electronAPI.getFfmpegPath();
      console.log("FFMPEG", ffmpegPath);
      const outputLog = document.getElementById("outputLog");
      setFilePath(await window.electronAPI.getFilePath(selectedFile));
      setIsDisabled(true);
    }

    useImperativeHandle(ref, () => ({
      extractSilences,
    }));

    async function processFile() {
      console.log(transcribedText);
      outputLog.textContent = "running...";
      const duration = await window.electronAPI.getVideoDuration(filePath);
      console.log("DURATION", duration);

      if (mode === 0) {
        await window.electronAPI.silenceDetect(
          currentFile,
          fileEvent,
          filePath,
        );
      } else {
        audioToText(filePath);
      }
    }

    async function extractSilences() {
      const silences = [];
      transcribedText.forEach((element) => {
        if (element.type === "silence" && element.selected === true) {
          silences.push(element);
        }
      });
      console.log(filePath, silences, "SILENCES");
      await window.electronAPI.trimVideo(silences, sampleData, filePath);
      //fileEvent.target.value = "";
      console.log(silences, "SILENCES");
    }
    async function audioToText(filePath) {
      console.log(currentFile, filePath, "TEST");
      const transcriberOutput =
        await window.electronAPI.runTranscriber(filePath);
      console.log(transcriberOutput, "TRANSCRIBER OUTPUT", filePath);

      for (const [index, chunk] of transcriberOutput.chunks.entries()) {
        const nextChunk = transcriberOutput.chunks[index + 1];
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

        console.log("SELECTTED FILE", currentFile);
        console.log("FILEPATRH", filePath);
        const silenceItem = await window.electronAPI.detectSilence(
          filePath,
          textItem,
          nextTextStartPoint,
          currentFile,
          dataOutput,
          // identifyGap,
        );

        transText.push(textItem, silenceItem);

        //   //  console.log(identifyGap);
        //   // if (identifyGap) {
        //   //   console.log("GAP SHOULD BE ADDED");
        //   // }

        //   // if (!alreadyAdded) {
        //   // }
        //   // console.log(
        //   //   textItem.text,
        //   //   textItem.startPoint,
        //   //   textItem.endPoint,
        //   //   "stamp",
        //   //   silenceItem,
        //   // );
      }

      console.log(transText, "TRANSTEXT");
      setTranscribedText(transText);
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

    return (
      <label className="file-input-container ">
        <input
          disabled={isDisabled}
          onChange={fileChanged}
          ref={fileInputRef}
          type="file"
          className="sr-only"
          id="fileInput"
          accept=".mp4"
        />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          className="w-[10%] text-[#fb8500] mr-4"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>

        <div className="file-input ">
          {" "}
          <p>{filePath ? filePath : "Choose a file"}</p>
        </div>
      </label>
    );
  },
);

export default Renderer;
