import { PlusIcon } from "lucide-react";
import { useState } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  ListBox,
  ListBoxItem,
  Popover,
} from "react-aria-components";
import { addComponent, useComponents } from "../component";
import type { SerializableObject } from "../scene";

export default function AddComponent({ object }: { object: SerializableObject }) {
  const components = useComponents();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        aria-label="Add Component"
        className="flex flex-row w-full py-1 pl-1.5 hover:bg-hover items-center"
      >
        <PlusIcon className="size-4" />
        Add to Object...
      </Button>

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
