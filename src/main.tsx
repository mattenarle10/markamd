import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app";
import { PreviewWindow } from "./components/editor";
import { I18nProvider } from "./lib";
import "./styles/globals.css";

// platform class on <html> — lets CSS gate macOS-only chrome (traffic-light
// padding) without runtime checks. set before first paint so layout never
// flashes the wrong padding.
const ua = navigator.userAgent;
const platformClass = /Mac|iPhone|iPad|iPod/i.test(ua)
  ? "is-mac"
  : /Windows/i.test(ua)
    ? "is-windows"
    : /Linux/i.test(ua)
      ? "is-linux"
      : "is-unknown"; // no platform-specific chrome applied — safe default
document.documentElement.classList.add(platformClass);

const params = new URLSearchParams(window.location.search);
const Root = params.get("window") === "preview" ? PreviewWindow : App;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <Root />
    </I18nProvider>
  </React.StrictMode>,
);
