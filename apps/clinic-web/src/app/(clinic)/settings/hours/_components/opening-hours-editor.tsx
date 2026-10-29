"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LuCopy, LuLoader, LuPlus, LuX } from "react-icons/lu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";
import { type ManagedSpace, type OpeningHours, WEEK, openingHoursErrors, toMinutes } from "@/lib/settings";
import { spaceLabel } from "@/lib/spaces";
import { cn } from "@/lib/utils";
import { SettingsCard } from "../../_components/settings-card";

type Day = keyof OpeningHours;
const MAX_PERIODS = 3;
const WORKDAYS: Day[] = ["1", "2", "3", "4", "5"];

/** minutes → "HH:MM", capped to the day. */
const toTime = (minutes: number) => {
	const m = Math.min(minutes, 23 * 60 + 59);
	return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** A space's week: opening periods per day (a lunch break = two periods). */
export function OpeningHoursEditor({ space, spaces }: { space: ManagedSpace; spaces: ManagedSpace[] }) {
	const router = useRouter();
	const [saved, setSaved] = useState(space.openingHours);
	const [hours, setHours] = useState(space.openingHours);
	const [saving, setSaving] = useState(false);
	const errors = openingHoursErrors(hours);
	const invalid = Object.keys(errors).length > 0;
	const dirty = JSON.stringify(hours) !== JSON.stringify(saved);

	const setDay = (day: Day, periods: OpeningHours[Day]) => setHours((h) => ({ ...h, [day]: periods }));
	const addPeriod = (day: Day) => {
		const periods = hours[day];
		const last = periods.at(-1);
		// The usual reason: a lunch break. A single period spanning midday
		// becomes a morning and an afternoon (08:00–18:00 → 08:00–13:00, 15:00–18:00).
		if (periods.length === 1 && last && last.from <= "12:00" && last.to >= "16:00") {
			return setDay(day, [
				{ from: last.from, to: "13:00" },
				{ from: "15:00", to: last.to },
			]);
		}
		// Otherwise after the last period, with an hour's break.
		const from = last ? toMinutes(last.to) + 60 : 9 * 60;
		setDay(day, [...periods, { from: toTime(from), to: toTime(from + 2 * 60) }]);
	};
	const copyMonday = () => {
		setHours((h) => ({ ...h, ...Object.fromEntries(WORKDAYS.map((d) => [d, h["1"].map((p) => ({ ...p }))])) }));
		toast.info("Horaires du lundi appliqués du mardi au vendredi");
	};

	const save = async () => {
		setSaving(true);
		try {
			const res = await api<ManagedSpace>(`/spaces/${space.id}/hours`, {
				method: "PUT",
				body: JSON.stringify({ openingHours: hours }),
			});
			setSaved(res.openingHours);
			setHours(res.openingHours);
			toast.success(`Horaires de « ${space.name} » enregistrés`);
			router.refresh();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
		} finally {
			setSaving(false);
		}
	};

	return (
		<SettingsCard
			title="Horaires d’ouverture"
			description="L’agenda grise les heures de fermeture ; un rendez-vous en dehors reste possible, avec un avertissement."
			action={
				spaces.length > 1 && (
					<Select
						value={space.id}
						onValueChange={(id) => router.push(`/settings/hours?espace=${id}`, { scroll: false })}
					>
						<SelectTrigger size="sm" className="w-56" aria-label="Espace">
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							{spaces.map((s) => (
								<SelectItem key={s.id} value={s.id}>
									{spaceLabel(s)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)
			}
			footer={
				<>
					<Button type="button" variant="ghost" size="sm" className="-ms-2" onClick={copyMonday}>
						<LuCopy /> Copier le lundi du mardi au vendredi
					</Button>
					<div className="flex items-center gap-2">
						{dirty && (
							<Button type="button" variant="ghost" size="sm" onClick={() => setHours(saved)}>
								Annuler
							</Button>
						)}
						<Button size="sm" disabled={!dirty || invalid || saving} onClick={save}>
							{saving && <LuLoader className="animate-spin" />} Enregistrer
						</Button>
					</div>
				</>
			}
		>
			<ul className="divide-y rounded-lg border">
				{WEEK.map(({ key, label }) => {
					const periods = hours[key];
					const open = periods.length > 0;
					return (
						<li key={key} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-start">
							<label className="flex h-8 items-center gap-3">
								<Switch
									checked={open}
									onCheckedChange={(on) => setDay(key, on ? [{ from: "09:00", to: "18:00" }] : [])}
									aria-label={`${label} : ${open ? "ouvert" : "fermé"}`}
								/>
								<span className={cn("text-sm font-medium", !open && "text-muted-foreground")}>{label}</span>
							</label>
							{open ? (
								<div className="grid gap-1.5">
									<div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
										{periods.map((p, i) => (
											<div key={i} className="flex items-center gap-1.5">
												<Input
													type="time"
													step={900}
													value={p.from}
													aria-label={`${label}, plage ${i + 1} : début`}
													className="h-8 w-[6.5rem]"
													onChange={(e) =>
														setDay(key, periods.map((q, j) => (j === i ? { ...q, from: e.target.value } : q)))
													}
												/>
												<span className="text-muted-foreground text-sm">–</span>
												<Input
													type="time"
													step={900}
													value={p.to}
													aria-label={`${label}, plage ${i + 1} : fin`}
													className="h-8 w-[6.5rem]"
													onChange={(e) =>
														setDay(key, periods.map((q, j) => (j === i ? { ...q, to: e.target.value } : q)))
													}
												/>
												{periods.length > 1 && (
													<Button
														type="button"
														variant="ghost"
														size="icon"
														className="text-muted-foreground size-7"
														aria-label={`Retirer la plage ${i + 1} du ${label.toLowerCase()}`}
														onClick={() => setDay(key, periods.filter((_, j) => j !== i))}
													>
														<LuX />
													</Button>
												)}
											</div>
										))}
										{periods.length < MAX_PERIODS && (
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="text-muted-foreground h-8"
												onClick={() => addPeriod(key)}
											>
												<LuPlus /> Plage
											</Button>
										)}
									</div>
									{errors[key] && <p className="text-destructive text-xs">{errors[key]}</p>}
								</div>
							) : (
								<span className="text-muted-foreground flex h-8 items-center text-sm">Fermé</span>
							)}
						</li>
					);
				})}
			</ul>
		</SettingsCard>
	);
}
