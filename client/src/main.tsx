import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "./providers/ThemeProvider";

// Add error boundary for safer rendering
try {
  createRoot(document.getElementById("root")!).render(
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
} catch (error) {
  console.error("Failed to render application:", error);
  // Fallback rendering without theme provider if it causes issues
  createRoot(document.getElementById("root")!).render(<App />);
}
