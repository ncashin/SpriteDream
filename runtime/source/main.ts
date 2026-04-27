import {
  implementsTrait,
  defineTrait,
  getScene,
  OWNER_ID,
  gameStart,
  gameUpdate,
  $string,
  spriteTrait,
  transformTrait,
} from "gameide";
import type { MainContext } from "./gameConfig";
import { loadAssets } from "virtual:gameide-assets";

const playerTrait = defineTrait([
  spriteTrait,
  {
    [OWNER_ID]: $string,
    speed: 1,
  },
]);

const PLAYER_SPRITE_TINT = "#ffffff";

export function main({ input, networking }: MainContext): void {
  const scene = getScene();

  gameStart(() => {
    scene.createObject(
      networking.peerId,
      networking.withOwnership({
        ...transformTrait,
        sprite: {
          asset: loadAssets()["assets/typescript.svg"],
          width: 32,
          height: 32,
          tint: PLAYER_SPRITE_TINT,
        },
        speed: 1,
      }),
    );
  });

  gameUpdate((deltaTime: number) => {
    const horizontal = input.axes.Horizontal;
    const vertical = input.axes.Vertical;

    for (const player of scene.query(implementsTrait(playerTrait))) {
      if (!networking.isOwned(player)) continue;

      player.position.x += horizontal * player.speed * deltaTime;
      player.position.y += vertical * player.speed * deltaTime;
    }
  });
}
