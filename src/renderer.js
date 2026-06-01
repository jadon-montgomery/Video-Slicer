const {spawn} = require("child_process");
const ffmpegPath = require("ffmpeg-static");

document.getElementById("run").addEventListener("click", ()=>{
    const out = document.getElementById("out");
    out.textContent = "running... check console";
    const proc = spawn(ffmpegPath, ["-i", "C:/Users/jadon/Downloads/DJI_20260529201213_0009_D.MP4",
        "-af", "silencedetect=noise=-30dB:d=0.5",
        "-f", "null", "-"
    ]);

    //proc.stdout.on("data", (d)=>(out.textContent = d.toString())) //output
    proc.stderr.on("data", (d)=>(console.log( d.toString()))) //diagnostics, errors, etc.
})