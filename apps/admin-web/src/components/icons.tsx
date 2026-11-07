import {
  AddCircle,
  ArchiveBook,
  ArchiveBox,
  ArrowRotateLeft,
  Bank,
  Building,
  Calendar,
  Calendar1,
  Call,
  CallIncoming,
  Card,
  Category,
  Clock,
  CloseCircle,
  Code,
  Copy,
  Danger,
  DocumentDownload,
  DocumentText,
  Driver,
  Edit2,
  Element4,
  ExportSquare,
  Eye,
  EyeSlash,
  Forbidden2,
  GalleryImport,
  Global,
  Hashtag,
  Hierarchy,
  InfoCircle,
  Key,
  Keyboard,
  Layer,
  Lifebuoy,
  Location,
  Lock,
  Logout,
  Message,
  MinusCirlce,
  Mobile,
  Money,
  Monitor,
  Moon,
  Notification,
  NotificationBing,
  People,
  Printer,
  Receipt,
  ReceiptDiscount,
  ReceiptText,
  RecordCircle,
  Refresh,
  SearchNormal1,
  Send2,
  Setting2,
  Setting4,
  ShieldCross,
  ShieldSlash,
  ShieldTick,
  Sms,
  Speedometer,
  Star1,
  Sun1,
  Tag,
  TickCircle,
  TicketDiscount,
  Timer,
  Trash,
  TrendUp,
  User,
  UserAdd,
  UserRemove,
  Wallet,
  Warning2,
  type Icon,
  type IconProps,
} from "iconsax-reactjs";
import type { ComponentType, SVGProps } from "react";
import {
  LuArrowDown,
  LuArrowLeft,
  LuArrowRight,
  LuArrowUp,
  LuCheck,
  LuCheckCheck,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuChevronUp,
  LuChevronsLeft,
  LuChevronsRight,
  LuChevronsUpDown,
  LuCircleDashed,
  LuEllipsis,
  LuEllipsisVertical,
  LuLoader,
  LuLoaderCircle,
  LuMinus,
  LuPanelLeft,
  LuPlus,
  LuPower,
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

export const IconAddCircle = bulk(AddCircle);
export const IconAlertCircle = bulk(Warning2);
export const IconArchive = bulk(ArchiveBox);
export const IconBan = bulk(Forbidden2);
export const IconBank = bulk(Bank);
export const IconBell = bulk(Notification);
export const IconBellRing = bulk(NotificationBing);
export const IconBuilding = bulk(Building);
export const IconCalendar = bulk(Calendar);
export const IconCalendarClock = bulk(Calendar1);
export const IconCall = bulk(Call);
export const IconCallIncoming = bulk(CallIncoming);
export const IconCard = bulk(Card);
export const IconChat = bulk(Message);
export const IconCheckCircle = bulk(TickCircle);
export const IconClock = bulk(Clock);
export const IconCode = bulk(Code);
export const IconCopy = bulk(Copy);
export const IconCoupon = bulk(TicketDiscount);
export const IconDashboard = bulk(Category);
export const IconDocument = bulk(DocumentText);
export const IconDownload = bulk(DocumentDownload);
export const IconEdit = bulk(Edit2);
export const IconError = bulk(CloseCircle);
export const IconExternal = bulk(ExportSquare);
export const IconEye = bulk(Eye);
export const IconEyeOff = bulk(EyeSlash);
export const IconFileArchive = bulk(ArchiveBook);
export const IconFilter = bulk(Setting4);
export const IconGauge = bulk(Speedometer);
export const IconGlobe = bulk(Global);
export const IconHash = bulk(Hashtag);
export const IconHourglass = bulk(Timer);
export const IconImageUpload = bulk(GalleryImport);
export const IconInfo = bulk(InfoCircle);
export const IconKey = bulk(Key);
export const IconKeyboard = bulk(Keyboard);
export const IconLayers = bulk(Layer);
export const IconLocation = bulk(Location);
export const IconLock = bulk(Lock);
export const IconLogout = bulk(Logout);
export const IconMail = bulk(Sms);
export const IconMigration = bulk(Hierarchy);
export const IconMinusCircle = bulk(MinusCirlce);
export const IconMobile = bulk(Mobile);
export const IconModules = bulk(Element4);
export const IconMoney = bulk(Money);
export const IconMonitor = bulk(Monitor);
export const IconMoon = bulk(Moon);
export const IconPeople = bulk(People);
export const IconPrinter = bulk(Printer);
export const IconReceipt = bulk(Receipt);
export const IconReceiptDiscount = bulk(ReceiptDiscount);
export const IconReceiptText = bulk(ReceiptText);
export const IconRefresh = bulk(Refresh);
export const IconReset = bulk(ArrowRotateLeft);
export const IconSearch = bulk(SearchNormal1);
export const IconSend = bulk(Send2);
export const IconServer = bulk(Driver);
export const IconSettings = bulk(Setting2);
export const IconShieldAlert = bulk(ShieldCross);
export const IconShieldCheck = bulk(ShieldTick);
export const IconShieldOff = bulk(ShieldSlash);
export const IconStar = bulk(Star1);
export const IconStatus = bulk(RecordCircle);
export const IconSun = bulk(Sun1);
export const IconSupport = bulk(Lifebuoy);
export const IconTag = bulk(Tag);
export const IconTrash = bulk(Trash);
export const IconTrend = bulk(TrendUp);
export const IconUser = bulk(User);
export const IconUserAdd = bulk(UserAdd);
export const IconUserRemove = bulk(UserRemove);
export const IconWallet = bulk(Wallet);
export const IconWarning = bulk(Danger);

// Kept from Lucide: control glyphs (chevrons, close, check, spinner) and what
// Iconsax lacks.
export const IconArrowDown: AppIcon = LuArrowDown;
export const IconArrowLeft: AppIcon = LuArrowLeft;
export const IconArrowRight: AppIcon = LuArrowRight;
export const IconArrowUp: AppIcon = LuArrowUp;
export const IconCheck: AppIcon = LuCheck;
export const IconCheckDouble: AppIcon = LuCheckCheck;
export const IconChevronDown: AppIcon = LuChevronDown;
export const IconChevronLeft: AppIcon = LuChevronLeft;
export const IconChevronRight: AppIcon = LuChevronRight;
export const IconChevronUp: AppIcon = LuChevronUp;
export const IconChevronsLeft: AppIcon = LuChevronsLeft;
export const IconChevronsRight: AppIcon = LuChevronsRight;
export const IconChevronsUpDown: AppIcon = LuChevronsUpDown;
export const IconClose: AppIcon = LuX;
export const IconMinus: AppIcon = LuMinus;
export const IconMore: AppIcon = LuEllipsis;
export const IconMoreVertical: AppIcon = LuEllipsisVertical;
export const IconPending: AppIcon = LuCircleDashed;
export const IconPlus: AppIcon = LuPlus;
export const IconPower: AppIcon = LuPower;
export const IconSidebar: AppIcon = LuPanelLeft;
export const IconSpinner: AppIcon = LuLoader;
export const IconSpinnerCircle: AppIcon = LuLoaderCircle;
export const IconStethoscope: AppIcon = LuStethoscope;
