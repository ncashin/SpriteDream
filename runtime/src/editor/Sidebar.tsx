import { ObjectDisplay } from "./ObjectDisplay";
import testData from "./test.json";

export const Sidebar = () => {
  return (
    <div className="w-96 h-full pt-3 px-3 gap-4 flex flex-col">
      <h1 className="font-bold">Sidebar</h1>
      <ObjectDisplay scene={testData} />
    </div>
  );
};
