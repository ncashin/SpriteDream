import { useState } from "react";
import { Search } from "lucide-react";

export const Searchbar = () => {
  const [search, setSearch] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1.5 hover:bg-dark-ui-2 cursor-pointer rounded-md p-internal-sidebar pb-2 fon-semibold ${
        isFocused ? "bg-dark-ui-2" : ""
      }`}
    >
      <Search size={16} strokeWidth={3} />
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search..."
        className="bg-transparent outline-none text-light-ui w-full font-semibold"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
    </div>
  );
}

