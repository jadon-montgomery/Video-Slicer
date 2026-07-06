import React from "react";
import { useEffect } from "react";
import { useState } from "react";

export const ModeSelect = ({ mode, setMode }) => {
  useEffect(() => {}, []);
  function toggleMode() {
    if (mode === 1) {
      setMode(0);
    } else {
      setMode(1);
    }
  }
  return (
    <div>
      <button onClick={toggleMode}>
        <p>{mode === 1 ? "speech" : "silence"}</p>
      </button>
    </div>
  );
};
