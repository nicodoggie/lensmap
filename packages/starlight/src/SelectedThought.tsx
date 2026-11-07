import { useId, useMemo, useState } from "react";

function readingExcerpt(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const text = template.content.textContent?.replace(/\s+/g, " ").trim() ?? "";
  if (text.length <= 800) return null;

  // Preview an existing paragraph/list item, not an arbitrary clipped HTML box.
  // The complete compiled/sanitized HTML stays untouched in the hidden region.
  const first = template.content.querySelector("p, li")?.textContent ?? text;
  const paragraph = first.replace(/\s+/g, " ").trim();
  const end =
    paragraph.length > 360 ? paragraph.lastIndexOf(" ", 360) : paragraph.length;
  return {
    heading: template.content.querySelector("h1, h2, h3, h4, h5, h6")
      ?.textContent,
    text: `${paragraph.slice(0, end > 0 ? end : 360)}…`,
  };
}

export default function SelectedThought({ html }: { html: string }) {
  const excerpt = useMemo(() => readingExcerpt(html), [html]);
  const [expanded, setExpanded] = useState(false);
  const fullId = useId();
  if (!excerpt) {
    return (
      <div
        className="sl-markdown-content"
        data-selected-content
        // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML comes only from sanitized Markdown or explicitly admitted host MDX compilation.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <div className="sl-markdown-content" data-selected-content>
      <div data-thought-excerpt hidden={expanded}>
        {excerpt.heading && <h3>{excerpt.heading}</h3>}
        <p>{excerpt.text}</p>
      </div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={fullId}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "Show less" : "Show more"}
      </button>
      <div
        id={fullId}
        data-thought-full
        hidden={!expanded}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML comes only from sanitized Markdown or explicitly admitted host MDX compilation.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
