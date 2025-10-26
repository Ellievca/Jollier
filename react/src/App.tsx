// react/src/App.tsx
import ConductorLaneVisualizer from "./ConductorLaneVisualizer";

export default function App() {
  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4ede0" }}>
      <ConductorLaneVisualizer />
    </div>
  );
}
