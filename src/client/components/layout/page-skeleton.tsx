import { useTranslation } from "react-i18next";
import { Skeleton } from "#/client/components/ui/skeleton";
import { cn } from "#/lib/cn";
import { AuthFrame } from "./auth-layout";
import { pageClassName } from "./page";

type Variant = "form" | "list" | "card";

// Fixed, varied widths: random ones would differ between server and client.
const ROW_WIDTHS = ["w-3/4", "w-2/3", "w-4/5", "w-1/2", "w-3/5"];

/** Title (text-2xl = 32px line) and optional description (text-sm = 20px line). */
function HeadingSkeleton({ description = true }: { description?: boolean }) {
	return (
		<div className="flex flex-col gap-1.5">
			<Skeleton className="h-8 w-48 max-w-full" />
			{description && <Skeleton className="h-5 w-64 max-w-full" />}
		</div>
	);
}

function FormSkeleton() {
	return (
		<AuthFrame>
			<div className="flex flex-col gap-6">
				<Skeleton className="size-8 rounded-lg" />
				<HeadingSkeleton />
			</div>
			<div className="flex flex-col gap-4">
				{[0, 1].map((field) => (
					<div key={field} className="flex flex-col gap-2">
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-9 w-full pointer-coarse:h-11" />
					</div>
				))}
				<Skeleton className="h-9 w-full pointer-coarse:h-11" />
			</div>
		</AuthFrame>
	);
}

function ListSkeleton() {
	return (
		<div className={pageClassName}>
			<HeadingSkeleton />
			<div className="divide-y rounded-xl border">
				{ROW_WIDTHS.map((width) => (
					<div key={width} className="flex h-14 items-center gap-3 px-4">
						<Skeleton className="size-8 shrink-0 rounded-full" />
						<Skeleton className={cn("h-4", width)} />
					</div>
				))}
			</div>
		</div>
	);
}

function CardSkeleton() {
	return (
		<div className={pageClassName}>
			<HeadingSkeleton />
			<div className="flex flex-col gap-4 rounded-xl border p-6">
				<Skeleton className="h-5 w-40" />
				{ROW_WIDTHS.slice(0, 3).map((width) => (
					<Skeleton key={width} className={cn("h-4", width)} />
				))}
			</div>
		</div>
	);
}

const VARIANTS = { form: FormSkeleton, list: ListSkeleton, card: CardSkeleton };

/**
 * A loading placeholder shaped like the page it stands in for. The router's
 * default pending component (`card`); routes pick a closer `variant`.
 */
export function PageSkeleton({ variant = "card" }: { variant?: Variant }) {
	const { t } = useTranslation();
	const Body = VARIANTS[variant];
	return (
		<output
			aria-busy="true"
			aria-label={t("states.loading")}
			data-variant={variant}
			className="contents"
		>
			<Body />
		</output>
	);
}
