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
    <button
      className="w-56 rounded-4xl m-6 p-5  border-2 border-amber-300"
      onClick={toggleMode}
    >
      <p className="text-white font-semibold">
        {mode === 1 ? "speech" : "silence"}
      </p>
    </button>
  );
};
