import { useState } from "react";
import { Search } from "lucide-react";


export const Searchbar = () => {
  const [search, setSearch] = useState("");

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-dark-ui-2 rounded-md p-internal-sidebar pb-2 fon-semibold">
      <Search size={16} strokeWidth={3} />
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search..."
        className="bg-transparent outline-none text-white w-full font-semibold "
      />
    </div>
  );

}