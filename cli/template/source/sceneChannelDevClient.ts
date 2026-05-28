import { receiveDevSceneChannelMessage } from "gameide";

if (import.meta.hot) {
  import.meta.hot.on("gameide:scene-channel", (message: unknown) => {
    receiveDevSceneChannelMessage(message);
  });
}
