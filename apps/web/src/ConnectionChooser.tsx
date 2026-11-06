import { connectionWording } from "@lensmap/document";
import { useEffect, useRef } from "react";
import { type GraphNode, label } from "./graph";
import type { ConnectionChoice } from "./navigation";

export default function ConnectionChooser({
  choice,
  origin,
  visibleKeys,
  onPick,
  onAccept,
  onCancel,
  onActivatePortal,
}: {
  onActivatePortal?: (node: GraphNode) => void;
  choice: ConnectionChoice;
  origin: GraphNode;
  visibleKeys: ReadonlySet<string>;
  onPick: (index: number) => void;
  onAccept: () => void;
  onCancel: () => void;
}) {
  const current = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (choice.candidates[choice.index])
      current.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [choice]);
  return (
    <section
      className="connection-chooser"
      data-connection-chooser="true"
      aria-label="Connection choices"
    >
      <h2>Connections from {label(origin)}</h2>
      <p>
        {choice.direction.replace("Arrow", "")} · Shift+arrow chooses · Space
        travels · Enter switches view · Esc cancels
      </p>
      {choice.candidates.length ? (
        <ol>
          {choice.candidates.map((candidate, index) => (
            <li key={candidate.node.key}>
              <button
                className="connection-option"
                ref={index === choice.index ? current : undefined}
                type="button"
                id={`connection-option-${candidate.node.key}`}
                aria-label={`Preview ${label(candidate.node)}`}
                aria-describedby={`connection-details-${candidate.node.key}`}
                aria-pressed={index === choice.index}
                onClick={() => onPick(index)}
              >
                <strong>{label(candidate.node)}</strong>
                <span id={`connection-details-${candidate.node.key}`}>
                  {candidate.routes.map((route, routeIndex) => (
                    <span key={`${route.edge.key}:${route.direction}`}>
                      {routeIndex > 0 ? " · " : ""}
                      {connectionWording(route.edge.type, route.direction)}
                      {` (${route.direction} ${route.edge.kind === "branch" ? "branch" : "cross-link"})`}
                    </span>
                  ))}
                  {!visibleKeys.has(candidate.node.key) && (
                    <span className="outside-view">outside this view</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p>No connections in this direction</p>
      )}
      <div className="connection-actions">
        <button
          type="button"
          disabled={!choice.candidates.length}
          onClick={onAccept}
        >
          Go to thought
        </button>
        {choice.candidates[choice.index]?.node.destination && (
          <button
            type="button"
            disabled={!onActivatePortal}
            onClick={() =>
              onActivatePortal?.(choice.candidates[choice.index].node)
            }
          >
            Open{" "}
            {choice.candidates[choice.index].node.destination?.kind ===
            "map_link"
              ? "destination map"
              : "external link"}
          </button>
        )}
        <button type="button" onClick={onCancel}>
          Cancel choice
        </button>
      </div>
    </section>
  );
}
