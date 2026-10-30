"use client";

import { useRouter } from "next/navigation";
import { TwoFactorSetup } from "@/components/two-factor-setup";

export function SecuritySetup() {
	const router = useRouter();
	return (
		<TwoFactorSetup
			onDone={() => {
				router.replace("/");
				router.refresh();
			}}
		/>
	);
}
