import { z } from "zod";
import { defineTrait, ownerTrait, implementsTrait } from "gameide";
import playerScene from "./scenes/player.scene";
import bouncyBallScene from "./scenes/bouncyBall.scene";
import { collisionBodyTrait } from "./gameide/gameModules/planckGameModule/index";
import { spriteTrait } from "./gameide/gameModules/pixiGameModule/index";
import { transformTrait } from "./gameide/gameModules/transform.js";
import type { MainGameContext } from "./gameContext.js";

const BALL_GRAVITY_Y = -1500;

const playerTrait = defineTrait(
  "player",
  z.object({
    moveSpeed: z.number().default(260),
    jumpSpeed: z.number().default(650),
    gravity: z.number().default(-1500),
    grounded: z.boolean().default(false),
  }),
);

export default function main(context: MainGameContext) {
  const { input, networking, onGameStart, onGameUpdate, scene } =
    context;

  onGameStart(() => {
    let peerPlayer = scene.getObject(networking.peerIdentifier);
    if (!peerPlayer) {
      peerPlayer = scene.createObject(
        networking.peerIdentifier,
        networking.withOwnership(playerScene),
      );
    }

    peerPlayer.onCollision((_other, collisionInfo) => {
      peerPlayer.grounded = collisionInfo.contacts.some(
        (contact) => contact.normal && contact.normal.y >= 0.5,
      );
    });

    if (!scene.getObject("bouncyBall")) {
      scene.createObject("bouncyBall", networking.withOwnership(bouncyBallScene));
    }
  });

  onGameUpdate((deltaTime) => {
    const player = scene.getObject(
      networking.peerIdentifier,
      (object) =>
        implementsTrait(object, [
          playerTrait,
          transformTrait,
          spriteTrait,
          collisionBodyTrait,
        ]),
    );

    if (player) {
      if (input.buttons.Jump.pressed && player.grounded) {
        player.collisionBody.velocity.y = player.jumpSpeed;
      }
      player.collisionBody.velocity.x =
        input.axes.Horizontal * player.moveSpeed;
      player.collisionBody.velocity.y += player.gravity * deltaTime;
    }

    const ball = scene.getObject(
      "bouncyBall",
      (object) =>
        implementsTrait(object, [
          transformTrait,
          spriteTrait,
          collisionBodyTrait,
          ownerTrait,
        ]),
    );

    if (ball && networking.isOwned(ball)) {
      ball.collisionBody.velocity.y += BALL_GRAVITY_Y * deltaTime;
    }
  });

  return context;
}
