import { createRoot } from "react-dom/client";
import BridgeApp from "./BridgeApp";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Lensmap could not find its preview root.");
createRoot(root).render(<BridgeApp />);
