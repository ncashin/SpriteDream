import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  ListBox,
  ListBoxItem,
  Popover,
} from "react-aria-components";
import { addComponent, useComponents } from "../components";
import type { SerializableObject } from "../scene";

export default function AddComponent({ object }: { object: SerializableObject }) {
  const components = useComponents();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <div className="flex flex-row">
        <Button className="row items-center flex-1 bg-foreground justify-center">
          <PlusIcon className="icon-size" />
          Add Component
        </Button>
        <Button className="border-border border-l flex-1 row h-full items-center justify-center bg-foreground">
          <MinusIcon className="icon-size" />
          Remove Component
        </Button>
      </div>

      <Popover style={{ width: "var(--trigger-width)" }}>
        <Dialog className="bg-yellow-50 w-full">
          <ListBox
            aria-label="Components"
            selectionMode="single"
            onSelectionChange={(keys) => {
              if (keys === "all") return;

              const currentKey = [...keys][0];
              if (!currentKey) return;

              const component = components.find((component) => component.name === currentKey);
              if (!component) return;

              addComponent(object, component);
              setIsOpen(false);
            }}
          >
            {components.map((component) => (
              <ListBoxItem
                key={component.name}
                id={component.name}
                className="px-2 py-1 rounded hover:bg-hover cursor-pointer"
              >
                {component.name}
              </ListBoxItem>
            ))}
          </ListBox>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
