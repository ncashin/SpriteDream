import { getGameById } from "~/.server/database/game";
import { uploadGameFrontendBundle } from "~/.server/storage/gameFrontendBundle";

type UploadBundleRequest = {
  files?: Array<{
    path?: string;
    contentBase64?: string;
  }>;
};

export async function action({
  params,
  request,
}: {
  params: { gameId?: string };
  request: Request;
}) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const gameId = params.gameId;
  if (!gameId) {
    return new Response("Game not found", { status: 404 });
  }

  const game = await getGameById(gameId);
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

  await uploadGameFrontendBundle(gameId, {
    files: files.map((file) => ({
      path: file.path as string,
      content: Buffer.from(file.contentBase64 as string, "base64"),
    })),
  });

  return Response.json({
    ok: true,
    gameId,
    uploadedFiles: files.length,
  });
}
