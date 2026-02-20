export const PropertyDisplay = ({ entry: [key, value] }: { entry: [string, unknown] }) => {
    return (
      <button className="flex flex-row items-center w-full group gap-2">
        <h2>{key}:</h2>
        <p className="truncate overflow-ellipsis overflow-hidden">{String(value)}</p>
      </button>
    );
  }; 