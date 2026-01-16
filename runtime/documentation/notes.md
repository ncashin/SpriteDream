# Data

## Scene

A Scene is a large blob of JSON. Only changes made in the editor while the game is not running are persisted. While the game is running no changes are persisted. When the game stops running a snapshot made immediately before the game was run is loaded.

The exception to this is writing to the scene file while the game is running. This apply's a "patch" to the scene as well as the snapshot. This is done to accomodate AI agents making changes to the game while it's running. Could likely also account for multiplayer.

## Save

An active record that writes to disc irregardless of the environment. When making changes to the save object assume changes are persisted.

# Runtime Information

## Start Functions

Start functions occur when initially running the game.

## 3 Major Loops

- EditorUpdate - Runs exclusively in the editor.
- Update - Runs exclusively while the game is running. Pressing run in the editor, exported game.
- Draw - Runs in the editor and while the game is running.
