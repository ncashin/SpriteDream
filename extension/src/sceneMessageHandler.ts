export interface SceneData {
  [key: string]: unknown;
}

export interface SceneWebviewMessage {
  type: string;
  content?: string;
  patch?: SceneData;
}

export interface SceneEditEvent<Doc> {
  document: Doc;
  label: string;
  undo: () => void;
  redo: () => void;
}

export interface SceneMessageHandlerContext<Doc> {
  document: Doc;
  fireEdit: (event: SceneEditEvent<Doc>) => void;
  applyScenePatch: (scene: SceneData, patch: SceneData) => void;
  notifyWebviews?: () => void;
}

export interface SceneDocumentLike {
  getData(): SceneData;
  setData(data: SceneData): void;
}

export function createSceneMessageHandler<Doc extends SceneDocumentLike>(
  context: SceneMessageHandlerContext<Doc>
): (message: SceneWebviewMessage) => void {
  const { document, fireEdit, applyScenePatch } = context;
  const notifyWebviews = context.notifyWebviews ?? (() => {});

  return (message: SceneWebviewMessage) => {
    switch (message.type) {
      case "edit": {
        if (message.content === undefined) break;
        try {
          const updatedSceneData = JSON.parse(message.content) as SceneData;
          const previousSceneData = document.getData();
          fireEdit({
            document,
            label: "Edit",
            undo: () => {
              document.setData(previousSceneData);
              notifyWebviews();
            },
            redo: () => {
              document.setData(updatedSceneData);
              notifyWebviews();
            },
          });
          document.setData(updatedSceneData);
        } catch {
          break;
        }
        break;
      }
      case "scenePatch": {
        if (
          message.patch === undefined ||
          typeof message.patch !== "object" ||
          Array.isArray(message.patch)
        ) {
          break;
        }
        const previousSceneData = document.getData();
        const updatedSceneData = JSON.parse(
          JSON.stringify(previousSceneData)
        ) as SceneData;
        applyScenePatch(updatedSceneData, message.patch);
        fireEdit({
          document,
          label: "Edit",
          undo: () => {
            document.setData(previousSceneData);
            notifyWebviews();
          },
          redo: () => {
            document.setData(updatedSceneData);
            notifyWebviews();
          },
        });
        document.setData(updatedSceneData);
        break;
      }
      case "sceneChanged": {
        if (message.content === undefined) break;
        try {
          const parsedSceneData = JSON.parse(message.content) as SceneData;
          document.setData(parsedSceneData);
        } catch {
          break;
        }
        break;
      }
    }
  };
}
