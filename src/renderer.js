const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");
const { start } = require("repl");

document.getElementById("run").addEventListener("click", () => {
  const outputLog = document.getElementById("outputLog");
  outputLog.textContent = "running...";
  const processor = spawn(ffmpegPath, [
    "-i",
    "C:/Users/jadon/Downloads/Testclip_1.MP4",
    "-af",
    "silencedetect=noise=-30dB:d=0.05",
    "-f",
    "null",
    "-",
  ]);

  let dataOutput = "";

  //FFmpeg uses stderr instead of stdout for its output
  processor.stderr.on("data", (d) => {
    outputLog.textContent = d.toString();
    dataOutput += d.toString();
  });

  processor.on("close", () => {
    const silences = [];

    let currentStart = null;
    console.log(dataOutput);

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

    const durationInSeconds = parseDuration(dataOutput);
    const keepRanges = getKeepRanges(silences, durationInSeconds);
    console.log("video duration", durationInSeconds);
    console.log(keepRanges);
    console.log("silences", silences);
    console.log("duration", durationInSeconds);

    const inputPath = "C:/Users/jadon/Downloads/Testclip.MP4";
    const outputDir = path.join(path.dirname(inputPath), "clips");

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
        inputPath,
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
  });
});

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
