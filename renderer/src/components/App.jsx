import { useState } from "react";
import "../App.css";
import Renderer from "./renderer.jsx";
import { ModeSelect } from "./mode_select.jsx";

function App() {
  const [mode, setMode] = useState(1);
  const [transcribedText, setTranscribedText] = useState([]);
  function handleClick(item) {}

  return (
    <div>
      <h1 className="underline">Video Slicer</h1>
      <Renderer
        setTranscribedText={setTranscribedText}
        transcribedText={transcribedText}
        mode={mode}
      ></Renderer>
      <ModeSelect mode={mode} setMode={setMode}></ModeSelect>
      <pre id="outputLog"></pre>
      <p>Transcription:</p>
      <div className="flex items-center justify-center">
        {transcribedText.map((item, index) => {
          return (
            <button
              key={index}
              onClick={handleClick}
              className="w-fit translation-text hover:scale-[115%] duration-200 translate"
            >
              <p className={item.type === "text" ? "text-white" : "text-blue"}>
                {item.type === "text" ? item.text : "GAP"}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default App;
