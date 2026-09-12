import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { getUiVersion, setUiVersion } from "./lib/uiVersion";
import { getColorTheme, setColorTheme } from "./lib/colorTheme";
import { isLowPowerDevice } from "./lib/accessibility";

setUiVersion(getUiVersion());
setColorTheme(getColorTheme());
if (isLowPowerDevice()) document.documentElement.setAttribute("data-low-power", "1");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
