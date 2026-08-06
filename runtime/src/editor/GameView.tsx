import { useContext } from "react";
import { EditorStoreContext } from "./EditorStoreProvider";
import useMode from "./hooks/useMode";

export default function GameView() {
  const editorStore = useContext(EditorStoreContext);
  const { mode } = useMode();

  const iframeRef = (iframe: HTMLIFrameElement | null) => {
    if (!iframe?.contentWindow) return;
    editorStore.transport.setTargetWindow(iframe.contentWindow);
  };

  return <iframe key={mode} ref={iframeRef} src="/game" className="w-full h-full" />;
}
