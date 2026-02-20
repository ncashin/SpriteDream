import { ObjectDisplay } from "./ObjectDisplay";
import testData from "./test.json";

export const Sidebar = () => {
  return (
    <div className="min-w-96 w-96 max-w-96 h-full pt-6 px-2 gap-6 flex flex-col bg-dark-bg border border-dark-ui">
      <h1 className="font-bold text-xl p-internal-sidebar">GameIDE</h1>
      <div className="overflow-x-auto">
        <ObjectDisplay scene={testData} />
      </div>
    </div>
  );
};
