import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/tailwind.css";
import "./styles/index.css";
import "./styles/music.css";

const container = document.getElementById("root");
const root = createRoot(container);

// Detect if running inside Capacitor (native mobile WebView)
const isCapacitor = window.location.hostname === 'localhost' && /android|iphone|ipad/i.test(navigator.userAgent);
if (isCapacitor) {
    document.documentElement.classList.add('safe-area-layout');
    document.body.classList.add('safe-area-layout');
}

root.render(
    <App />
);
