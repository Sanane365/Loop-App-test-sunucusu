import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { configureNativeApi } from "./lib/native-api";

configureNativeApi()
  .then(() => createRoot(document.getElementById("root")!).render(<App />))
  .catch((error: unknown) => {
    console.error("Native API setup failed", error);
    const root = document.getElementById("root");
    if (root) root.textContent = "Uygulama sunucusuna bağlanılamadı. API yapılandırmasını kontrol edin.";
  });
