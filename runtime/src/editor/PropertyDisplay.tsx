
const displayComponents: Record<string, (props: { value: any, onChange?: (val: any) => void }) => React.ReactNode> = {
    string: ({ value, onChange }) => (
        <input
            type="text"
            className="min-w-96 bg-transparent min-w-full cursor-pointer focus:outline-none focus:text-light-ui focus:bg-dark-ui hover:bg-dark-ui p-0.5 px-1 rounded-md flex-1 transition-colors truncate overflow-ellipsis"
            defaultValue={value}
            onChange={e => onChange && onChange(e.target.value)}
        />
    ),
    number: ({ value, onChange }) => (
        <input
            type="number"
            className="bg-transparent focus:outline-none flex-1"
            defaultValue={value}
            onChange={e => onChange && onChange(Number(e.target.value))}
        />
    ),
    boolean: ({ value, onChange }) => (
        <input
            type="checkbox"
            className="accent-dark-ui"
            defaultChecked={!!value}
            onChange={e => onChange && onChange(e.target.checked)}
        />
    ),
    object: ({ value }) => (
        <pre className="flex-1 max-w-full whitespace-pre-wrap break-words">{JSON.stringify(value)}</pre>
    ),
};

export const PropertyDisplay = ({ entry: [key, value] }: { entry: [string, unknown] }) => {
    const type = value === null ? "object" : typeof value;
    const DisplayComponent = displayComponents[type];
    return (
        <div className="flex flex-row items-center w-full group gap-2 p-internal-sidebar font-semibold text-dark-tx-2">
            <h2>{key}:</h2>
            <div className=" flex-1">
                {DisplayComponent
                    ? DisplayComponent({ value })
                    : <p className="truncate overflow-ellipsis">{String(value)}</p>}
            </div>
        </div>
    );
};

