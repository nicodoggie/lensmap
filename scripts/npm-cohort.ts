// Publication order is also dependency order. Historical releases use only runtimePackages.
export const runtimePackages = [
  "@lensmap/document",
  "@lensmap/language-server",
] as const;
export const astroPackages = [
  "@lensmap/astro-loader",
  "@lensmap/starlight",
] as const;
export const releasePackages = [...runtimePackages, ...astroPackages];

export const cohortDependencies: Record<string, readonly string[]> = {
  "@lensmap/document": [],
  "@lensmap/language-server": ["@lensmap/document"],
  "@lensmap/astro-loader": ["@lensmap/document"],
  "@lensmap/starlight": ["@lensmap/document", "@lensmap/astro-loader"],
};

const number = "(?:0|[1-9]\\d*)";
const prerelease = "(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)";
const exactVersion = new RegExp(
  `^${number}\\.${number}\\.${number}(?:-${prerelease}(?:\\.${prerelease})*)?$`,
);

export function requireExactVersion(version: string): void {
  if (!exactVersion.test(version))
    throw new Error(
      "Supply an exact version such as 0.1.0, not a tag, range or whitespace-modified value.",
    );
}
