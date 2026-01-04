import { initializeSceneECS } from "../core/scene/ecsAdapter";

export function main(rootElement: HTMLElement) {
    const ecs = initializeSceneECS();


    const component = document.createElement('div');
    component.textContent = "Game started!";
    rootElement.appendChild(component);
    console.log("HERE")
}