import {
  defineTrait,
  gameStart,
  getScene,
  implementsTrait,
  ownerTrait,
  spriteTrait,
  collisionBodyTrait,
  boxColliderTrait,
  circleColliderTrait,
  gameUpdate,
} from "gameide";
import playerScene from "./scenes/player.scene";
import "./style.css";
import bouncyBallScene from "./scenes/bouncyBall.scene";
import { gameContext } from "./index";

const playerTrait = defineTrait({
  moveSpeed: 260,
  jumpSpeed: 650,
  playerGravityY: -1500,
  grounded: false,
});

gameStart(() => {
  const { networking, planck } = gameContext;
  const scene = getScene();

  const ownedPlayer = networking.withOwnership(playerScene);
  const peerPlayer = scene.createObject(networking.peerId, ownedPlayer);

  let floorSupportOverlaps = 0;
  peerPlayer.onCollision((other, collisionInfo) => {
    if (!planck.isStatic(other)) return;
    if (!collisionInfo.normal || collisionInfo.normal.y < 0.5) return;
    if (collisionInfo.phase === "enter") floorSupportOverlaps++;
    else floorSupportOverlaps = Math.max(0, floorSupportOverlaps - 1);
    peerPlayer.grounded = floorSupportOverlaps > 0;
  });

  scene.createObject("bouncyBall", networking.withOwnership(bouncyBallScene));
});

gameUpdate((deltaTime) => {
  const { input, networking } = gameContext;
  const scene = getScene();
  const horizontalAxis = input.axes.Horizontal;
  const sharedGravity = playerTrait.playerGravityY * deltaTime;

  const player = scene.getObject(
    networking.peerId,
    implementsTrait([
      playerTrait,
      spriteTrait,
      collisionBodyTrait,
      boxColliderTrait,
    ]),
  );

  if (player) {
    const gravityStep = player.playerGravityY * deltaTime;
    if (input.buttons.Jump.pressed && player.grounded) {
      player.collisionBody.velocity.y = player.jumpSpeed;
    }
    player.collisionBody.velocity.x = horizontalAxis * player.moveSpeed;
    player.collisionBody.velocity.y += gravityStep;
  }

  const ball = scene.getObject(
    "bouncyBall",
    implementsTrait([
      spriteTrait,
      collisionBodyTrait,
      circleColliderTrait,
      ownerTrait,
    ]),
  );

  if (ball && networking.isOwned(ball)) {
    ball.collisionBody.velocity.y += sharedGravity;
  }
});
