function nextScenePath(
  scenes: readonly string[],
  dir: string,
  stem: string,
): string {
  const base = `${dir}${stem}.scene`;
  if (!scenes.includes(base)) return base;
  let n = 2;
  while (scenes.includes(`${dir}${stem}-${n}.scene`)) n += 1;
  return `${dir}${stem}-${n}.scene`;
}

function listSceneDirectories(scenes: readonly string[]): string[] {
  const dirs = new Set<string>();
  for (const scene of scenes) {
    const slash = scene.lastIndexOf("/");
    dirs.add(slash >= 0 ? scene.slice(0, slash + 1) : "");
  }
  if (dirs.size === 0) {
    dirs.add("source/scenes/");
  }
  return [...dirs].sort();
}

function promptSaveDirectory(scenes: readonly string[]): string | null {
  const dirs = listSceneDirectories(scenes);
  const defaultDir = dirs[0] ?? "source/scenes/";

  if (dirs.length === 1) {
    const saveHere = window.confirm(`Save scene to ${defaultDir}?`);
    return saveHere ? defaultDir : null;
  }

  const listing = dirs.map((dir, index) => `${index + 1}. ${dir}`).join("\n");
  const input = window.prompt(
    `Choose a directory for this scene file:\n${listing}\n\nEnter directory path:`,
    defaultDir,
  );
  if (input === null) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

export function pickUntitledSceneSavePath(
  scenes: readonly string[],
): string | null {
  const directory = promptSaveDirectory(scenes);
  if (!directory) return null;
  return nextScenePath(scenes, directory, "untitled");
}
