import { useTranslations } from "next-intl";

import { useCalendar } from "@/calendar/contexts/calendar-context";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Practitioner filter. */
export function UserSelect() {
  const { users, selectedUserId, setSelectedUserId } = useCalendar();
  const t = useTranslations("agenda");

  return (
    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
      <SelectTrigger className="flex-1 md:w-52" aria-label={t("practitioner")}>
        <SelectValue />
      </SelectTrigger>

      <SelectContent align="end">
        <SelectItem value="all">{t("allPractitioners")}</SelectItem>
        {users.map(user => (
          <SelectItem key={user.id} value={user.id}>
            {user.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
