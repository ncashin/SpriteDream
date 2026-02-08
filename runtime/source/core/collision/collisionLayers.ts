export type CollisionLayerDefinition = {
    name: string;
    bit?: number;
};

export type CollisionLayer = {
    name: string;
    bit: number;
};

const collisionLayers: CollisionLayer[] = [];
const collisionLayerMap = new Map<string, number>();

const isPowerOfTwo = (value: number) => value > 0 && (value & (value - 1)) === 0;

const getNextAvailableBit = (): number | null => {
    for (let i = 0; i < 32; i += 1) {
        const bit = 1 << i;
        if (![...collisionLayerMap.values()].includes(bit)) {
            return bit;
        }
    }
    return null;
};

export const defineCollisionLayers = (
    layers: Array<string | CollisionLayerDefinition>
): void => {
    collisionLayers.length = 0;
    collisionLayerMap.clear();

    for (const entry of layers) {
        const definition: CollisionLayerDefinition = typeof entry === "string"
            ? { name: entry }
            : entry;

        const name = definition.name?.trim();
        if (!name) continue;

        let bit = definition.bit;
        if (bit === undefined || bit === null) {
            bit = getNextAvailableBit() ?? undefined;
        }

        if (!bit || !Number.isInteger(bit) || !isPowerOfTwo(bit)) {
            console.warn(`Invalid collision layer bit for "${name}": ${String(bit)}`);
            continue;
        }

        collisionLayers.push({ name, bit });
        collisionLayerMap.set(name, bit);
    }
};

export const getCollisionLayers = (): CollisionLayer[] => [...collisionLayers];

export const getCollisionLayerBit = (name: string): number | undefined =>
    collisionLayerMap.get(name);

export const getCollisionLayerOptions = (): string[] =>
    collisionLayers.map((layer) => `${layer.bit}: ${layer.name}`);


