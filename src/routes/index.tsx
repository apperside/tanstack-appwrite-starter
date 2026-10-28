import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<main className="p-4">
			<h1 className="text-2xl font-bold">Hello</h1>
		</main>
	);
}
