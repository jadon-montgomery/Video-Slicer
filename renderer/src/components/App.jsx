import { useState } from "react";
import "../App.css";
import Renderer from "./renderer.jsx";
import { ModeSelect } from "./mode_select.jsx";

function App() {
  const [mode, setMode] = useState(1);
  const [transcribedText, setTranscribedText] = useState([]);
  function handleClick(item) {
    console.log("selected", item.target);
    if (item.selected) {
    }
  }

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center">
      <h1 className="underline">Video Slicer</h1>
      <div className="w-fit h-fit m-2">
        <p className=" h-fit w-[64ch] text-center" id="outputLog"></p>
      </div>
      <Renderer
        setTranscribedText={setTranscribedText}
        transcribedText={transcribedText}
        mode={mode}
      ></Renderer>

      <ModeSelect mode={mode} setMode={setMode}></ModeSelect>
      <div className="w-fit h-fit m-2">
        <p className=" text-white font-semibold m-4">Transcription:</p>
      </div>

      <div className="w-[80%]  h-fit flex flex-wrap items-center justify-start">
        {transcribedText.map((item, index) => {
          return (
            <button
              key={index}
              onClick={handleClick}
              className="w-fit translation-text hover:scale-[115%] duration-200 translate"
            >
              <p
                className={`${item.type === "text" ? "text-white" : "text-blue"} ${item.selected ? "text-green-400" : ""}`}
              >
                {item.type === "text" ? item.text : "<- ->"}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default App;
