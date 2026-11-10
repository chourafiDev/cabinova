"use client";

import { animate, useInView } from "motion/react";
import { useEffect, useRef } from "react";

const format = (value: number) => new Intl.NumberFormat("fr-MA").format(value);

/** A figure that counts up from 0 the first time it scrolls into view (the final value without JS or with reduced motion). */
export function CountUp({ to, className }: { to: number; className?: string }) {
	const ref = useRef<HTMLSpanElement>(null);
	const inView = useInView(ref, { once: true, margin: "-60px" });

	useEffect(() => {
		const el = ref.current;
		if (!inView || !el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const controls = animate(0, to, {
			duration: 1.6,
			ease: "easeOut",
			onUpdate: (v) => {
				el.textContent = format(Math.round(v));
			},
		});
		return () => controls.stop();
	}, [inView, to]);

	return (
		<span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
			{format(to)}
		</span>
	);
}
