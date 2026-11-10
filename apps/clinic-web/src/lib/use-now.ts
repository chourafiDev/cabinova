import { useEffect, useState } from "react";

/** Re-renders now and then: "dans 5 minutes" keeps counting down. */
export function useNow(every = 30_000) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), every);
		return () => clearInterval(id);
	}, [every]);
	return now;
}
