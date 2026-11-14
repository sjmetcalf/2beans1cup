import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);

// Installable app + offline support. Skipped on localhost previews so dev builds never go stale.
if ("serviceWorker" in navigator && location.hostname !== "localhost") {
  addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
