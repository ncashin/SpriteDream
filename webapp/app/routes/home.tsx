import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "GameIDE" },
    { name: "description", content: "GameIDE" },
  ];
}

export default function Home() {
  return (
    <main>
      <h1>GameIDE</h1>
    </main>
  );
}
