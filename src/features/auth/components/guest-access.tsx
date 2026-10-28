import { useNavigate } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/ui/button";
import { toast } from "#/components/ui/toast";
import { toAppError } from "#/lib/errors";
import { startGuestSessionMutation } from "../auth.mutations";
import { useAuthMutation } from "../use-auth-mutation";

/** "or — Continue as guest": starts an anonymous account, then onboards it. */
export function GuestAccess() {
	const { t } = useTranslation(["auth", "errors"]);
	const navigate = useNavigate();
	const startGuest = useAuthMutation({
		...startGuestSessionMutation,
		onSuccess: () => navigate({ to: "/onboarding" }),
		onError: (error) => toast.error(t(toAppError(error).i18nKey)),
	});

	return (
		<div className="flex flex-col gap-4">
			<div className="text-muted-foreground flex items-center gap-3 text-xs uppercase">
				<span aria-hidden className="bg-border h-px flex-1" />
				{t("guest.divider")}
				<span aria-hidden className="bg-border h-px flex-1" />
			</div>
			<div className="flex flex-col gap-2">
				<Button
					type="button"
					variant="outline"
					className="min-h-11 w-full"
					disabled={startGuest.isPending}
					onClick={() => startGuest.mutate()}
				>
					{startGuest.isPending && (
						<Loader2Icon aria-hidden className="animate-spin" />
					)}
					{t("guest.continue")}
				</Button>
				<p className="text-muted-foreground text-center text-xs text-pretty">
					{t("guest.hint")}
				</p>
			</div>
		</div>
	);
}
