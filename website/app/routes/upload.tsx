import type { Route } from "./+types/upload";
import { redirect } from "react-router";
import { db, games } from "../db";

export async function action({ request }: Route.ActionArgs) {
  try {
    const formData = await request.formData();
    
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const author = formData.get("author") as string;
    const thumbnailFile = formData.get("thumbnail") as File | null;
    const gameBundleFile = formData.get("gameBundle") as File;

    if (!name || !gameBundleFile || gameBundleFile.size === 0) {
      return new Response(
        JSON.stringify({ error: "Name and game bundle are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let thumbnail: Buffer | null = null;
    let thumbnailMimeType: string | null = null;

    if (thumbnailFile && thumbnailFile.size > 0) {
      try {
        const arrayBuffer = await thumbnailFile.arrayBuffer();
        thumbnail = Buffer.from(arrayBuffer);
        thumbnailMimeType = thumbnailFile.type;
      } catch (error) {
        console.error("Error processing thumbnail:", error);
        return new Response(
          JSON.stringify({ error: "Failed to process thumbnail file" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    let gameBundle: Buffer;
    try {
      const gameBundleArrayBuffer = await gameBundleFile.arrayBuffer();
      gameBundle = Buffer.from(gameBundleArrayBuffer);
    } catch (error) {
      console.error("Error processing game bundle:", error);
      return new Response(
        JSON.stringify({ error: "Failed to process game bundle file" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const [game] = await db
        .insert(games)
        .values({
          name,
          description: description || null,
          author: author || null,
          thumbnail,
          thumbnailMimeType,
          gameBundle,
        })
        .returning();

      if (!game) {
        return new Response(
          JSON.stringify({ error: "Failed to create game record" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      return redirect(`/games/${game.id}`);
    } catch (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: `Failed to save game: ${error instanceof Error ? error.message : "Unknown error"}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Upload action error:", error);
    return new Response(
      JSON.stringify({ error: `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

