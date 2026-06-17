import invariant from "tiny-invariant";

type FrontendBundleFile = {
  path: string;
  content: string | Uint8Array;
};

export type FrontendBundleUpload = {
  files: FrontendBundleFile[];
};

function getBundleKey(id: string, filePath: string) {
  const normalized = filePath.replace(/^\/+/, "");
  if (normalized.includes("..")) {
    throw new Error(`Invalid bundle file path: ${filePath}`);
  }
  return `${id}/${normalized}`;
}

export async function uploadGameFrontendBundle(
  env: Env,
  id: string,
  bundle: FrontendBundleUpload,
) {
  invariant(env.GAME_BUNDLES, "Missing R2 binding: GAME_BUNDLES");

  await Promise.all(
    bundle.files.map(async (file) => {
      const key = getBundleKey(id, file.path);
      await env.GAME_BUNDLES.put(key, file.content);
    }),
  );
}

export async function readGameFrontendBundleFile(
  env: Env,
  id: string,
  requestPath: string,
) {
  invariant(env.GAME_BUNDLES, "Missing R2 binding: GAME_BUNDLES");

  const safeRelativePath = requestPath === "" ? "index.html" : requestPath;
  const key = getBundleKey(id, safeRelativePath);
  const object = await env.GAME_BUNDLES.get(key);
  if (!object) {
    return null;
  }

  const content = new Uint8Array(await object.arrayBuffer());
  return { content, path: safeRelativePath };
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
