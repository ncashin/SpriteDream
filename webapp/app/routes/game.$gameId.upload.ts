import { getGameById } from "~/.server/database/game";
import { uploadGameFrontendBundle } from "~/.server/storage/gameFrontendBundle";

type UploadBundleRequest = {
  files?: Array<{
    path?: string;
    contentBase64?: string;
  }>;
};

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
  params: { gameId?: string };
  request: Request;
  context: { cloudflare: { env: Env } };
}) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const gameId = params.gameId;
  if (!gameId) {
    return new Response("Game not found", { status: 404 });
  }

  const game = await getGameById(context.cloudflare.env, gameId);
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

  await uploadGameFrontendBundle(context.cloudflare.env, gameId, {
    files: files.map((file) => ({
      path: file.path as string,
      content: base64ToUint8Array(file.contentBase64 as string),
    })),
  });

  return Response.json({
    ok: true,
    gameId,
    uploadedFiles: files.length,
  });
}
