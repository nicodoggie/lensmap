# Default connection types

## Status and purpose

**Implemented experimental specification.** Nico's implementation request accepted this document, including its explicitly recorded [completion defaults](#completion-defaults-proposed-for-review). It remains the behavior contract, not a frozen public schema. See [qualification and host limitations](verification/default-connections.md) for exercised evidence and its limits.

The current [experimental schema](schema-v1.md) accepts the supplied relationship `type` and portal `url` fields. `version: v1` remains incomplete and experimental. Custom declarations and inherited defaults remain deferred.

The goal is to let authors enrich ordinary thought connections with a small vocabulary, and connect to external thoughts through visible portals, without restructuring their notes or losing their place in the map.

## Scope and exclusions

Include:

- Untyped connectedness and the supplied relationship/link types below.
- Flat authoring, strict validation and preservation of existing shorthand.
- Default connector styles, endpoint icons and accessible relationship inspection.
- First-class portal thoughts, explicit activation, map/anchor navigation and return history.
- Web-hosted resources in a standalone browser and local resources through an IDE/embedding host's authorized loader.
- Clear failures that preserve the current map and work.

Do not include:

- Custom type declaration syntax, shared vocabulary imports or a plugin framework; design those afterwards.
- Configurable document/context default connection types, inherited types or a core qualifier/composition system.
- Simulation, scheduling, prerequisite enforcement, inferred relationships or automatic outcome propagation.
- Automatic graph merging, remote backlinks, destination-source edits or automatic import of a linked map's thoughts.
- Standalone browser folder/file-picker workflows, persistent bookmark identities for unnamed thoughts, or a custom `lensmap:` protocol.
- A desktop application. A separate Tauri app with local-folder workflows is a far-future possibility, not a requirement or implementation authorization.
- New durable saving, collaboration, heading-slug generation or same-document heading-history contracts.

## Connection meaning and ownership

Untyped connectedness is complete and first-class. Authors need no relationship metadata for a useful stream-of-consciousness map or game-planning document. Nesting alone implies neither causality, chronology nor dependency. Prose links navigate; explicit connections alone define topology.

An entry in a thought's `connections` describes a connection from that containing thought to a destination. The destination is either defined inline or referenced through `node_id`.

Use flat rich entries: `type` is a sibling of `summary`, `full_text`, optional `id`, `position` and outgoing `connections`, or a sibling of `node_id` for a reference. There is no extra `node` wrapper. Normalization puts relationship metadata on the edge and content on the thought, without rewriting the authored source.

A type applies only to its individual incoming connection. It is not a global classification of the destination, does not propagate to the destination's outgoing edges, and does not prevent another connection to that thought from carrying a different type.

### Existing shorthand

Preserve the current forms when `type` is absent:

- A Markdown string defines a new thought through `full_text` shorthand.
- A rich object defines a thought with the existing content and metadata rules.
- A `node_id` reference connects to an existing thought.
- A bare nested array introduces a real unresolved intermediate thought connected to its entries. Do not flatten it into a group of direct edges.

Promote a string to a rich entry with `full_text` when adding a type. A typed unresolved thought uses the existing explicit null/empty content fields and retains its subtree. Property presence remains distinct from truthiness or an omitted field.

Summary/full-text presentation remains unchanged: the summary overrides collapsed presentation; otherwise derive the title from full text. Preserve complete Markdown source and do not require duplicated prose or authored IDs merely to add a type, notes or positioning.

### Current versus specified authoring

The following is accepted by the current schema; its connections are untyped:

```yaml
version: v1
nodes:
  - id: death
    full_text: The NPC is killed
    connections:
      - The NPC's last words
      - summary: Access to noble-house resources
        full_text: Borrow guards, money and the household carriage.
      - node_id: votes
      - - A possible successor
        - Another possible successor
  - id: votes
    full_text: Enough House of Lords votes to pass the ludicrous bill
```

The agreed extension adds types without moving the existing content:

```yaml
version: v1
nodes:
  - id: death
    full_text: The NPC is killed
    connections:
      - The NPC's last words
      - type: prevents
        summary: Access to noble-house resources
        full_text: Borrow guards, money and the household carriage.
      - type: prevents
        node_id: votes
      - - A possible successor
        - Another possible successor
  - id: votes
    full_text: Enough House of Lords votes to pass the ludicrous bill
```

Both examples are accepted. Adding relationship metadata preserves the existing source form.

## Supplied vocabulary and visual defaults

For an entry authored under A with destination B:

| Type            | Meaning                                    | Default presentation                                                                |
| --------------- | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| Type omitted    | Connected, without a more specific claim   | Solid line; no endpoint markers                                                     |
| `precedes`      | A comes before B in the described sequence | Solid line; arrowhead at B                                                          |
| `follows`       | A comes after B in the described sequence  | Solid line; arrowhead at A                                                          |
| `prevents`      | A rules out B                              | Solid line; two parallel blocking bars at B                                         |
| `optional`      | An optional connection or branch           | Dashed line; no endpoint markers                                                    |
| `external_link` | An ordinary external resource              | Solid line without arrowheads; external-link icon on the destination thought        |
| `map_link`      | A Lensmap destination                      | Solid line without arrowheads; distinctive swirly portal on the destination thought |

`precedes` and `follows` provide inverse readings, with the arrow pointing toward the later item in the sequence being described. Neither promises that the sequence is causal, immediate or executable. Source ordering does not implicitly create either relationship.

A prevention edge remains a real visible connection. For example, an NPC's death can prevent access to their house's resources or sufficient legislative votes. Keep those unavailable possibilities visible as useful thoughts; do not delete their edges, hide their nodes or disable their controls.

Default styles do not distinguish nested definitions from `node_id` references. Retain their structural distinction for layout/source ownership, not as an automatic dash or arrow. These defaults supersede the former dashed-arrowed reference presentation.

Styling primitives have no universal domain meaning. Our `optional` definition uses dashes, but a later custom vocabulary may assign another meaning to that style. Do not introduce an optionality qualifier system to express combinations.

Preserve existing branch colours, contrast/halos and distinct selection, pending-target and keyboard-focus cues. Do not make relationship meaning depend on colour. Apply relationship markers consistently in Lens, Overview, temporary neighbourhoods, loops and continuation segments; a cut-off segment must not invent a destination or reverse a relationship. Camera/lens projection remains separate from authored layout.

### Relationship wording

Do not permanently label every connector on the canvas. Show relationship wording:

- When inspecting a connection.
- In the explicit connection list and keyboard chooser.
- When hovering over a connector.

Use endpoint-aware readings, including `precedes` / `follows` and `prevents` / `is prevented by`. A hover description names the endpoints as well as the relationship, for example, "NPC's death prevents access to house resources." Untyped connections can say "connected to" without acquiring a semantic type.

Hover is additional convenience, not the only access path. Keyboard and touch users retain explicit inspection. Provide usable connector hit areas without breaking map panning. Inspection does not activate portals, move the camera, rearrange thoughts or change topology. Preserve each actual route when several edges reach the same destination.

## Portal thoughts

Both link types create visible, labelled endpoints connected to the originating thought: portals to extended thoughts, not panel-only attachments. They retain ordinary thought capabilities: optional IDs, summary, full Markdown, positioning, local incoming/outgoing connections and neighbourhood exploration.

### Progressive authoring and labels

Both types use `url` beside `type`. Type plus URL is sufficient; local prose is optional. When neither content field is supplied, display the authored address as fallback text. Do not require remote title fetching or generate prose back into the source.

Authors may progressively add a summary, Markdown, positioning and local connections without restructuring the entry. Existing content precedence and explicit null/empty placeholder behavior still apply when content fields are present.

This example illustrates accepted portal authoring:

```yaml
version: v1
nodes:
  - full_text: Prepare the council scene
    connections:
      - id: house-politics
        type: map_link
        url: thought_too.lensmap#some_id
      - type: external_link
        url: https://example.org/council-notes
        summary: Background reading
        full_text: Check the voting procedure before the session.
      - full_text: Prepare the succession dispute
        connections:
          - type: precedes
            node_id: house-politics
```

The first portal initially displays its address. A later reference reaches that same portal thought, not a duplicate.

### Identity and reuse

An authored portal `id` can be reused through ordinary `node_id` references. Reuse reaches the same destination, notes and local connections. A new edge keeps its own type or absence of one; the portal keeps its icon and activation behavior independently. In particular, an untyped reference remains untyped while its destination remains an openable portal.

Separately authored portal definitions remain distinct thoughts even if their URLs match. Do not automatically merge by URL or import the destination graph. Local connections do not write reciprocal links into the external source.

### Selection and activation

- A single click selects and exposes details; it does not open the destination.
- Ordinary keyboard browsing and Space acceptance select/recentre without opening it.
- Double-click or viewer-scoped Enter directly activates the destination, including from a deliberate keyboard connection choice.
- Provide an explicit accessible Open link / Enter portal action.
- Retain an explicit way to explore the portal's local neighbourhood; consuming double-click/Enter for opening must not make its local connections inaccessible.
- Ordinary thoughts keep their existing gestures. Editor, sidebar and unrelated control focus retain native keyboard handling.

Selecting, inspecting or hovering does not fetch/import a destination map. Portal loading begins on deliberate activation. Link activation is not permission to edit either source or move an IDE caret merely because the map is being explored.

## Destination loading and host boundaries

The author explicitly chooses `map_link` versus `external_link`; do not infer destination kind solely from a URL scheme or filename. Another map may be hosted over HTTPS.

Relative addresses resolve against the containing source map's resource location, not the viewer application's page/loopback URL. Keep the raw authored address unchanged while computing its resolved resource locator. A raw playground draft with no source location cannot resolve relative resources: explain the missing base rather than guessing a checkout path or treating the app's origin as the map location.

The **development runner only** provides an explicit root-URL convenience:
`pnpm dev` serves the repository's `examples/` at the dev origin's root, and
`/?map=/linked-maps.lensmap` loads a URL-backed example. A locationless dev draft
may resolve an explicit `/…` map address against that origin; ordinary `./…`
addresses still require a source location. A real source map's base always wins.
This opt-in does not apply to production builds, preview or the IDE bridge, and
does not copy examples into built assets or introduce a filesystem API.

### Standalone browser

Load web-hosted maps through ordinary browser HTTP(S) access, including its origin, CORS and authentication constraints. Do not add a proxy to bypass those constraints or introduce new credential setup in this feature.

Open ordinary web `external_link` destinations separately with `_blank` and explicit `noopener`. For `file:` external destinations or local maps unavailable to the browser, explain the host limitation and do not attempt arbitrary filesystem access. No local-folder picker is required by this spec.

A source `.lensmap` address is a resource for the viewer/host loader. It does not require every server to render raw YAML URLs as HTML. Hosts may map source locations to their actual viewer routes when exposing web links.

### IDE or embedding host

Use the host's authorized resource loader for local maps and its opening facilities for external web/file destinations. Respect integrated-versus-external browser preferences. The browser renderer does not execute editor commands or acquire arbitrary disk access.

An attached unsaved buffer is authoritative over its older saved file. Host loading must retain source resource identity and revision information and respect existing attachment/session boundaries. Use explicit host/source navigation when opening an unavailable local resource is necessary; do not silently widen access to an entire workspace or change editor focus merely to inspect a portal.

The current Zed bridge exposes attached documents, not a general filesystem loader. Qualify the supported host path for linked local maps before implementation promises access to unattached files. An authorization or native-host limitation must be visible; any broader access policy is a separate review boundary, not an excuse to install a helper or bypass the existing bridge restrictions.

Preserve the bridge's origin/authentication protections. Do not confuse thought fragments with its private bootstrap fragment, expose credentials in source links/history, or make a new unauthenticated file/network proxy.

## Map and thought navigation

### Address form and entry view

- `thought_too.lensmap` opens the destination in fitted, undistorted Overview.
- `thought_too.lensmap#some_id` opens normal Lens view with the requested thought selected and centred.
- No mandatory central thought or automatic document-title node is introduced.

Load and validate a map before replacing the current graph. Commit the destination and its resolved thought target consistently; a failed or superseded navigation must not partially replace the displayed map.

### Real thought anchors

Expose real web-viewer anchors backed by authored IDs and generated internal identities. A thought does not need an authored ID merely to have an anchor. This does not add Markdown heading-slug generation.

Authored IDs are exact names, not trimmed or slugified. Preserve them while resolving URL fragment encoding. Generated anchors must be unique and collision-free with authored anchors within the relevant rendered map. Their concrete generated spelling is not a public identity format; obtain the anchor from that rendered map rather than constructing one from a guessed internal key.

Generated anchors are stable within a rendered document version. Panning, zooming, selection and temporary neighbourhood views do not regenerate them. No guarantee extends across source edits, reopening or independent rendering. Authored IDs are the durable naming option while those names remain present.

The host must resolve a thought fragment into viewer selection/centring, not rely only on browser DOM scrolling. Scope anchors to the intended map/viewer so another embedding's similarly named thought cannot capture the navigation.

### History and work preservation

Successful cross-map navigation preserves a way back. Restore the prior map's view mode, camera, zoom, selected thought and lens settings, including relevant temporary-view state when its thoughts still exist. Ordinary panning and zooming do not create map-navigation history steps.

Both standalone and embedded viewers expose a visible, keyboard-accessible
**Back** action, with **Forward** when a retained forward visit exists. These are
map-owned controls, not a requirement to use the browser's traversal commands.
Standalone browser Back/Forward also remain supported; cooperate with host
history rather than commandeering it. Browser visits must retain their actual map
identity when viewer navigation branches and reuses a stack position. Returning
restores recorded view state, not the new-navigation Overview/Lens defaults.

Do not discard unapplied playground drafts or replace an authoritative editor buffer. View history is not source undo: returning must not overwrite newer source with an old snapshot. If live source changed, use current valid analysis and restore surviving view targets; make a removed target unavailable rather than assigning its identity to another thought. Internal keys are attachment-local: detach/reopen must invalidate stale internal-key selections, even when a new attachment reuses the same resource URI, revision number or key spelling. An authored ID may resolve again in the new analysis, but a coincident internal key is not identity evidence. This is in-session work preservation, not a new durable-saving promise.

### Missing anchors and other failures

If a map loads and validates but its requested fragment does not resolve:

1. Keep the current map, camera, zoom and selection unchanged.
2. Explain which target was not found. Do not record a successful cross-map navigation.
3. Provide a visible, keyboard-accessible **Open destination map anyway** action. This is required acceptance behavior, not optional polish.
4. That action navigates to the same valid destination without the unresolved fragment, starting in fitted Overview and preserving the normal way back. It does not edit the source link.

The fallback does not bypass map parsing/validation, host access rules or resource-loading failures. Missing/unreadable resources, CORS/authentication failures, unsupported opening capabilities and invalid maps preserve the current map/work and explain the failure. Never silently downgrade an invalid type or unresolved target into different semantics.

## Completion defaults proposed for review

These completion defaults were explicit in the reviewed draft and included in the subsequent implementation request. They close small gaps without changing progressive authoring.

1. **Explicit neutral name:** accept `type: connected` as an explicit neutral relation, rendered like an omitted type. Omission remains genuinely untyped; do not rewrite shorthand or introduce inherited defaults.
2. **Strict entry validation:** `type`, when present, is one exact supported string, not null, an array or an inferred spelling. Ordinary rich definitions still require a present content field. Portal definitions require a nonblank `url` and matching link type, but no prose. Reject `url` on ordinary relation definitions and mixed `node_id`/definition-content/URL overrides; do not guess which destination was meant.
3. **References to portals:** a `node_id` reference cannot redefine the thought's URL or content. Local relation types may point to any existing thought, including portals. An explicit `map_link` or `external_link` reference is valid only when the referenced thought already has the matching destination kind; otherwise report a validation error rather than mutating it.
4. **Top-level portals:** allow `map_link`/`external_link` plus `url` as a starting thought in `nodes`, retaining ordinary content capabilities. There is no incoming edge at the root, so the link type configures only the portal destination there. Other relationship types at the root are invalid because there is no origin. This exception follows from link types' operational destination behavior, not a new general node-type system.
5. **Parallel edges and cycles:** preserve authored edge occurrences, including inverse-looking or duplicate links. `A precedes B` and `B follows A` read equivalently but are not automatically deduplicated or converted into transitive edges. Do not add cycle rejection or scheduling semantics. Keep reference/content ambiguity checks and duplicate-ID checks.
6. **Address safety:** resolve URI syntax without rewriting source; decode fragment escapes once and match exact anchor names. Empty fragments mean whole-map entry. Invalid encoding or unsupported/unsafe schemes produce clear errors, never script/data execution. Hosts may delegate additional safe external schemes through their own policy; this is not universal opener support. Same-resource thought targeting may reuse the loaded graph without creating a cross-map history step; it does not introduce a new general same-document history policy.

## Architecture and implementation qualification

Extend the existing [authoring schema](../packages/document/src/v1/schema.ts), [semantic model](../packages/document/src/index.ts) and revision-bound analysis. Do not create a parallel graph model or require authored IDs everywhere. Preserve separate syntax validation, document-wide reference checks, source bindings, semantic snapshots and view-owned layout/camera state.

Carry per-edge relationship type separately from the existing structural `kind` (`branch` / `cross`). Portal destination kind/address must survive on the thought independently of later connecting edges. Extend revision comparison and viewer transport to preserve these distinctions without resetting unrelated view state. Keep source text, semantic graph and visual projection separate.

Generate structural JSON Schema from the owning Zod input schema, including the new supported fields/constraints; do not maintain a parallel handwritten validator. Semantic target/ID checks remain analysis responsibilities. Extend relevant language-service diagnostics/completion from the same revision-consistent analysis, not a second interpretation of the vocabulary.

The existing [Zed bridge](zed-browser.md) is evidence for current buffer/host boundaries, not proof that new local loading, portal opening or cross-map history already works. Native host loading/opening and browser-history integration are bounded implementation qualifications. Stop for review if they require broader privileges, a changed host policy, a new helper/daemon, desktop packaging or a different integration route.

## Acceptance gates

These remain the acceptance requirements. The separate [qualification record](verification/default-connections.md) records actual test and native-host evidence rather than turning this list into self-certifying completion claims.

- Existing strings, rich thoughts, references and bare arrays retain their topology and source-preserving behavior. Adding a type does not reparent nodes, infer relationships or require new IDs/wrappers.
- Flat inline and referenced relationships retain independent edge metadata across live edits. Explicit null/empty placeholders and their subtrees survive promotion. Invalid types or ambiguous destinations preserve raw source and the last valid graph, with correctly located diagnostics.
- Default line/endpoint styles work for nested and referenced connections in Lens, Overview and temporary neighbourhoods, including loops and continuation segments. Hover and keyboard inspection show the correct endpoints and forward/reverse wording without moving or opening anything; connector hit areas do not break panning.
- Minimal portals show address fallback labels. Local prose, positioning and connections work normally. ID references reuse the same portal, while separately defined same-URL portals remain distinct. A differently typed incoming edge does not change its destination.
- Single-click, keyboard browsing and Space do not open a portal. Double-click, viewer-scoped Enter and explicit actions do; ordinary-thought gestures and external editing focus remain intact. Local portal neighbourhoods remain accessible.
- Relative hosted and authorized host-local links use the source map's base. Web/file opening follows host policy. A locationless draft, denied resource, invalid map or unsupported opener fails clearly without new privileges or work loss.
- Whole-map destinations enter fitted Overview; valid thought fragments enter centred Lens view. Real authored/generated anchors resolve correctly, avoid collisions and remain stable through view changes. Generated anchors need no cross-version permanence.
- Successful cross-map Back/Forward restores relevant view state and surviving selection without source rollback or lost drafts. Pan/zoom add no cross-map history steps; late failed/superseded loads do not replace a newer view.
- A missing anchor preserves the current view and exposes **Open destination map anyway**. Exercise that action: it must actually open the valid map in Overview and retain the way back. Loading/access/schema errors cannot use it to bypass validation.

Use focused engine tests and native schema export/parity checks for owned semantics. Use the built viewer for actual pointer/keyboard/hover/history interactions, and native host proof for the local editor-loading/opening boundary. Avoid duplicate test frameworks or treating mocked host acknowledgments as end-to-end evidence.

## Review and stop rule

The default slice was separately authorized for implementation. Custom type declarations and shared vocabularies are the next design topic, not implied implementation work. No publication, Tauri app, wider filesystem authority or other deferred feature is authorized by completing this specification.
