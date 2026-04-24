import "./styles/index.css";
import { GameApp } from "./ui/GameApp.js";
import { Logger } from "./core/Logger.js";

/** Entry point. Bootstraps the game once the DOM is ready. */
function boot(): void {
  const root = document.getElementById("app");
  if (!root) {
    Logger.error("#app element not found");
    return;
  }
  new GameApp(root);
  Logger.info("Echoes of the Grid — booted");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
