"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useSessionStore } from "@/stores/session-store";

const Header = () => {
	const now = new Date();
	const name = useSessionStore((s) => s.session?.user.name ?? "");

	return (
		<section className="mb-5 flex md:flex-row flex-col md:items-center items-start md:gap-10 gap-5 bg-brand dark:bg-brand/10 md:py-10 py-6 px-8 rounded-2xl">
			<div>
				<h1 className="text-white text-xl font-medium tracking-[0.015rem] mb-0.5 flex items-center gap-3">
					Bienvenue, <span className="text-brand-light font-semibold">{name}</span>
				</h1>
				<p className="text-white/80 text-sm tracking-[0.010rem]">
					Vue d&apos;ensemble de la plateforme Cabinova.
				</p>
			</div>

			<div className="flex items-center gap-3 md:border-l border-white/30 border-dashed md:pl-10">
				<div className="size-12 font-semibold rounded-full text-xl text-white border flex justify-center items-center">
					{format(now, "d")}
				</div>
				<div>
					<p className="text-white text-sm font-medium">{format(now, "EEE", { locale: fr })}</p>
					<p className="text-white text-sm font-medium">{format(now, "MMMM", { locale: fr })}</p>
				</div>
			</div>
		</section>
	);
};

export default Header;
