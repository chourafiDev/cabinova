import { BrandMark } from "@/components/brand-mark";
import { getBranding } from "@/lib/branding";

/** Centered auth layout: the platform's mark, title, description, form. */
export async function AuthCard({
	title,
	description,
	children,
}: {
	title: string;
	description: React.ReactNode;
	children?: React.ReactNode;
}) {
	const branding = await getBranding();
	return (
		<main className="bg-background min-h-screen flex items-center justify-center">
			<div className="flex flex-col justify-center items-center px-6 py-8 sm:px-10">
				<div className="flex items-center gap-3">
					<BrandMark branding={branding} className="size-10 text-lg" />
					<span className="text-lg font-semibold">{branding.platformName}</span>
				</div>

				<div className="flex flex-1 py-10">
					<div className="w-full">
						<h1 className="text-2xl text-center font-semibold tracking-tight">{title}</h1>
						<p className="text-muted-foreground text-center mt-1 text-base">{description}</p>
						{children}
					</div>
				</div>
			</div>
		</main>
	);
}
