import invariant from "tiny-invariant";

const THUMBNAIL_KEY_SUFFIX = "__gameide__/thumbnail";

function getThumbnailKey(id: string) {
  return `${id}/${THUMBNAIL_KEY_SUFFIX}`;
}

export async function uploadGameThumbnail(
  env: Env,
  id: string,
  content: Uint8Array,
  contentType: string,
) {
  invariant(env.GAME_BUNDLES, "Missing R2 binding: GAME_BUNDLES");
  await env.GAME_BUNDLES.put(getThumbnailKey(id), content, {
    httpMetadata: { contentType },
  });
}

export async function readGameThumbnail(env: Env, id: string) {
  invariant(env.GAME_BUNDLES, "Missing R2 binding: GAME_BUNDLES");
  const object = await env.GAME_BUNDLES.get(getThumbnailKey(id));
  if (!object) {
    return null;
  }

  return {
    content: new Uint8Array(await object.arrayBuffer()),
    contentType: object.httpMetadata?.contentType ?? "application/octet-stream",
  };
}
