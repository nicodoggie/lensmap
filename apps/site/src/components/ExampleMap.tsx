import { type GraphData, Viewer } from "../../../web/src/embed";
import "../../../web/src/viewer.css";
export default function ExampleMap({ graph }: { graph: GraphData }) {
  return (
    <Viewer graph={graph} embedded initialOverview showInspector={false} />
  );
}
