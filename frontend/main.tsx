import React from "react";
import { createRoot } from "react-dom/client";
import CallilogApp from "../app/page";
import "../app/globals.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Callilog root element was not found.");
}

document.documentElement.style.setProperty(
  "--font-sans",
  '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif'
);
document.documentElement.style.setProperty(
  "--font-mono",
  '"JetBrains Mono", ui-monospace, monospace'
);

createRoot(rootElement).render(
  <React.StrictMode>
    <CallilogApp />
  </React.StrictMode>
);
