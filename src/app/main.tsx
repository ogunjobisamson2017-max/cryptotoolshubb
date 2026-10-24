import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { captureAttribution } from "./lib/api";
import "./styles.css";

captureAttribution();

const el = document.getElementById("root");
if (!el) throw new Error("Root element missing");

createRoot(el).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
