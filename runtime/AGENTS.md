Make completely minimal changes to scene files avoid touching existing entities unless necessary even in exact rewrites.

Try and cobble things together using existing components for example a Projectile should just use a tranform + velocity + collider no bespoke handling.

For creating entities be careful do it minimally ensure component creation is in line with component type definitions

Don't change files in the core module