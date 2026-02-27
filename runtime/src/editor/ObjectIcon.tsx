import { Box } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { IconButton } from "./IconButton";
import { Dropdown } from "./Dropdown";
import { Searchbar } from "./Searchbar";

import { icons } from "lucide-react";

const resolveIcon = (name: unknown): typeof Box => {
  if (typeof name !== "string") return Box;
  if (name in icons) return (icons as Record<string, typeof Box>)[name];
  const lower = name.toLowerCase();
  const key = Object.keys(icons).find((k) => k.toLowerCase() === lower);
  return key ? (icons as Record<string, typeof Box>)[key] : Box;
};

export const ObjectIcon = ({
  path: _path,
  iconName,
}: {
  path: string;
  iconName?: unknown;
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const IconComponent = resolveIcon(iconName);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [dropdownOpen]);
  return (
    <div className="relative flex items-center gap-1.5" ref={dropdownRef}>
      <IconButton icon={IconComponent} onClick={() => setDropdownOpen((open) => !open)} />
      {dropdownOpen && (
        <Dropdown className="top-[160%] -left-1 p-1.5 max-h-48">
          <label className="flex flex-row pr-w-full justify-between text-sm items-center sidebar-hover rounded-md px-2 py-1     group cursor-pointer gap-2">
            <span>Display in Game?</span>
            <input
              type="checkbox"
              className="form-checkbox accent-dark-ui pr-3"
            />
          </label>
          <Searchbar className="sidebar-hover" />
        
        <div className="flex flex-row flex-wrap gap-2 px-2 py-1 overflow-y-auto max-h-32 font-normal">
          {Object.entries(icons).map(([name, Icon]) => (
            <span key={name}>
              <Icon size={20} strokeWidth={1.5} />
            </span>
          ))}
        </div>
        
        </Dropdown>
      )}
    </div>
  );
};
