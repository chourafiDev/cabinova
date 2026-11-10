import { getLocale } from "next-intl/server";
import { intlLocale } from "@/i18n/config";
import { formatterFor } from "./use-format";

/** useFormat for async server components. */
export const getFormat = async () => formatterFor(intlLocale(await getLocale()));
