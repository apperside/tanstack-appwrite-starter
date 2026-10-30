import { type ComponentProps, createContext, useContext } from "react";

const InsideMain = createContext(false);

/**
 * The page's `<main>`, rendered once: nested inside another `MainLandmark`
 * (e.g. a status page inside the app shell) it is a plain `<div>`.
 */
export function MainLandmark({
	children,
	...props
}: Omit<ComponentProps<"main">, "ref">) {
	const nested = useContext(InsideMain);
	if (nested) return <div {...props}>{children}</div>;
	return (
		<InsideMain.Provider value={true}>
			<main {...props}>{children}</main>
		</InsideMain.Provider>
	);
}
