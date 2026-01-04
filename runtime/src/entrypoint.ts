
export function main(rootElement: HTMLElement) {
    const component = document.createElement('div');
    component.textContent = "Game started!";
    rootElement.appendChild(component);
    console.log("HERE")
}