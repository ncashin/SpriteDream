import { z } from "zod";
import {
  defineTrait,
  onGameStart,
  ownerTrait,
  onGameUpdate,
  implementsTrait,
} from "gameide";
import playerScene from "./scenes/player.scene";
import "./style.css";
import bouncyBallScene from "./scenes/bouncyBall.scene";
import type { RuntimeGameContext } from "./index";
import { collisionBodyTrait } from "./gameide/gameModules/planckGameModule/index";
import { spriteTrait } from "./gameide/gameModules/pixiGameModule/index";
import { transformTrait } from "./gameide/gameModules/transform.js";

const BALL_GRAVITY_Y = -1500;

const playerTrait = defineTrait(
  z.object({
    moveSpeed: z.number().default(260),
    jumpSpeed: z.number().default(650),
    gravity: z.number().default(-1500),
    grounded: z.boolean().default(false),
  }),
);

const playerTraits = implementsTrait([
  playerTrait,
  transformTrait,
  spriteTrait,
  collisionBodyTrait,
]);

const ballTraits = implementsTrait([
  transformTrait,
  spriteTrait,
  collisionBodyTrait,
  ownerTrait,
]);

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

  onGameUpdate((deltaTime) => {
    const player = scene.getObject(networking.peerId, playerTraits);

    if (player) {
      if (input.buttons.Jump.pressed && player.grounded) {
        player.collisionBody.velocity.y = player.jumpSpeed;
      }
      player.collisionBody.velocity.x =
        input.axes.Horizontal * player.moveSpeed;
      player.collisionBody.velocity.y += player.gravity * deltaTime;
    }

    const ball = scene.getObject("bouncyBall", ballTraits);

    if (ball && networking.isOwned(ball)) {
      ball.collisionBody.velocity.y += BALL_GRAVITY_Y * deltaTime;
    }
  });
}
