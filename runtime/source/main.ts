import {
  type BaseSceneObject,
  type PlanckCallbackEvent,
  type TraitTupleToIntersection,
  defineTrait,
  editorPlugin,
  gameStart,
  gameUpdate,
  gameide,
  gameUIPlugin,
  getScene,
  implementsTrait,
  inputPlugin,
  logLifecycleRegistries,
  networkingPlugin,
  ownerTrait,
  pixiPlugin,
  planckPlugin,
  spriteTrait,
  collisionBodyTrait,
  boxColliderTrait,
  circleColliderTrait,
} from "gameide";
import { WorldManifold } from "planck";
import invariant from "tiny-invariant";
import exampleScene from "./scenes/example.scene";
import bouncyBallScene from "./scenes/bouncyBall.scene";
import playerScene from "./scenes/player.scene";
import typescriptSvgUrl from "../assets/typescript.svg?url";
import "./style.css";
import { Editor } from "./Editor";
import { GameUI } from "./GameUI";

const rootElement = document.getElementById("app");
invariant(rootElement);

const { gameContext } = await gameide({
  rootElement,
  initialContext: {},
  initialScene: exampleScene,
  plugins: [
    editorPlugin(Editor),
    gameUIPlugin(GameUI),
    networkingPlugin({
      room: "default",
    }),
    inputPlugin({
      axes: {
        Horizontal: {
          negative: ["KeyA", "KeyArrowLeft"],
          positive: ["KeyD", "KeyArrowRight"],
        },
      },
      buttons: {
        Jump: ["KeyW", "KeySpace", "KeyArrowUp"],
        Interact: ["KeyE"],
        Throw: ["Mouse0"],
        EditorMoveUp: ["KeySpace"],
        EditorMoveDown: ["KeyShiftLeft", "KeyShiftRight"],
        LookCamera: ["Mouse0"],
      },
    }),
    planckPlugin(),
    pixiPlugin({
      initOptions: {
        backgroundAlpha: 0,
      },
      debugDrawColliders: true,
      assets: {
        "assets/typescript.svg": typescriptSvgUrl,
      },
    }),
  ],
});

const playerTrait = defineTrait({
  moveSpeed: 260,
  jumpSpeed: 650,
  playerGravityY: -1500,
  grounded: false,
});

const bouncyBallTrait = defineTrait({
  pickupRadiusSq: 96 * 96,
  ballHoldOffsetY: 34,
  throwSpeed: 560,
  throwPlayerBlend: 0.22,
});

type BouncyBallObject = TraitTupleToIntersection<
  readonly [
    typeof bouncyBallTrait,
    typeof spriteTrait,
    typeof collisionBodyTrait,
    typeof circleColliderTrait,
    typeof ownerTrait,
  ]
>;

let carriedBall: BouncyBallObject | null = null;

gameStart(() => {
  console.log("HIT")
  const { networking, planck } = gameContext;
  const scene = getScene();

  const peerPlayer = scene.createObject(
    networking.peerId,
    networking.withOwnership(playerScene),
  );
  if (
    implementsTrait([
      playerTrait,
      spriteTrait,
      collisionBodyTrait,
      boxColliderTrait,
    ])(peerPlayer)
  ) {
    let floorSupportContacts = 0;
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
        floorSupportContacts += event.phase === "enter" ? 1 : -1;
        floorSupportContacts = Math.max(0, floorSupportContacts);
        peerPlayer.grounded = floorSupportContacts > 0;
      },
    );
  }

  scene.createObject(
    "bouncyBall",
    networking.withOwnership(bouncyBallScene),
  );
});

gameUpdate((deltaTime) => {
  const { input, networking, pixi } = gameContext;
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
  const ball = scene.getObject(
    "bouncyBall",
    implementsTrait([
      bouncyBallTrait,
      spriteTrait,
      collisionBodyTrait,
      circleColliderTrait,
      ownerTrait,
    ]),
  );
  const heldBall = carriedBall === ball ? ball : null;

  if (heldBall && player) {
    heldBall.position.x = player.position.x;
    heldBall.position.y = player.position.y + heldBall.ballHoldOffsetY;

    if (input.buttons.Throw.pressed) {
      let throwDirectionX = 1;
      let throwDirectionY = 0;
      const mousePosition = input.mouse.position;
      if (mousePosition) {
        const { x: targetWorldX, y: targetWorldY } = pixi.viewport.screenToWorld(
          mousePosition.x,
          mousePosition.y,
        );
        const aimDeltaX = targetWorldX - heldBall.position.x;
        const aimDeltaY = targetWorldY - heldBall.position.y;
        const aimDistance = Math.hypot(aimDeltaX, aimDeltaY);
        if (aimDistance > 1e-3) {
          throwDirectionX = aimDeltaX / aimDistance;
          throwDirectionY = aimDeltaY / aimDistance;
        }
      }
      const playerVelocityX = player.collisionBody.velocity.x;
      const playerVelocityY = player.collisionBody.velocity.y;
      carriedBall = null;
      heldBall.collisionBody.disabled = false;
      heldBall.collisionBody.velocity = {
        x:
          throwDirectionX * heldBall.throwSpeed +
          playerVelocityX * heldBall.throwPlayerBlend,
        y:
          throwDirectionY * heldBall.throwSpeed +
          playerVelocityY * heldBall.throwPlayerBlend,
        angular: 0,
      };
    }
  }

  if (
    ball &&
    player &&
    input.buttons.Interact.pressed &&
    carriedBall !== ball
  ) {
    const pickupDeltaX = ball.position.x - player.position.x;
    const pickupDeltaY = ball.position.y - player.position.y;
    if (
      pickupDeltaX * pickupDeltaX + pickupDeltaY * pickupDeltaY <= ball.pickupRadiusSq
    ) {
      carriedBall = ball;
      ball.collisionBody.disabled = true;
      ball.collisionBody.velocity = { x: 0, y: 0, angular: 0 };
    }
  }

  if (player) {
    const gravityStep = player.playerGravityY * clampedDeltaTime;
    if (input.buttons.Jump.pressed && player.grounded) {
      player.collisionBody.velocity.y = player.jumpSpeed;
    }
    player.collisionBody.velocity.x = horizontalAxis * player.moveSpeed;
    player.collisionBody.velocity.y += gravityStep;
  }

  for (const bouncyBall of scene.query(
    implementsTrait([
      bouncyBallTrait,
      spriteTrait,
      collisionBodyTrait,
      circleColliderTrait,
      ownerTrait,
]),
  )) {
    if (!networking.isOwned(bouncyBall) || carriedBall === bouncyBall) continue;
    bouncyBall.collisionBody.velocity.y += sharedGravity;
  }
});

logLifecycleRegistries("main.ts: lifecycle registries after registration");
