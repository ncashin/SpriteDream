import { ObjectDisplay } from "./ObjectDisplay";
import testData from "./test.json";

export const Sidebar = () => {
  return (
    <div className="max-w-96 min-w-96 h-full pt-6 px-3 gap-6 flex flex-col bg-dark-bg border-dark-ui border-1 ">
      <h1 className="font-bold text-xl p-internal-sidebar">GameIDE</h1>
      <ObjectDisplay scene={testData} />
    </div>
  );
};
