const path = require("path");

export function parseFrameRate(output) {
  const match = output.match(/(\d+\.?\d*) fps/);
  return match ? parseFloat(match[1]) : 30;
}

export function parseVideoInfo(output) {
  const match = output.match(/Video:.*?(\d{3,5})x(\d{3,5})/);
  return match
    ? { width: parseInt(match[1]), height: parseInt(match[2]) }
    : { width: 1920, height: 1080 }; // fallback
}

function convertToLocalHostPath(filePath) {
  const newPath = filePath
    .replace(/\\/g, "/")
    .replace(/^([A-Za-z]):/, (match, letter) => letter + "%3a");
  return "file://localhost/" + newPath;
}

export function generateXML(
  keepRanges,
  sourcePath,
  fps,
  totalDuration,
  videoInfo,
) {
  const name = "test project";
  const uuid = crypto.randomUUID();
  const filePath = convertToLocalHostPath(sourcePath);
  const fileName = path.basename(sourcePath);
  const totalSourceFrames = Math.round(totalDuration * fps);
  const clips = [];

  const pproTicksPerFrame = Math.round(
    (254016000000 * 1001) / (1000 * Math.round(fps)),
  );

  let durationFPS = 0;

  for (const range of keepRanges) {
    //Duration of each clip
    const startRangeFPS = Math.round(range.start * fps);
    const endRangeFPS = Math.round(range.end * fps);
    const sequenceStartFPS = durationFPS;
    const fullRangeFPS = Math.round((range.end - range.start) * fps);
    const pproTicksPerFrameInput = pproTicksPerFrame * startRangeFPS;
    const pproTicksPerFrameOutput = pproTicksPerFrame * endRangeFPS;

    const sequenceEndFPS = durationFPS + fullRangeFPS;
    durationFPS += fullRangeFPS;

    clips.push({
      clipInFrame: startRangeFPS,
      clipOutFrame: endRangeFPS,
      seqStartFPS: sequenceStartFPS,
      seqEndFPS: sequenceEndFPS,
      pproTicksIn: pproTicksPerFrameInput,
      pproTicksOut: pproTicksPerFrameOutput,
    });
  }
  const videoClipItems = clips
    .map((clip, index) => {
      return `<clipitem id="clipitem-${index + 1}">
	<masterclipid>masterclip-1</masterclipid> 
	<name>${fileName}</name> 
	<enabled>TRUE</enabled> 
	<duration>${totalSourceFrames}</duration> 
	<rate>
        <timebase>${Math.round(fps)}</timebase>
        <ntsc>TRUE</ntsc>
    </rate>
	<start>${clip.seqStartFPS}</start>
	<end>${clip.seqEndFPS}</end>
	<in>${clip.clipInFrame}</in>
	<out>${clip.clipOutFrame}</out>
	<alphatype>none</alphatype>
	<anamorphic>FALSE</anamorphic>
    <pixelaspectratio>square</pixelaspectratio>
	<pproTicksIn>${clip.pproTicksIn}</pproTicksIn>
	<pproTicksOut>${clip.pproTicksOut}</pproTicksOut>


	${
    index === 0
      ? `<file id="file-1">
	  <name>${fileName}</name> 
	  <pathurl>${filePath}</pathurl>
	  <rate>
                <timebase>${Math.round(fps)}</timebase>
                <ntsc>TRUE</ntsc>
            </rate>
	 
	  <duration>${totalSourceFrames}</duration> 

		<timecode>
		 <rate>
		 <timebase>${Math.round(fps)}</timebase>
		 <ntsc>TRUE</ntsc>
	 </rate>
	         <string>00;00;00;00</string>
    <frame>0</frame>
     <displayformat>DF</displayformat>
    </timecode>
	<media>
	 <video>
	       <samplecharacteristics>
		    <rate>
                <timebase>${Math.round(fps)}</timebase>
                <ntsc>TRUE</ntsc>
            </rate>
            <width>${videoInfo.width}</width>
            <height>${videoInfo.height}</height>

            <anamorphic>FALSE</anamorphic>
            <pixelaspectratio>square</pixelaspectratio>
            <fielddominance>none</fielddominance>
        </samplecharacteristics>
		 </video>

		 <audio>
    <samplecharacteristics>
    <samplerate>48000</samplerate>
    <depth>16</depth>
    </samplecharacteristics>
    <layout>mono</layout>
    <channelcount>1</channelcount>
</audio>
	</media>
		</file>`
      : `<file id="file-1"/>`
  }
  <sourcetrack>
    <mediatype>video</mediatype>
    <trackindex>1</trackindex>
</sourcetrack>
	
	<link>
<mediatype>video</mediatype>
<trackindex>1</trackindex>
<clipindex>${index + 1}</clipindex> 
</link>
	<link>
<mediatype>audio</mediatype>
<trackindex>1</trackindex>
<clipindex>${index + 1}</clipindex> 

    <groupindex>1</groupindex>
</link>
	</clipitem>
	
	`;
    })
    .join("\n");

  const audioClipItems = clips
    .map((clip, index) => {
      return `<clipitem id="audio-clipitem-${index + 1}">
	<masterclipid>masterclip-1</masterclipid> 
	<name>${fileName}</name> 
	<enabled>TRUE</enabled> 
	<duration>${totalSourceFrames}</duration> 
	<rate>
        <timebase>${Math.round(fps)}</timebase>
        <ntsc>TRUE</ntsc>
    </rate>
	<start>${clip.seqStartFPS}</start>
	<end>${clip.seqEndFPS}</end>
	<in>${clip.clipInFrame}</in>
	<out>${clip.clipOutFrame}</out>

<file id="file-1"/>
	
	
<sourcetrack>
<mediatype>audio</mediatype>
<trackindex>1</trackindex>
</sourcetrack>

	</clipitem>
	
	`;
    })
    .join("\n");

  //May need to change the sequence ID to something dynamic later
  return `<xmeml version="4">
  <sequence id="sequence-1"> 
  <name>${name}</name>
  <uuid>${uuid}</uuid> 
  <duration>${durationFPS}</duration> 
  <rate>
	<timebase>${Math.round(fps)}</timebase>
	<ntsc>TRUE</ntsc>
	</rate>
	<media>
	<video>
	<format>
	    <samplecharacteristics>
	<rate>
                <timebase>${Math.round(fps)}</timebase>
                <ntsc>TRUE</ntsc>
            </rate>
            <width>${videoInfo.width}</width>
            <height>${videoInfo.height}</height>

            <anamorphic>FALSE</anamorphic>
            <pixelaspectratio>square</pixelaspectratio>
            <fielddominance>none</fielddominance>
			<colordepth>24</colordepth>
			</samplecharacteristics>
</format>
	<track>
${videoClipItems}

</track> 
</video>
	 <audio>
   <format>
    <samplecharacteristics>
    <samplerate>48000</samplerate>
    <depth>16</depth>
    </samplecharacteristics>
   </format>

   <track>
      ${audioClipItems}
   </track>

</audio>

	</media>
  </sequence>

 </xmeml>
  `;
}
