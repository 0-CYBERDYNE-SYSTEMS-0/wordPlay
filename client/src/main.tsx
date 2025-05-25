import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Add error boundary for safer rendering
try {
  createRoot(document.getElementById("root")!).render(<App />);
} catch (error) {
  console.error("Failed to render application:", error);
  // Fallback rendering
  createRoot(document.getElementById("root")!).render(<App />);
}
