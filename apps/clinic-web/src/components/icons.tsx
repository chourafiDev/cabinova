import {
  Activity,
  Airplane,
  Archive,
  ArchiveAdd,
  ArchiveBox,
  ArrowRotateLeft,
  Building,
  Calendar,
  Calendar1,
  Calendar2,
  CalendarAdd,
  CalendarEdit,
  CalendarRemove,
  CalendarTick,
  Call,
  Camera,
  Category,
  Chart,
  ChemicalGlass,
  ClipboardText,
  Clock,
  CloseCircle,
  Cloud,
  Coffee,
  Copy,
  Danger,
  Discover,
  Document,
  DocumentDownload,
  DocumentText,
  DocumentUpload,
  Drop,
  Edit,
  Edit2,
  ExportSquare,
  Eye,
  EyeSlash,
  Flag,
  Flash,
  FolderOpen,
  Forbidden2,
  Global,
  Health,
  Home2,
  InfoCircle,
  Key,
  Keyboard,
  Lifebuoy,
  Link,
  Location,
  Lock,
  Login,
  Logout,
  MagicStar,
  MessageText,
  Mobile,
  Money,
  Monitor,
  Moon,
  Notification,
  NotificationBing,
  Personalcard,
  Printer,
  Profile2User,
  ProfileCircle,
  Receipt,
  ReceiptText,
  RecordCircle,
  Refresh,
  RefreshLeftSquare,
  Ruler,
  Scan,
  Scanning,
  SearchNormal1,
  Setting2,
  ShieldCross,
  ShieldSlash,
  ShieldTick,
  Sms,
  Speedometer,
  Stickynote,
  Sun1,
  Tag,
  Teacher,
  TextalignLeft,
  TickCircle,
  Timer,
  Timer1,
  TimerStart,
  Trash,
  TrendUp,
  User,
  UserAdd,
  UserRemove,
  UserTick,
  Video,
  Wallet,
  Warning2,
  WeightMeter,
  Whatsapp,
  Wind,
  type Icon,
  type IconProps,
} from "iconsax-reactjs";
import type { ComponentType, SVGProps } from "react";
import {
  LuAlignCenter,
  LuAlignJustify,
  LuAlignLeft,
  LuAlignRight,
  LuArrowDown,
  LuArrowLeft,
  LuArrowRight,
  LuArrowUp,
  LuBold,
  LuCheck,
  LuCheckCheck,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuChevronUp,
  LuChevronsUpDown,
  LuColumns2,
  LuEllipsis,
  LuEllipsisVertical,
  LuGrid2X2,
  LuGrid3X3,
  LuItalic,
  LuList,
  LuListOrdered,
  LuLoader,
  LuLoaderCircle,
  LuPanelLeft,
  LuPill,
  LuPlugZap,
  LuPlus,
  LuRedo2,
  LuStethoscope,
  LuStrikethrough,
  LuTable2,
  LuThermometer,
  LuUnderline,
  LuUndo2,
  LuUnplug,
  LuX,
} from "react-icons/lu";

/**
 * Every icon the app shows comes from here, so the set and its style change
 * in one place (lint keeps react-icons out of the rest of the code).
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

export const IconActivity = bulk(Activity);
export const IconAlertCircle = bulk(Warning2);
export const IconArchive = bulk(ArchiveBox);
export const IconBan = bulk(Forbidden2);
export const IconBell = bulk(Notification);
export const IconBellRing = bulk(NotificationBing);
export const IconBookmark = bulk(Archive);
export const IconBookmarkAdd = bulk(ArchiveAdd);
export const IconBuilding = bulk(Building);
export const IconCalendar = bulk(Calendar);
export const IconCalendarAdd = bulk(CalendarAdd);
export const IconCalendarCheck = bulk(CalendarTick);
export const IconCalendarClock = bulk(Calendar1);
export const IconCalendarEdit = bulk(CalendarEdit);
export const IconCalendarRange = bulk(Calendar2);
export const IconCalendarRemove = bulk(CalendarRemove);
export const IconCall = bulk(Call);
export const IconCamera = bulk(Camera);
export const IconChart = bulk(Chart);
export const IconCheckCircle = bulk(TickCircle);
export const IconClipboard = bulk(ClipboardText);
export const IconClock = bulk(Clock);
export const IconCloud = bulk(Cloud);
export const IconCoffee = bulk(Coffee);
export const IconCompass = bulk(Discover);
export const IconContact = bulk(ProfileCircle);
export const IconCopy = bulk(Copy);
export const IconDashboard = bulk(Category);
export const IconDocument = bulk(DocumentText);
export const IconDownload = bulk(DocumentDownload);
export const IconDrop = bulk(Drop);
export const IconEdit = bulk(Edit2);
export const IconEducation = bulk(Teacher);
export const IconError = bulk(CloseCircle);
export const IconExternal = bulk(ExportSquare);
export const IconEye = bulk(Eye);
export const IconEyeOff = bulk(EyeSlash);
export const IconFile = bulk(Document);
export const IconFlag = bulk(Flag);
export const IconFlash = bulk(Flash);
export const IconFolderOpen = bulk(FolderOpen);
export const IconGauge = bulk(Speedometer);
export const IconGlobe = bulk(Global);
export const IconHeartPulse = bulk(Health);
export const IconHistory = bulk(Timer1);
export const IconHome = bulk(Home2);
export const IconHourglass = bulk(Timer);
export const IconIdCard = bulk(Personalcard);
export const IconInfo = bulk(InfoCircle);
export const IconKey = bulk(Key);
export const IconKeyboard = bulk(Keyboard);
export const IconLab = bulk(ChemicalGlass);
export const IconLink = bulk(Link);
export const IconLocation = bulk(Location);
export const IconLock = bulk(Lock);
export const IconLogin = bulk(Login);
export const IconLogout = bulk(Logout);
export const IconMail = bulk(Sms);
export const IconMessage = bulk(MessageText);
export const IconMobile = bulk(Mobile);
export const IconMoney = bulk(Money);
export const IconMonitor = bulk(Monitor);
export const IconMoon = bulk(Moon);
export const IconNote = bulk(Stickynote);
export const IconPrinter = bulk(Printer);
export const IconReceipt = bulk(Receipt);
export const IconReceiptText = bulk(ReceiptText);
export const IconRefresh = bulk(Refresh);
export const IconReset = bulk(ArrowRotateLeft);
export const IconRestore = bulk(RefreshLeftSquare);
export const IconRuler = bulk(Ruler);
export const IconScan = bulk(Scan);
export const IconScanSearch = bulk(Scanning);
export const IconSearch = bulk(SearchNormal1);
export const IconSettings = bulk(Setting2);
export const IconShieldAlert = bulk(ShieldCross);
export const IconShieldCheck = bulk(ShieldTick);
export const IconShieldOff = bulk(ShieldSlash);
export const IconSignature = bulk(Edit);
export const IconSparkles = bulk(MagicStar);
export const IconStatus = bulk(RecordCircle);
export const IconSun = bulk(Sun1);
export const IconSupport = bulk(Lifebuoy);
export const IconTag = bulk(Tag);
export const IconText = bulk(TextalignLeft);
export const IconTimer = bulk(TimerStart);
export const IconTrash = bulk(Trash);
export const IconTrend = bulk(TrendUp);
export const IconUpload = bulk(DocumentUpload);
export const IconUser = bulk(User);
export const IconUserAdd = bulk(UserAdd);
export const IconUserCheck = bulk(UserTick);
export const IconUserRemove = bulk(UserRemove);
export const IconUsers = bulk(Profile2User);
export const IconVacation = bulk(Airplane);
export const IconVideo = bulk(Video);
export const IconWallet = bulk(Wallet);
export const IconWarning = bulk(Danger);
export const IconWeight = bulk(WeightMeter);
export const IconWhatsapp = bulk(Whatsapp);
export const IconWind = bulk(Wind);

// Kept from Lucide: control glyphs (chevrons, close, check, spinner), the text
// editor's and the views' layout glyphs, and what Iconsax lacks (medical, plugs).
export const IconAlignCenter: AppIcon = LuAlignCenter;
export const IconAlignJustify: AppIcon = LuAlignJustify;
export const IconAlignLeft: AppIcon = LuAlignLeft;
export const IconAlignRight: AppIcon = LuAlignRight;
export const IconArrowDown: AppIcon = LuArrowDown;
export const IconArrowLeft: AppIcon = LuArrowLeft;
export const IconArrowRight: AppIcon = LuArrowRight;
export const IconArrowUp: AppIcon = LuArrowUp;
export const IconBold: AppIcon = LuBold;
export const IconCheck: AppIcon = LuCheck;
export const IconCheckDouble: AppIcon = LuCheckCheck;
export const IconChevronDown: AppIcon = LuChevronDown;
export const IconChevronLeft: AppIcon = LuChevronLeft;
export const IconChevronRight: AppIcon = LuChevronRight;
export const IconChevronUp: AppIcon = LuChevronUp;
export const IconChevronsUpDown: AppIcon = LuChevronsUpDown;
export const IconClose: AppIcon = LuX;
export const IconColumns: AppIcon = LuColumns2;
export const IconGrid: AppIcon = LuGrid2X2;
export const IconGridLarge: AppIcon = LuGrid3X3;
export const IconItalic: AppIcon = LuItalic;
export const IconList: AppIcon = LuList;
export const IconListOrdered: AppIcon = LuListOrdered;
export const IconMore: AppIcon = LuEllipsis;
export const IconMoreVertical: AppIcon = LuEllipsisVertical;
export const IconPill: AppIcon = LuPill;
export const IconPlug: AppIcon = LuPlugZap;
export const IconPlus: AppIcon = LuPlus;
export const IconRedo: AppIcon = LuRedo2;
export const IconSidebar: AppIcon = LuPanelLeft;
export const IconSpinner: AppIcon = LuLoader;
export const IconSpinnerCircle: AppIcon = LuLoaderCircle;
export const IconStethoscope: AppIcon = LuStethoscope;
export const IconStrikethrough: AppIcon = LuStrikethrough;
export const IconTable: AppIcon = LuTable2;
export const IconThermometer: AppIcon = LuThermometer;
export const IconUnderline: AppIcon = LuUnderline;
export const IconUndo: AppIcon = LuUndo2;
export const IconUnplug: AppIcon = LuUnplug;
