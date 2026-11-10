// Shared bits of the auth forms (usable from server and client components).

/** Label with the "*" of required fields. */
export function AuthLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
	return (
		<label htmlFor={htmlFor} className="text-sm font-medium">
			{children}
			<span className="text-primary">*</span>
		</label>
	);
}

/** Big dark submit button of the auth forms. */
export const authButtonClass = "h-11 w-full bg-foreground text-background hover:bg-foreground/90 text-sm font-medium";
export const authInputClass = "h-11 px-3.5";
