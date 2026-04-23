import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";


// src/main.tsx — add at the bottom, after ReactDOM.createRoot(...)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[SW] Registered:', reg.scope))
      .catch(err => console.warn('[SW] Registration failed:', err));
  });
}

createRoot(document.getElementById("root")!).render(<App />);
