import { Game } from "./Game";
import { Sidebar } from "./Sidebar";

export const Editor = () => {
  return (
    <div className="flex flex-row h-full w-max">
      <Sidebar />
      <Game />
    </div>
  );
};
