import { useEffect, useState } from "react";

/** The value once it has stopped changing for `delay` ms (compared by content). */
export function useDebouncedValue<T>(value: T, delay: number) {
	const [debounced, setDebounced] = useState(value);
	const key = JSON.stringify(value);
	useEffect(() => {
		const id = setTimeout(() => setDebounced(JSON.parse(key) as T), delay);
		return () => clearTimeout(id);
	}, [key, delay]);
	return debounced;
}
