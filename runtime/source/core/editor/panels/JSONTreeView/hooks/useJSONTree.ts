import { useState, useEffect, useMemo } from 'react';
import { parseJSONToTree } from '../utils';

export function useJSONTree(json: string) {
    const [localData, setLocalData] = useState(json);

    useEffect(() => {
        setLocalData(json);
    }, [json]);

    const tree = useMemo(() => parseJSONToTree(localData), [localData]);

    return { tree, localData, setLocalData };
}

