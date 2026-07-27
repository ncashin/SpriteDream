import {
  Button,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";

export const SceneSelect = ({
  deferredFilepath,
  sceneFiles,
  setSceneFilepath,
  confirmFileChange,
}: {
  deferredFilepath: string;
  sceneFiles: string[];
  setSceneFilepath: (filepath: string) => void;
  confirmFileChange: () => void;
}) => {
  return (
    <Select
      selectedKey={deferredFilepath || null}
      onSelectionChange={(key) => {
        confirmFileChange();
        setSceneFilepath(String(key));
      }}
    >
      <Label className="sr-only">Scene File</Label>

      <Button className="p-0 m-0 box-border appearance-none font-semibold">
        <SelectValue />
      </Button>

      <Popover>
        <ListBox>
          {sceneFiles.map((sceneFile) => (
            <ListBoxItem key={sceneFile} id={sceneFile}>
              {sceneFile}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
};
