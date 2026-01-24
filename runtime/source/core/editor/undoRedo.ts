import { getScene, type SceneData } from "../scene/scene";

export type SceneDiff = {
    path: string; // e.g., "ecs.entities.player.transform.x"
    oldValue: unknown;
    newValue: unknown;
    operation: "set" | "delete";
};

const SCENE_HISTORY_LENGTH = 50;

type ECSUpdateCallback = () => void;

class UndoRedoManager {
    private history: SceneDiff[][] = []; // Array of diff arrays (each array is one action)
    private currentIndex: number = -1;
    private ecsUpdateCallback: ECSUpdateCallback | null = null;
    private isApplyingDiff = false; // Flag to prevent recording diffs while applying them



    /**
     * Create a diff from old and new values at a path
     */
    createDiff(path: string, oldValue: unknown, newValue: unknown, operation: "set" | "delete"): SceneDiff {
        return {
            path,
            oldValue: this.serializeValue(oldValue),
            newValue: this.serializeValue(newValue),
            operation,
        };
    }

    /**
     * Serialize a value for storage in diff (deep clone)
     */
    private serializeValue(value: unknown): unknown {
        if (value === undefined || value === null) {
            return value;
        }
        try {
            return JSON.parse(JSON.stringify(value));
        } catch {
            return value;
        }
    }

    /**
     * Record a diff (called by the scene proxy)
     */
    recordDiff(diff: SceneDiff): void {
        if (this.isApplyingDiff) {
            return; // Don't record diffs while applying them
        }

        // If we're in the middle of history, remove future actions
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }

        // If this is the first diff of a new action, create a new array
        if (this.currentIndex === -1 || this.history.length === 0) {
            this.history.push([diff]);
            this.currentIndex = 0;
        } else {
            // Add to the current action's diff array
            this.history[this.currentIndex].push(diff);
        }

        // Limit history size
        if (this.history.length > SCENE_HISTORY_LENGTH) {
            this.history.shift();
            this.currentIndex--;
        }
    }

    /**
     * Start a new action (groups multiple diffs together)
     */
    startAction(): void {
        // Remove any actions after the current index
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }

        // Start a new action
        this.history.push([]);
        this.currentIndex++;

        // Limit history size
        if (this.history.length > SCENE_HISTORY_LENGTH) {
            this.history.shift();
            this.currentIndex--;
        }
    }

    /**
     * Apply a diff to the scene by directly modifying the scene object through the proxy
     */
    private applyDiff(diff: SceneDiff, reverse: boolean = false): void {
        const valueToApply = reverse ? diff.oldValue : diff.newValue;

        // Skip if value is undefined and operation is not delete
        if (valueToApply === undefined && diff.operation !== "delete") {
            return;
        }

        const parts = diff.path.split(".");
        const scene = getScene();

        // Navigate to the parent object
        let current: SceneData = scene;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            const value = current[part];
            if (!value || typeof value !== "object" || Array.isArray(value)) {
                // Path doesn't exist, create it (this will go through the proxy)
                current[part] = {};
            }
            // Get the value again after potentially creating it (to get the proxied version)
            current = current[part] as SceneData;
        }

        const lastPart = parts[parts.length - 1];

        if (diff.operation === "delete" && !reverse) {
            // Delete operation - delete the property
            // This will go through the proxy's deleteProperty handler
            delete current[lastPart];
        } else if (diff.operation === "delete" && reverse) {
            // Undo delete = restore old value
            // This will go through the proxy's set handler
            current[lastPart] = valueToApply;
        } else {
            // Set operation (forward or reverse)
            // Directly set the value - this will go through the proxy's set handler
            // but isApplyingDiff is true, so it won't record a new diff
            // Always set the value to ensure it's applied (even if it appears the same)
            current[lastPart] = valueToApply;
        }
    }

    /**
     * Apply an array of diffs
     */
    private applyDiffs(diffs: SceneDiff[], reverse: boolean = false): void {
        this.isApplyingDiff = true;
        try {
            // Apply diffs in reverse order when undoing (to handle nested changes correctly)
            const diffsToApply = reverse ? [...diffs].reverse() : diffs;
            for (const diff of diffsToApply) {
                this.applyDiff(diff, reverse);
            }

            // Update ECS instance if callback is registered
            if (this.ecsUpdateCallback) {
                this.ecsUpdateCallback();
            }
        } finally {
            this.isApplyingDiff = false;
        }
    }

    /**
     * Undo the last action
     */
    undo(): boolean {
        if (this.currentIndex < 0) {
            return false; // Nothing to undo
        }

        const diffs = this.history[this.currentIndex];
        this.applyDiffs(diffs, true); // Apply in reverse
        this.currentIndex--;

        return true;
    }

    /**
     * Redo the last undone action
     */
    redo(): boolean {
        if (this.currentIndex >= this.history.length - 1) {
            return false; // Nothing to redo
        }

        this.currentIndex++;
        const diffs = this.history[this.currentIndex];
        this.applyDiffs(diffs, false); // Apply forward

        return true;
    }

    /**
     * Check if undo is available
     */
    canUndo(): boolean {
        return this.currentIndex >= 0;
    }

    /**
     * Check if redo is available
     */
    canRedo(): boolean {
        return this.currentIndex < this.history.length - 1;
    }

    /**
     * Clear the history
     */
    clear(): void {
        this.history = [];
        this.currentIndex = -1;
    }

    /**
     * Register a callback to update the ECS instance after applying diffs
     */
    setECSUpdateCallback(callback: ECSUpdateCallback | null): void {
        this.ecsUpdateCallback = callback;
    }

    /**
     * Get the current history state (for debugging)
     */
    getHistoryState(): { currentIndex: number; historyLength: number } {
        return {
            currentIndex: this.currentIndex,
            historyLength: this.history.length,
        };
    }
}

// Singleton instance
export const undoRedoManager = new UndoRedoManager();
