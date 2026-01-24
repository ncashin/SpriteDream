import type { Entity, EntityComponents } from "../ecs/ecs";

export type ClipboardData = {
  entityName: string;
  components: EntityComponents;
};

class ClipboardManager {
  private clipboard: ClipboardData | null = null;

  /**
   * Copy an entity to the clipboard
   */
  copy(entityName: string, components: EntityComponents): void {
    // Deep clone the components
    const clonedComponents = JSON.parse(JSON.stringify(components));
    this.clipboard = {
      entityName,
      components: clonedComponents,
    };
  }

  /**
   * Paste the entity from the clipboard, generating a new unique name
   */
  paste(existingEntityNames: string[]): ClipboardData | null {
    if (!this.clipboard) {
      return null;
    }

    // Generate a unique name
    let newName = `${this.clipboard.entityName}_copy`;
    let counter = 1;

    while (existingEntityNames.includes(newName)) {
      counter++;
      newName = `${this.clipboard.entityName}_copy${counter}`;
    }

    // Deep clone the components
    const clonedComponents = JSON.parse(JSON.stringify(this.clipboard.components));

    // Clear parent reference in transform component if it exists
    if (clonedComponents.transform) {
      clonedComponents.transform = {
        ...clonedComponents.transform,
        parent: null,
      };
    }

    return {
      entityName: newName,
      components: clonedComponents,
    };
  }

  /**
   * Check if clipboard has data
   */
  hasData(): boolean {
    return this.clipboard !== null;
  }

  /**
   * Clear the clipboard
   */
  clear(): void {
    this.clipboard = null;
  }

  /**
   * Get the clipboard data (for debugging)
   */
  getData(): ClipboardData | null {
    return this.clipboard;
  }
}

// Singleton instance
export const clipboardManager = new ClipboardManager();

