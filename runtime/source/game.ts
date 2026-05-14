import {
  defineTrait,
  gameStart,
  getScene,
  implementsTrait,
  ownerTrait,
  spriteTrait,
  collisionBodyTrait,
  gameUpdate,
  type PlanckCollisionHandler,
} from "gameide";
import playerScene from "./scenes/player.scene";
import "./style.css";
import bouncyBallScene from "./scenes/bouncyBall.scene";
import type { RuntimeGameContext } from "./index";

const playerTrait = defineTrait({
  moveSpeed: 260,
  jumpSpeed: 650,
  playerGravityY: -1500,
  grounded: false,
});

export default function main(gameContext: RuntimeGameContext): void {
  const { input, networking, planck } = gameContext;

  gameStart(() => {
    const scene = getScene();

    const peerPlayer = scene.createObject(
      networking.peerId,
      networking.withOwnership(playerScene),
    );

    let floorSupportOverlaps = 0;
    const onPeerCollision: PlanckCollisionHandler = (_other, collisionInfo) => {
      if (!collisionInfo.normal || collisionInfo.normal.y < 0.5) return;
      if (collisionInfo.phase === "enter") floorSupportOverlaps++;
      else floorSupportOverlaps = Math.max(0, floorSupportOverlaps - 1);
      peerPlayer.grounded = floorSupportOverlaps > 0;
    };
    planck.onCollision(peerPlayer, onPeerCollision);

    scene.createObject("bouncyBall", networking.withOwnership(bouncyBallScene));
  });

  gameUpdate((deltaTime) => {
    const scene = getScene();

    const sharedGravity = playerTrait.playerGravityY * deltaTime;

    const player = scene.getObject(
      networking.peerId,
      implementsTrait([playerTrait, spriteTrait, collisionBodyTrait]),
    );

    if (player) {
      const gravityStep = player.playerGravityY * deltaTime;
      if (input.buttons.Jump.pressed && player.grounded) {
        player.collisionBody.velocity.y = player.jumpSpeed;
      }
      player.collisionBody.velocity.x =
        input.axes.Horizontal * player.moveSpeed;
      player.collisionBody.velocity.y += gravityStep;
    }

    const ball = scene.getObject(
      "bouncyBall",
      implementsTrait([spriteTrait, collisionBodyTrait, ownerTrait]),
    );

    if (ball && networking.isOwned(ball)) {
      ball.collisionBody.velocity.y += sharedGravity;
    }
  });
}
