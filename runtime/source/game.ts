import {
  type BaseSceneObject,
  type PlanckCallbackEvent,
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
import { type Contact, WorldManifold } from "planck";
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

  const peerPlayer = scene.createObject(
    networking.peerId,
    networking.withOwnership(playerScene),
  );

  const floorSupportContacts = new Set<Contact>();
  const floorContactWorldManifold = new WorldManifold();
  void planck.onCollision(
    peerPlayer,
    (other: BaseSceneObject, event: PlanckCallbackEvent) => {
      if (!planck.isStatic(other)) return;
      const worldManifold = event.contact.getWorldManifold(
        floorContactWorldManifold,
      );
      if (!worldManifold) return;
      const normalY = worldManifold.normal.y;
      const selfIsFixtureA = event.selfFixture === event.contact.getFixtureA();
      if ((selfIsFixtureA ? -normalY : normalY) < 0.5) return;
      if (event.phase === "enter") {
        const velocityY =
          planck.getRigidbody(peerPlayer)?.getLinearVelocity().y ?? 0;
        if (velocityY > 0) return;
        floorSupportContacts.add(event.contact);
      } else {
        floorSupportContacts.delete(event.contact);
      }
      peerPlayer.grounded = floorSupportContacts.size > 0;
    },
  );

  scene.createObject("bouncyBall", networking.withOwnership(bouncyBallScene));
});

gameUpdate((deltaTime) => {
  const { input, networking } = gameContext;
  const scene = getScene();
  const horizontalAxis = input.axes.Horizontal;
  const clampedDeltaTime = Math.min(deltaTime, 0.1);
  const sharedGravity = playerTrait.playerGravityY * clampedDeltaTime;

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
    const gravityStep = player.playerGravityY * clampedDeltaTime;
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
