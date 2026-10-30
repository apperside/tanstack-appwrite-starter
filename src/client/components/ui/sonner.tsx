import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useDocumentTheme } from "#/client/hooks/use-document-theme";

const Toaster = ({ ...props }: ToasterProps) => {
	const theme = useDocumentTheme();

	return (
		<Sonner
			theme={theme}
			className="toaster group"
			style={
				{
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "var(--border)",
				} as React.CSSProperties
			}
			{...props}
		/>
	);
};

export { Toaster };
