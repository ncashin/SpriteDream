import { getGameById, setGameThumbnail } from "~/.server/database/game";
import { uploadGameFrontendBundle } from "~/.server/storage/gameFrontendBundle";
import { uploadGameThumbnail } from "~/.server/storage/gameThumbnail";
import { isValidGameId } from "../../shared/gameId";

type UploadBundleRequest = {
  files?: Array<{
    path?: string;
    contentBase64?: string;
  }>;
  thumbnail?: {
    contentBase64?: string;
    contentType?: string;
  };
};

const ALLOWED_THUMBNAIL_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function action({
  params,
  request,
  context,
}: {
  params: { id?: string };
  request: Request;
  context: { cloudflare: { env: Env } };
}) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const id = params.id?.trim();
  if (!id || !isValidGameId(id)) {
    return new Response("Game not found", { status: 404 });
  }

  const game = await getGameById(context.cloudflare.env, id);
  if (!game) {
    return new Response("Game not found", { status: 404 });
  }

  let body: UploadBundleRequest;
  try {
    body = (await request.json()) as UploadBundleRequest;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const files = body.files;
  if (!Array.isArray(files) || files.length === 0) {
    return new Response("Expected non-empty files array", { status: 400 });
  }

  for (const file of files) {
    if (
      !file ||
      typeof file.path !== "string" ||
      file.path.length === 0 ||
      typeof file.contentBase64 !== "string"
    ) {
      return new Response("Invalid file entry", { status: 400 });
    }
  }

  await uploadGameFrontendBundle(context.cloudflare.env, game.id, {
    files: files.map((file) => ({
      path: file.path as string,
      content: base64ToUint8Array(file.contentBase64 as string),
    })),
  });

  const thumbnail = body.thumbnail;
  if (thumbnail) {
    if (
      typeof thumbnail.contentBase64 !== "string" ||
      typeof thumbnail.contentType !== "string" ||
      !ALLOWED_THUMBNAIL_TYPES.has(thumbnail.contentType)
    ) {
      return new Response("Invalid thumbnail entry", { status: 400 });
    }

    await uploadGameThumbnail(
      context.cloudflare.env,
      game.id,
      base64ToUint8Array(thumbnail.contentBase64),
      thumbnail.contentType,
    );
    await setGameThumbnail(
      context.cloudflare.env,
      game.id,
      thumbnail.contentType,
    );
  }

  return Response.json({
    ok: true,
    id: game.id,
    uploadedFiles: files.length,
  });
}
