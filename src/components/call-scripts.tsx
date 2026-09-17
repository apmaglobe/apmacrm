"use client";
import { useState } from "react";
import { callScripts } from "@/lib/call-scripts";

export function CallScripts() {
  const [active, setActive] = useState<string>(callScripts[0].id);
  const script = callScripts.find((item) => item.id === active) ?? callScripts[0];
  return (
    <div className="call-scripts">
      <div className="segmented">
        {callScripts.map((item) => (
          <button
            type="button"
            key={item.id}
            className={item.id === active ? "selected" : ""}
            onClick={() => setActive(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="call-script-body">{script.body}</p>
    </div>
  );
}
