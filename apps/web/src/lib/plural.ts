/** "2 produits" / "1 collection" — safe to use on the server and the client. */
export const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
	`${count} ${count > 1 ? pluralForm : singular}`;
