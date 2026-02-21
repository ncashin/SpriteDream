import { cn } from "../utils/cn";
import { ObjectDisplay } from "./ObjectDisplay";
import { Searchbar } from "./Searchbar";
import testData from "./test.json";

export const Sidebar = () => {
  return (
    <div className="min-w-96 w-96 max-w-96 h-full pt-6   flex flex-col bg-dark-bg border border-dark-ui">
      <div className="pl-1.5 pb-4">
        <h1 className="font-bold text-xl p-internal-sidebar">GameIDE</h1>
      </div>

      
      <div className="pl-1.5 pb-2">
        <h1 className="font-bold text-lg p-internal-sidebar">Scene View</h1>
      </div>

      <div className="px-2 pr-3.5 pb-1.5 text-sm  ">
        <Searchbar />
      </div>

      <div
        className={cn(
          "overflow-x-auto h-full px-2 pb-8 text-sm",
          `
      [&::-webkit-scrollbar]:h-1
      [&::-webkit-scrollbar-track]:bg-dark-ui-2
      [&::-webkit-scrollbar-thumb]:bg-light-ui-3
  `,
        )}
      >
        <ObjectDisplay scene={testData} />
      </div>
    </div>
  );
};
