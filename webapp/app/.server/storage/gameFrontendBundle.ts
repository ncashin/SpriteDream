import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import invariant from "tiny-invariant";

type FrontendBundleFile = {
  path: string;
  content: string | Uint8Array;
};

export type FrontendBundleUpload = {
  files: FrontendBundleFile[];
};

export function getGameBundlesVolumePath() {
  const volumePath = process.env.GAME_BUNDLE_VOLUME_PATH;
  invariant(volumePath, "Missing required env var: GAME_BUNDLE_VOLUME_PATH");
  return volumePath;
}

export function getGameBundleDirectory(gameId: string) {
  return path.resolve(getGameBundlesVolumePath(), gameId);
}

export async function uploadGameFrontendBundle(
  gameId: string,
  bundle: FrontendBundleUpload,
) {
  const gameBundleDirectory = getGameBundleDirectory(gameId);
  await mkdir(gameBundleDirectory, { recursive: true });

  await Promise.all(
    bundle.files.map(async (file) => {
      const outputPath = path.resolve(gameBundleDirectory, file.path);
      if (!outputPath.startsWith(gameBundleDirectory)) {
        throw new Error(`Invalid bundle file path: ${file.path}`);
      }

      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, file.content);
    }),
  );
}

export async function readGameFrontendBundleFile(
  gameId: string,
  requestPath: string,
) {
  const gameBundleDirectory = getGameBundleDirectory(gameId);
  const safeRelativePath = requestPath === "" ? "index.html" : requestPath;
  const absolutePath = path.resolve(gameBundleDirectory, safeRelativePath);

  if (!absolutePath.startsWith(gameBundleDirectory)) {
    return null;
  }

  try {
    const content = await readFile(absolutePath);
    return { content, absolutePath };
  } catch {
    return null;
  }
}

export function getDefaultFrontendBundle(
  gameTitle: string,
): FrontendBundleUpload {
  return {
    files: [
      {
        path: "index.html",
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${gameTitle}</title>
  </head>
  <body>
    <div id="root">GameIDE Placeholder</div>
  </body>
</html>
`,
      },
    ],
  };
}
