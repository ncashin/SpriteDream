export const SceneSelect = ({
  deferredFilepath,
  sceneFiles,
  setSceneFilepath,
}: {
  deferredFilepath: string;
  sceneFiles: string[];
  setSceneFilepath: (filepath: string) => void;
}) => {
  return (
    <select
      className="p-0 m-0 box-border appearance-none font-semibold"
      id="scene-file-select"
      value={deferredFilepath}
      onChange={(event) => {
        setSceneFilepath(event.target.value);
      }}
      required
    >
      <option value="" disabled>
        Select a Scene
      </option>
      {sceneFiles.map((sceneFile) => (
        <option key={sceneFile} value={sceneFile}>
          {sceneFile}
        </option>
      ))}
    </select>
  );
};
