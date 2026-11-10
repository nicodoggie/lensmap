import { unwatchFile, watchFile } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { VocabularyInput } from "@lensmap/document";
import { readProjectVocabulary } from "@lensmap/document/project";

interface Project {
  input: VocabularyInput;
  signature: string;
  watches: Map<string, () => void>;
}
export interface VocabularyBuffer {
  source: string;
  version: number;
}
const filePath = (uri: string) => {
  try {
    return resolve(fileURLToPath(uri));
  } catch {
    return undefined;
  }
};

/** Only known workspace config and vocabulary files, never HTTP-supplied paths. */
export class ProjectVocabularies {
  private roots: string[] = [];
  private readonly projects = new Map<string, Project>();
  private readonly buffers = new Map<string, VocabularyBuffer>();
  private readonly requests = new Map<string, number>();
  private readonly pending = new Map<string, Promise<void>>();
  private serial = 0;
  private disposed = false;
  constructor(
    private readonly changed: (root: string, input: VocabularyInput) => void,
  ) {}
  setRoots(uris: readonly string[]) {
    this.clearWatches();
    this.roots = [...new Set(uris.flatMap((uri) => filePath(uri) ?? []))].sort(
      (a, b) => b.length - a.length,
    );
  }
  rootFor(uri: string): string | undefined {
    const path = filePath(uri);
    return path
      ? this.roots.find((root) =>
          path.startsWith(root.endsWith(sep) ? root : `${root}${sep}`),
        )
      : undefined;
  }
  private refresh(root: string, notify: boolean): Promise<void> {
    const request = ++this.serial;
    this.requests.set(root, request);
    const work = this.load(root, request, notify).finally(() => {
      if (this.pending.get(root) === work) this.pending.delete(root);
    });
    this.pending.set(root, work);
    return work;
  }
  private async load(root: string, request: number, notify: boolean) {
    if (this.disposed) return;
    const overlays = new Map(
      [...this.buffers].flatMap(([uri, buffer]) => {
        const path = filePath(uri);
        return path ? [[path, buffer.source] as const] : [];
      }),
    );
    const result = await readProjectVocabulary(root, overlays);
    if (
      this.disposed ||
      this.requests.get(root) !== request ||
      !this.roots.includes(root)
    )
      return;
    const signature = JSON.stringify(result.input);
    let project = this.projects.get(root);
    const changed = project?.signature !== signature;
    if (!project) {
      project = { input: result.input, signature, watches: new Map() };
      this.projects.set(root, project);
    }
    project.input = result.input;
    project.signature = signature;
    const files = new Set(result.files);
    for (const [path, listener] of project.watches) {
      if (files.has(path)) continue;
      unwatchFile(path, listener);
      project.watches.delete(path);
    }
    for (const path of files) {
      if (project.watches.has(path)) continue;
      const listener = () => {
        void this.refresh(root, true);
      };
      project.watches.set(path, listener);
      watchFile(path, { persistent: false, interval: 100 }, listener);
    }
    if (notify && changed) this.changed(root, project.input);
  }
  async forUri(uri: string): Promise<VocabularyInput> {
    const root = this.rootFor(uri);
    if (!root) return {};
    if (!this.projects.has(root) && !this.pending.has(root))
      void this.refresh(root, false);
    for (;;) {
      const work = this.pending.get(root);
      if (!work) break;
      await work;
    }
    return this.projects.get(root)?.input ?? {};
  }
  isResource(uri: string) {
    const path = filePath(uri),
      root = this.rootFor(uri);
    return Boolean(
      path &&
        (path.endsWith(".lenstypes") ||
          (root && path === resolve(root, "lensmap.config.json"))),
    );
  }
  buffer(uri: string) {
    return this.buffers.get(uri);
  }
  cachedInput(uri: string) {
    const root = this.rootFor(uri);
    return root ? this.projects.get(root)?.input : undefined;
  }
  async open(uri: string, source: string, version: number) {
    if (!this.isResource(uri)) return false;
    this.buffers.set(uri, { source, version });
    const root = this.rootFor(uri);
    if (root) await this.refresh(root, true);
    return true;
  }
  async close(uri: string) {
    if (!this.buffers.delete(uri)) return false;
    const root = this.rootFor(uri);
    if (root) await this.refresh(root, true);
    return true;
  }
  resources(root?: string): string[] {
    return [...this.buffers.keys()].filter(
      (uri) => !root || this.rootFor(uri) === root,
    );
  }
  private clearWatches() {
    for (const project of this.projects.values())
      for (const [path, listener] of project.watches)
        unwatchFile(path, listener);
    this.projects.clear();
    this.requests.clear();
    this.pending.clear();
  }
  dispose() {
    this.disposed = true;
    this.clearWatches();
    this.buffers.clear();
  }
}
