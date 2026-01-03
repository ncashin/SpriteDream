# Notes 

## State

Scene encapsulates this state as well as which script files are running

Two main sources of state:
- GameState -> huge json object
- ECS -> data oriented ecs still just a bunch of json

Both editable in a collapsible sidebar

these are persisted in editor state

## Runtime

3 main loops:
- editor -> for handling editor events runs in editor not in game state ecs / state changes are persisted from this point
- game -> runs only when game running
- draw -> runs always draws the game should be fully stateless and run based on data provided to present it the the end user

start stop buttons for various loops switching between editor and game state

## Project Structure for end user.

bunch of javascript / typescript files that all get run depending on a scene

# TODO:

- Add names to ECS entities
