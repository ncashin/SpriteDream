import { useState } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Input,
  ListBox,
  ListBoxItem,
  Popover,
  TextField,
} from "react-aria-components";

import { PlusIcon, SearchIcon } from "lucide-react";
import { addComponent, useComponents } from "../components";
import type { SerializableObject } from "../scene";

export default function AddComponent({ object }: { object: SerializableObject }) {
  const components = useComponents();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredComponents = components.filter((component) =>
    component.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setSearch("");
      }}
    >
      <Button className="w-full row items-center">
        <PlusIcon className="icon-size" />
        Add Component
      </Button>

      <Popover placement="bottom" className="-mt-1 w-(--trigger-width)">
        <Dialog className="overlay w-full text-white text-sm bg-background border border-border">
          <TextField autoFocus value={search} onChange={setSearch} className="row">
            <SearchIcon className="icon-size" />
            <Input aria-label="Search Components" placeholder="Search Components..." />
          </TextField>

          <ListBox
            aria-label="Add Component"
            selectionMode="single"
            onSelectionChange={(keys) => {
              const name = [...keys][0];
              if (!name) return;

              const component = components.find((component) => component.name === name);

              if (!component) return;

              addComponent(object, component);
              setIsOpen(false);
            }}
          >
            {filteredComponents.map((component) => (
              <ListBoxItem
                key={component.name}
                id={component.name}
                textValue={component.name}
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
