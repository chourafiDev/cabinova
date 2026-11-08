import {
  Building,
  Calendar,
  CalendarTick,
  Card,
  Chart,
  ClipboardText,
  Devices,
  DocumentText,
  Driver,
  EyeSlash,
  Hashtag,
  InfoCircle,
  Key,
  LampCharge,
  Layer,
  Lifebuoy,
  Location,
  Login,
  MagicStar,
  Money,
  PlayCircle,
  Profile2User,
  Receipt,
  SearchNormal1,
  Setting2,
  ShieldTick,
  Sms,
  Timer1,
  UserRemove,
  Warning2,
  Clock,
  Health,
  Hospital,
  Messages2,
  Notification,
  Profile,
  Star1,
  TickCircle,
  Translate,
  UserTick,
  Moon,
  Sun1,
  type Icon,
  type IconProps,
} from "iconsax-reactjs";
import type { ComponentType, SVGProps } from "react";
import {
  LuArrowLeft,
  LuArrowRight,
  LuCheck,
  LuChevronDown,
  LuChevronRight,
  LuCornerDownLeft,
  LuLoader,
  LuMenu,
  LuPlus,
  LuRocket,
  LuStethoscope,
  LuX,
} from "react-icons/lu";

/**
 * Every icon the app shows comes from here, so the set and its style change
 * in one place (lint keeps icon packages out of the rest of the code).
 */
export type AppIcon = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Iconsax in its "Bulk" style (a soft fill with darker details), from the
 * Moaaim Figma file. Sized by CSS (`size-4`, `[&>svg]:size-4`) and colored
 * by the text (currentColor), like the Lucide glyphs below.
 */
function bulk(Glyph: Icon): AppIcon {
  const BulkIcon = (props: Omit<IconProps, "variant">) => <Glyph variant="Bulk" aria-hidden {...props} />;
  BulkIcon.displayName = `Bulk(${Glyph.displayName ?? "Icon"})`;
  return BulkIcon;
}

export const IconAlertCircle = bulk(Warning2);
export const IconBuilding = bulk(Building);
export const IconCalendar = bulk(Calendar);
export const IconCalendarCheck = bulk(CalendarTick);
export const IconCard = bulk(Card);
export const IconChart = bulk(Chart);
export const IconClipboard = bulk(ClipboardText);
export const IconDevices = bulk(Devices);
export const IconDocument = bulk(DocumentText);
export const IconEyeOff = bulk(EyeSlash);
export const IconHash = bulk(Hashtag);
export const IconHistory = bulk(Timer1);
export const IconIdea = bulk(LampCharge);
export const IconInfo = bulk(InfoCircle);
export const IconKey = bulk(Key);
export const IconLayers = bulk(Layer);
export const IconLocation = bulk(Location);
export const IconLogin = bulk(Login);
export const IconMail = bulk(Sms);
export const IconMoney = bulk(Money);
export const IconPlay = bulk(PlayCircle);
export const IconReceipt = bulk(Receipt);
export const IconSearch = bulk(SearchNormal1);
export const IconServer = bulk(Driver);
export const IconSettings = bulk(Setting2);
export const IconShieldCheck = bulk(ShieldTick);
export const IconSparkles = bulk(MagicStar);
export const IconSupport = bulk(Lifebuoy);
export const IconUserRemove = bulk(UserRemove);
export const IconUsers = bulk(Profile2User);
export const IconMoon = bulk(Moon);
export const IconSun = bulk(Sun1);
export const IconBell = bulk(Notification);
export const IconChat = bulk(Messages2);
export const IconCheckCircle = bulk(TickCircle);
export const IconClock = bulk(Clock);
export const IconHealth = bulk(Health);
export const IconHospital = bulk(Hospital);
export const IconLanguage = bulk(Translate);
export const IconProfile = bulk(Profile);
export const IconStar = bulk(Star1);
export const IconUserCheck = bulk(UserTick);

// Kept from Lucide: control glyphs (chevrons, close, check, spinner) and what
// Iconsax lacks.
export const IconArrowLeft: AppIcon = LuArrowLeft;
export const IconArrowRight: AppIcon = LuArrowRight;
export const IconCheck: AppIcon = LuCheck;
export const IconChevronDown: AppIcon = LuChevronDown;
export const IconChevronRight: AppIcon = LuChevronRight;
export const IconClose: AppIcon = LuX;
export const IconEnter: AppIcon = LuCornerDownLeft;
export const IconMenu: AppIcon = LuMenu;
export const IconPlus: AppIcon = LuPlus;
export const IconRocket: AppIcon = LuRocket;
export const IconSpinner: AppIcon = LuLoader;
export const IconStethoscope: AppIcon = LuStethoscope;
