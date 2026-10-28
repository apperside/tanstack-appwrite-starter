import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "#/components/ui/toast";
import { toAppError } from "#/lib/errors";
import { signOutEverywhereMutation, signOutMutation } from "./auth.mutations";
import { useAuthMutation } from "./use-auth-mutation";

/**
 * Signs out (of this session, or with `everywhere` of every session), then
 * lands on `/login`; a failure is a toast.
 */
export function useSignOut({ everywhere = false } = {}) {
	const { t } = useTranslation(["common", "errors"]);
	const navigate = useNavigate();
	return useAuthMutation({
		...(everywhere ? signOutEverywhereMutation : signOutMutation),
		onSuccess: () => navigate({ to: "/login" }),
		onError: (error) => toast.error(t(toAppError(error).i18nKey)),
	});
}
