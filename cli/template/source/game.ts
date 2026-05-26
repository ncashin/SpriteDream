import { z } from "zod";
import {
  defineTrait,
  onGameStart,
  onGameUpdate,
  implementsTrait,
} from "gameide";
import playerScene from "./scenes/player.scene";
import "./style.css";
import bouncyBallScene from "./scenes/bouncyBall.scene";
import type { RuntimeGameContext } from "./index";
import { collisionBodyTrait } from "./plugins/planckPlugin/index";
import { spriteTrait } from "./plugins/pixiPlugin/index";

const playerTrait = defineTrait(
  z.object({
    moveSpeed: z.number().default(260),
    jumpSpeed: z.number().default(650),
    playerGravityY: z.number().default(-1500),
    grounded: z.boolean().default(false),
  }),
);

export default function main(gameContext: RuntimeGameContext): void {
  const { input, networking, planck, scene } = gameContext;

  onGameStart(() => {
    const peerPlayer = scene.createObject(
      networking.peerId,
      networking.withOwnership(playerScene),
    );

    let floorSupportOverlaps = 0;
    planck.onCollision(peerPlayer, (_other, collisionInfo) => {
      if (!collisionInfo.normal || collisionInfo.normal.y < 0.5) return;
      if (collisionInfo.phase === "enter") floorSupportOverlaps++;
      else floorSupportOverlaps = Math.max(0, floorSupportOverlaps - 1);
      peerPlayer.grounded = floorSupportOverlaps > 0;
    });

    scene.createObject("bouncyBall", networking.withOwnership(bouncyBallScene));
  });

  onGameUpdate(() => {
    const player = scene.getObject(
      networking.peerId,
      implementsTrait([playerTrait, spriteTrait, collisionBodyTrait]),
    );

    if (player) {
      if (input.buttons.Jump.pressed && player.grounded) {
        player.collisionBody.velocity.y = player.jumpSpeed;
      }
      player.collisionBody.velocity.x =
        input.axes.Horizontal * player.moveSpeed;
    }
  });
}
