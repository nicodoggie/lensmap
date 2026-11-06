import { useState } from "react";
import { parseSource } from "./document/parse";
import Sidebar from "./Sidebar";
import sampleSource from "./sample.yaml?raw";
import Viewer from "./Viewer";

const initialDocument = parseSource(sampleSource);
if (!initialDocument.ok)
  throw new Error(`The Lensmap sample is invalid: ${initialDocument.error}`);
const sampleGraph = initialDocument.graph;

export default function App() {
  const [graph, setGraph] = useState(sampleGraph);
  const [source, setSource] = useState(sampleSource);
  const [applied, setApplied] = useState(sampleSource);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  return (
    <Viewer
      graph={graph}
      updateMode="replace"
      renderSidebar={(context) => (
        <Sidebar
          {...context}
          source={source}
          applied={applied}
          error={error}
          status={status}
          onSourceChange={setSource}
          onApply={() => {
            const result = parseSource(source);
            if (!result.ok) {
              setError(result.error);
              setStatus("");
              return;
            }
            setGraph(result.graph);
            setApplied(source);
            setError("");
            setStatus(
              `Applied ${result.graph.nodes.length} thoughts and ${result.graph.edges.length} connections.`,
            );
          }}
          onLoadSample={() => {
            setSource(sampleSource);
            setError("");
            setStatus(
              "Sample loaded into the draft. Apply YAML to change the map.",
            );
          }}
        />
      )}
    />
  );
}
