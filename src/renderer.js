const {spawn} = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");
const { start } = require("repl");


document.getElementById("run").addEventListener("click", ()=>{
    const out = document.getElementById("out");
    out.textContent = "running... check console";
    const processor = spawn(ffmpegPath, ["-i", "C:/Users/jadon/Downloads/Testclip.MP4",
        "-af", "silencedetect=noise=-25dB:d=0.5",
        "-f", "null", "-"
    ]);

    let dataOutput = "";

    //proc.stdout.on("data", (d)=>(out.textContent = d.toString())) //output
    processor.stderr.on("data", (d)=>{
        out.textContent = d.toString()
        dataOutput += d.toString()
    }
    ) //diagnostics, errors, etc.
    processor.on("close", ()=>{
        const silences = [];

        let currentStart = null;
        

        for(const lines of dataOutput.split("\n")){
            const startMatch = lines.match(/silence_start: (\d+\.?\d*)/);
            const endMatch = lines.match(/silence_end: (\d+\.?\d*)/);

            if(startMatch){
                currentStart = parseFloat(startMatch[1]) //index 1 catches the value in the regex
                
            }
            if (endMatch && currentStart !== null){
                silences.push({start: currentStart, end: parseFloat(endMatch[1])});
                currentStart = null;
            }

        }
        //   console.log(silences);
            //   console.log(dataOutput);

            const duration = parseDuration(dataOutput)
            const keepRanges = getKeepRanges(silences, duration)
            console.log(keepRanges);
            console.log("silences", silences);
                 console.log("duration", duration);

                 const inputPath = "C:/Users/jadon/Downloads/Testclip.MP4";
const outputDir = path.join(path.dirname(inputPath), "clips")

fs.mkdirSync(outputDir, {recursive: true});

keepRanges.forEach((range,index)=>{
const fileName = `clip_${String(index + 1).padStart(3,"0")}.mp4`
const outputPath = path.join(outputDir, fileName);

const cut = spawn(ffmpegPath, [
    "-ss", range.start.toFixed(3),
    "-to", range.end.toFixed(3),
    "-i", inputPath,
    "-c", "copy",
    "-y", outputPath

])

cut.on("close", (code)=>{
 if (code === 0)
 {
    console.log(`done ${fileName}`)
 }
 else{
    console.log( `failed ${fileName}, code ${code}`)
 }
})

})
    }) 
})        

function getKeepRanges(silences, duration){
    const keep = [];
    let cursor = 0;

    for (const silence of silences){
        if(cursor < silence.start){
            keep.push({start: cursor, end: silence.start});
        }
        cursor = silence.end
        if(cursor < duration){
            keep.push({start: cursor, end:duration});
        }
    }

    return keep; 
}

function parseDuration(output){
    console.log("OUTPUT", output)
    const match = output.match(/Duration: (\d+):(\d+):(\d+\.?\d*)/)
    if(!match){
        console.log("bad return")
        return 0;
    }
    else{
        console.log("return successful")
        return parseFloat(match[1]) * 3600 
        + parseFloat(match[2]) * 60 +
        parseFloat(match[3]);
    }
}