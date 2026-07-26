import { useState, useRef } from "react";
import "../App.css";
import Renderer from "./renderer.jsx";
import { ModeSelect } from "./mode_select.jsx";

function App() {
  const [mode, setMode] = useState(1);
  const [transcribedText, setTranscribedText] = useState([]);
  const [silences, setSilences] = useState([]);
  const [fileName, setFileName] = useState("");
  const [modeSelectActive, setModeSelectActive] = useState(false);
  const rendererRef = useRef(null);
  const modes = ["Silence Detection", "Audio Transcription"];

  function handleClick(item) {
    console.log("selected", item.target);
    if (item.selected) {
    }
  }
  function trimVideo() {}
  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center background">
      <p className="font-inter font-medium text-2xl text-black m-4">
        {fileName != "" ? fileName : "Video Slicer"}
      </p>
      <div className="w-fit h-fit m-2">
        <p className=" h-fit w-[64ch] text-center" id="outputLog"></p>
      </div>
      <Renderer
        ref={rendererRef}
        setTranscribedText={setTranscribedText}
        transcribedText={transcribedText}
        mode={mode}
        setFileName={setFileName}
      ></Renderer>

      <button
        onClick={() => {
          setModeSelectActive(!modeSelectActive);
        }}
        className="font-inter font-medium w-[20ch] m-2"
      >
        <div className="flex justify-center items-center gap-2 bg-white w-fit rounded-sm ">
          {mode === 0 ? modes[0] : modes[1]}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-[10%]"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
          </svg>
        </div>
      </button>
      <div
        className={`${modeSelectActive ? "" : "hidden"} flex flex-col justify-center items-center bg-white p-2 text-sm font-inter font-medium rounded-sm`}
        aria-labelledby="dropdownHoverButton"
      >
        <button
          onClick={() => {
            console.log("CLICKED");
            setModeSelectActive(false);
            setMode(1);
          }}
          className="drop-down-option"
        >
          {modes[1]}
        </button>

        <button
          onClick={() => {
            console.log("CLICKED");
            setModeSelectActive(false);
            setMode(0);
          }}
          className="drop-down-option"
        >
          {modes[0]}
        </button>
      </div>
      {/* <ModeSelect mode={mode} setMode={setMode}></ModeSelect> */}
      <div className="m-4 w-[80%] transcription-container flex flex-col justify-center items-center">
        <div className="w-fit h-fit m-2">
          <p className="sub-heading-text">Transcription</p>
        </div>

        <div className="w-full h-[80%] overflow-auto flex flex-wrap items-center justify-start">
          {transcribedText.map((item, index) => {
            return (
              <button
                key={index}
                onClick={() => {
                  console.log("click", item.type);
                  if (item.type === "text") {
                  } else {
                    setTranscribedText((previousContent) =>
                      previousContent.map((contentItem) =>
                        contentItem.id === item.id
                          ? { ...contentItem, selected: !item.selected }
                          : contentItem,
                      ),
                    );
                  }
                }}
                className="w-fit transcription-text hover:scale-[115%] duration-200 translate"
              >
                <p
                  className={`transcription-text duration-200 ${item.type === "text" ? "text-white" : "text-blue"} ${item.selected ? "text-green-400" : "text-red-400"}`}
                >
                  {item.type === "text" ? item.text : "<- ->"}
                </p>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => rendererRef.current?.extractSilences()}
          className="primary-btn w-[50%] h-[15%]"
        >
          Chop!
        </button>
      </div>
    </div>
  );
}

export default App;
