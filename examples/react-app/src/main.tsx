import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { InsightCard } from "./InsightCard";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main>
      <p>React workspace</p>
      <h1>Signals, clearly framed.</h1>
      <InsightCard />
    </main>
  </StrictMode>
);
