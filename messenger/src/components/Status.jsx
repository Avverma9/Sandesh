import React, { useState } from "react";
import { useConnectionStatus } from "../../util/connection";

export default function Status() {
  const { online, serverUp, checkNow } = useConnectionStatus({ pollInterval: 5000, timeout: 3000 });
  const [checking, setChecking] = useState(false);

  const manualCheck = async () => {
    setChecking(true);
    try {
      await checkNow();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto mt-12 bg-white/10 rounded-lg text-white">
      <h2 className="text-2xl font-bold mb-4">Connection Status</h2>

      <div className="mb-3">
        <div className="text-sm text-white/80">Network:</div>
        <div className={`inline-block px-3 py-1 rounded-full mt-1 ${online ? "bg-green-500 text-black" : "bg-red-500 text-white"}`}>
          {online ? "Online" : "Offline"}
        </div>
      </div>

      <div className="mb-3">
        <div className="text-sm text-white/80">Server:</div>
        <div className={`inline-block px-3 py-1 rounded-full mt-1 ${serverUp ? "bg-green-500 text-black" : serverUp === false ? "bg-red-500 text-white" : "bg-yellow-500 text-black"}`}>
          {serverUp === null ? "Checking..." : serverUp ? "Up" : "Down / Unreachable"}
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          onClick={manualCheck}
          disabled={checking}
          className="bg-white text-blue-600 font-bold py-2 px-4 rounded disabled:opacity-60"
        >
          {checking ? "Checking..." : "Check now"}
        </button>
        <a href="/" className="ml-auto text-sm text-white/80 underline">Back</a>
      </div>
    </div>
  );
}
