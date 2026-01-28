Make completely minimal changes to scene files avoid touching existing entities unless necessary even in exact rewrites.

Try and cobble things together using existing components for example a Projectile should just use a tranform + velocity + collider no bespoke handling.

For creating entities be careful do it minimally ensure component creation is in line with component type definitions

Don't change files in the core module

correct fireball shooting code looks like: 

"""
// Handle fireball shooting on mouse click
    const mouseLeftPressed = input.isMouseButtonPressed("left");
    const mouseClicked = mouseLeftPressed && !previousMouseLeft;
    previousMouseLeft = mouseLeftPressed;

    if (mouseClicked) {
      const mousePos = input.getMousePosition();
      const worldPos = screenToWorld(mousePos.x, mousePos.y);
      const playerWorldPos = getWorldPosition(ecs.ecsInstance, playerEntityId);

      if (playerWorldPos) {
        const dx = worldPos.x - playerWorldPos.x;
        const dy = worldPos.y - playerWorldPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
          const fireballSpeed = 500;
          const velocityX = (dx / distance) * fireballSpeed;
          const velocityY = (dy / distance) * fireballSpeed;

          const fireballId = `fireball_${fireballCounter++}`;


          ecs.composeEntity(fireballId, [
            { ...TransformComponentDefinition, x: playerWorldPos.x, y: playerWorldPos.y },
            { ...SpriteComponentDefinition, width: 24, height: 24, image: "/fireball.png" },
            { ...VelocityComponentDefinition, x: velocityX, y: velocityY },
            { ...ColliderComponentDefinition, bodyType: "kinematic", width: 24, height: 24, collisionEnabled: true }
          ]);
        }
      }
    }
"""