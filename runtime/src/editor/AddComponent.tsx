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

import { addComponent, useComponents } from "../components";
import type { SerializableObject } from "../scene";

export default function AddComponent({ object }: { object: SerializableObject }) {
  const components = useComponents();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={() => setIsOpen((open) => !open)}>
      <Button className="w-full row items-center">
        <PlusIcon className="icon-size" />
        Add Component
      </Button>

      <Popover placement="bottom" className="-mt-1.5 w-(--trigger-width)">
        <Dialog className="overlay w-full text-white text-sm bg-background border border-border">
          <ListBox
            aria-label="Add components"
            selectionMode="single"
            onSelectionChange={(keys) => {
              if (keys === "all") return;

              const key = [...keys][0];
              if (!key) return;

              const component = components.find((component) => component.name === key);

              if (!component) return;

              addComponent(object, component);
              setIsOpen(false);
            }}
          >
            {components.map((component) => (
              <ListBoxItem
                key={component.name}
                id={component.name}
                className="row hover:bg-hover cursor-pointer"
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
