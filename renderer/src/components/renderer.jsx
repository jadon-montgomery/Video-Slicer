import React from "react";
import { useState, forwardRef, useImperativeHandle } from "react";
import { useEffect } from "react";
import { useRef } from "react";

const fileInput = document.getElementById("fileInput");
let isDialogOpen = false;

const Renderer = forwardRef(
  ({ mode, setTranscribedText, transcribedText, setFileName }, ref) => {
    const [isDisabled, setIsDisabled] = useState(false);
    const fileInputRef = useRef(null);
    const transText = [...transcribedText];
    const [filePath, setFilePath] = useState("");
    const [fileEventItem, setFileEventItem] = useState("");
    const [currentFile, setCurrentFile] = useState("");
    const [silenceDb, setSilenceDb] = useState(-30);

    let sampleData = "";

    useEffect(() => {
      console.log("PATH", filePath);
      console.log(transcribedText);
    }, [transcribedText]);

    useEffect(() => {
      if (currentFile !== "") {
        processFile(fileEventItem);
      }
    }, [filePath]);

    async function fileChanged(fileEvent) {
      const selectedFile = fileEvent.target.files[0];
      setCurrentFile(selectedFile);
      console.log("SL", selectedFile);
      if (!selectedFile) {
        console.log("canceled");
        return;
      }

      setFileEventItem(fileEvent.target);
      setFileName(selectedFile.name);
      console.log("FILENAME", selectedFile);

      const outputLog = document.getElementById("outputLog");
      setFilePath(await window.electronAPI.getFilePath(selectedFile));
      setIsDisabled(true);
    }

    useImperativeHandle(ref, () => ({
      extractSilences,
    }));

    async function processFile(fileEvent) {
      console.log(transcribedText);
      outputLog.textContent = "running...";
      const ffmpegPath = await window.electronAPI.getFfmpegPath();
      const duration = await window.electronAPI.getVideoDuration(filePath);

      console.log("FFMPEG", ffmpegPath);
      console.log("DURATION", duration);

      if (mode === 0) {
        await window.electronAPI.silenceDetect(
          currentFile,
          fileEvent,
          filePath,
          silenceDb,
          mode,
        );
      } else {
        //Detect silences
        const silences = await window.electronAPI.silenceDetect(
          currentFile,
          fileEvent,
          filePath,
          silenceDb,
          mode,
        );

        audioToText(filePath, silences);
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
    async function audioToText(filePath, silences) {
      let textItem;

      const processAudio = new Promise(async (resolve) => {
        for (const [index, silence] of silences.entries()) {
          let timeStamp = [0, 0];
          if (index > 0)
            timeStamp = [silences[index - 1].endPoint, silence.startPoint];
          else timeStamp = [0, silence.startPoint];

          const duration = timeStamp[1] - timeStamp[0];

          if (duration > 0) {
            console.log("og timestamp", timeStamp, duration);
            console.log("TIMESTAMP", timeStamp);
            const transcriberOutput = await window.electronAPI.runTranscriber(
              filePath,
              timeStamp,
            );

            // const transcriberOutput =
            //   await window.electronAPI.runTranscriber(filePath);

            for (const [index, chunk] of transcriberOutput.chunks.entries()) {
              const nextChunk = transcriberOutput.chunks[index + 1];
              // let identifyGap = false;

              textItem = {
                id: crypto.randomUUID(),
                type: "text",
                text: chunk.text,
                startPoint: chunk.timestamp[0],
                endPoint: chunk.timestamp[1],
              };

              let dataOutput = "";

              // const nextTextStartPoint =
              //   typeof nextChunk !== "undefined"
              //     ? nextChunk.timestamp[0]
              //     : textItem.endPoint - 0.3;
              transText.push(...transcribedText, textItem);
              console.log(transText);
              continue;
              // if (
              //   nextTextStartPoint === textItem.endPoint ||
              //   textItem.endPoint > nextTextStartPoint
              // ) {
              //   transText.push(...transcribedText, textItem);
              //   console.log(transText);
              //   continue;
              // }
              //console.log("processor", textItem.endPoint, nextTextStartPoint);

              // console.log("SELECTTED FILE", currentFile);
              // console.log("FILEPATRH", filePath);
              // const silenceItem = await window.electronAPI.detectSilence(
              //   filePath,
              //   textItem,
              //   nextTextStartPoint,
              //   currentFile,
              //   dataOutput,
              //   // identifyGap,
              // );

              // transText.push(textItem, silenceItem);

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
            const silenceItem = {
              id: crypto.randomUUID(),
              type: "silence",
              text: "<-->",
              startPoint: silence.startPoint,
              endPoint: silence.endPoint,
            };
            transText.push(silenceItem);
            console.log(transText, "TRANSTEXT");
          }
        }
        resolve();
      });

      const result = await processAudio;
      console.log("FINISHED");
      setTranscribedText(transText);
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
