import { Box } from '@mui/material';
import type { SvgIconProps } from '@mui/material/SvgIcon';
import type { SxProps, Theme } from '@mui/material/styles';
import {
  IconAdjustmentsHorizontal,
  IconAlertTriangle,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconArrowRight,
  IconArrowsLeftRight,
  IconBadge,
  IconBan,
  IconBell,
  IconBellRinging,
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandLinkedin,
  IconBrandSnapchat,
  IconBrandTelegram,
  IconBrandTiktok,
  IconBrandWhatsapp,
  IconBrandX,
  IconBrandYoutube,
  IconBrush,
  IconBuildingStore,
  IconBuildingWarehouse,
  IconCalendarTime,
  IconChartArcs3,
  IconChartBar,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
  IconCircleX,
  IconClipboardCheck,
  IconCloudUpload,
  IconClock,
  IconColorSwatch,
  IconCopy,
  IconCreditCard,
  IconCurrencyDollar,
  IconDeviceFloppy,
  IconDiscount,
  IconDots,
  IconDownload,
  IconEye,
  IconEyeOff,
  IconFilePlus,
  IconFileText,
  IconGripVertical,
  IconHome,
  IconLayoutDashboard,
  IconLink,
  IconListTree,
  IconLogin,
  IconLogout,
  IconMailCheck,
  IconMapPin,
  IconMenu2,
  IconMoon,
  IconPackage,
  IconPalette,
  IconPencil,
  IconPhoto,
  IconPlayerPlay,
  IconPlugConnected,
  IconPlus,
  IconReceipt,
  IconReceipt2,
  IconRefresh,
  IconRocket,
  IconRotateClockwise,
  IconSearch,
  IconSettings,
  IconShieldCheck,
  IconShoppingBag,
  IconShoppingCart,
  IconSpeakerphone,
  IconStar,
  IconStarFilled,
  IconSun,
  IconTag,
  IconTrash,
  IconTrendingUp,
  IconTruckDelivery,
  IconUpload,
  IconUserPlus,
  IconUserShield,
  IconUsers,
  IconUsersGroup,
  IconWand,
  IconWebhook,
  IconWorld,
  type TablerIcon,
} from '@tabler/icons-react';
import { forwardRef } from 'react';

type MuiIconColor = NonNullable<SvgIconProps['color']>;
const IconBox = Box as any;

export type KaleemIconProps = Omit<SvgIconProps, 'children' | 'component' | 'viewBox'> & {
  absoluteStrokeWidth?: boolean;
  strokeWidth?: number;
};

const ICON_SIZE_BY_FONT_SIZE: Record<string, number | string> = {
  inherit: 'inherit',
  small: 18,
  medium: 22,
  large: 28,
};

const ICON_COLOR_BY_MUI_COLOR: Partial<Record<MuiIconColor, string>> = {
  action: 'action.active',
  disabled: 'action.disabled',
  error: 'error.main',
  info: 'info.main',
  inherit: 'inherit',
  primary: 'primary.main',
  secondary: 'secondary.main',
  success: 'success.main',
  warning: 'warning.main',
};

function normalizeSx(sx: SxProps<Theme> | undefined): SxProps<Theme>[] {
  if (!sx) {
    return [];
  }

  return Array.isArray(sx) ? sx : [sx];
}

function composeIconSx(
  fontSize: number | string,
  color: string,
  sx: SxProps<Theme> | undefined,
): SxProps<Theme> {
  return [
    {
      color,
      display: 'inline-block',
      flexShrink: 0,
      fontSize,
      height: '1em',
      lineHeight: 1,
      verticalAlign: 'middle',
      width: '1em',
    },
    ...normalizeSx(sx),
  ] as SxProps<Theme>;
}

function getIconSize(fontSize: KaleemIconProps['fontSize']) {
  if (!fontSize) {
    return 22;
  }

  return ICON_SIZE_BY_FONT_SIZE[String(fontSize)] ?? fontSize ?? 22;
}

function getIconColor(color: KaleemIconProps['color'], htmlColor: string | undefined) {
  if (htmlColor) {
    return htmlColor;
  }

  if (!color) {
    return 'inherit';
  }

  return ICON_COLOR_BY_MUI_COLOR[color] ?? 'inherit';
}

export function createTablerMuiIcon(Icon: TablerIcon, displayName: string) {
  const WrappedIcon = forwardRef<SVGSVGElement, KaleemIconProps>(function KaleemTablerIcon(
    {
      absoluteStrokeWidth: _absoluteStrokeWidth,
      classes: _classes,
      color = 'inherit',
      fontSize = 'medium',
      htmlColor,
      strokeWidth = 2,
      sx,
      titleAccess,
      ...rest
    },
    ref,
  ) {
    const iconSize = getIconSize(fontSize);

    return (
      <IconBox
        aria-hidden={titleAccess ? undefined : true}
        aria-label={titleAccess}
        component={Icon}
        focusable="false"
        ref={ref}
        role={titleAccess ? 'img' : undefined}
        size="1em"
        stroke={strokeWidth}
        title={titleAccess}
        sx={composeIconSx(iconSize, getIconColor(color, htmlColor), sx) as any}
        {...rest}
      />
    );
  });

  WrappedIcon.displayName = displayName;
  return WrappedIcon;
}

export const AccountTreeIcon = createTablerMuiIcon(IconListTree, 'AccountTreeIcon');
export const AddIcon = createTablerMuiIcon(IconPlus, 'AddIcon');
export const AddShoppingCartIcon = createTablerMuiIcon(IconShoppingCart, 'AddShoppingCartIcon');
export const AdminPanelSettingsIcon = createTablerMuiIcon(IconUserShield, 'AdminPanelSettingsIcon');
export const AnalyticsIcon = createTablerMuiIcon(IconChartArcs3, 'AnalyticsIcon');
export const ArrowForwardIcon = createTablerMuiIcon(IconArrowRight, 'ArrowForwardIcon');
export const AssignmentReturnIcon = createTablerMuiIcon(IconArrowBackUp, 'AssignmentReturnIcon');
export const BarChartIcon = createTablerMuiIcon(IconChartBar, 'BarChartIcon');
export const BlockIcon = createTablerMuiIcon(IconBan, 'BlockIcon');
export const BrandingWatermarkIcon = createTablerMuiIcon(IconBadge, 'BrandingWatermarkIcon');
export const CampaignIcon = createTablerMuiIcon(IconSpeakerphone, 'CampaignIcon');
export const CancelOutlinedIcon = createTablerMuiIcon(IconCircleX, 'CancelOutlinedIcon');
export const CheckIcon = createTablerMuiIcon(IconCheck, 'CheckIcon');
export const CheckCircleIcon = createTablerMuiIcon(IconCircleCheck, 'CheckCircleIcon');
export const CheckCircleOutlineIcon = createTablerMuiIcon(IconCircleCheck, 'CheckCircleOutlineIcon');
export const CloudUploadIcon = createTablerMuiIcon(IconCloudUpload, 'CloudUploadIcon');
export const ColorLensIcon = createTablerMuiIcon(IconPalette, 'ColorLensIcon');
export const CompareArrowsIcon = createTablerMuiIcon(IconArrowsLeftRight, 'CompareArrowsIcon');
export const ContentCopyIcon = createTablerMuiIcon(IconCopy, 'ContentCopyIcon');
export const DarkModeOutlinedIcon = createTablerMuiIcon(IconMoon, 'DarkModeOutlinedIcon');
export const DashboardIcon = createTablerMuiIcon(IconLayoutDashboard, 'DashboardIcon');
export const DeleteOutlineIcon = createTablerMuiIcon(IconTrash, 'DeleteOutlineIcon');
export const DescriptionIcon = createTablerMuiIcon(IconFileText, 'DescriptionIcon');
export const DiscountIcon = createTablerMuiIcon(IconDiscount, 'DiscountIcon');
export const DownloadIcon = createTablerMuiIcon(IconDownload, 'DownloadIcon');
export const DragIndicatorIcon = createTablerMuiIcon(IconGripVertical, 'DragIndicatorIcon');
export const EditNoteIcon = createTablerMuiIcon(IconPencil, 'EditNoteIcon');
export const ExpandLess = createTablerMuiIcon(IconChevronUp, 'ExpandLess');
export const ExpandMore = createTablerMuiIcon(IconChevronDown, 'ExpandMore');
export const ExpandMoreIcon = createTablerMuiIcon(IconChevronDown, 'ExpandMoreIcon');
export const FactCheckIcon = createTablerMuiIcon(IconClipboardCheck, 'FactCheckIcon');
export const FacebookIcon = createTablerMuiIcon(IconBrandFacebook, 'FacebookIcon');
export const HomeRoundedIcon = createTablerMuiIcon(IconHome, 'HomeRoundedIcon');
export const ImageIcon = createTablerMuiIcon(IconPhoto, 'ImageIcon');
export const InstagramIcon = createTablerMuiIcon(IconBrandInstagram, 'InstagramIcon');
export const InventoryIcon = createTablerMuiIcon(IconPackage, 'InventoryIcon');
export const Inventory2Icon = createTablerMuiIcon(IconBuildingWarehouse, 'Inventory2Icon');
export const KeyboardArrowDownIcon = createTablerMuiIcon(IconChevronDown, 'KeyboardArrowDownIcon');
export const LanguageIcon = createTablerMuiIcon(IconWorld, 'LanguageIcon');
export const LightModeOutlinedIcon = createTablerMuiIcon(IconSun, 'LightModeOutlinedIcon');
export const LinkIcon = createTablerMuiIcon(IconLink, 'LinkIcon');
export const LinkedInIcon = createTablerMuiIcon(IconBrandLinkedin, 'LinkedInIcon');
export const LocalMallIcon = createTablerMuiIcon(IconShoppingBag, 'LocalMallIcon');
export const LocalOfferIcon = createTablerMuiIcon(IconTag, 'LocalOfferIcon');
export const LocalShippingIcon = createTablerMuiIcon(IconTruckDelivery, 'LocalShippingIcon');
export const LocationOnIcon = createTablerMuiIcon(IconMapPin, 'LocationOnIcon');
export const LoginRoundedIcon = createTablerMuiIcon(IconLogin, 'LoginRoundedIcon');
export const LogoutIcon = createTablerMuiIcon(IconLogout, 'LogoutIcon');
export const MarkEmailReadOutlinedIcon = createTablerMuiIcon(IconMailCheck, 'MarkEmailReadOutlinedIcon');
export const MenuIcon = createTablerMuiIcon(IconMenu2, 'MenuIcon');
export const MenuRoundedIcon = createTablerMuiIcon(IconMenu2, 'MenuRoundedIcon');
export const MonetizationOnIcon = createTablerMuiIcon(IconCurrencyDollar, 'MonetizationOnIcon');
export const MoreHorizIcon = createTablerMuiIcon(IconDots, 'MoreHorizIcon');
export const NoteAddIcon = createTablerMuiIcon(IconFilePlus, 'NoteAddIcon');
export const NotificationsIcon = createTablerMuiIcon(IconBell, 'NotificationsIcon');
export const NotificationsActiveOutlinedIcon = createTablerMuiIcon(
  IconBellRinging,
  'NotificationsActiveOutlinedIcon',
);
export const PaletteIcon = createTablerMuiIcon(IconPalette, 'PaletteIcon');
export const PaymentsIcon = createTablerMuiIcon(IconCreditCard, 'PaymentsIcon');
export const PeopleIcon = createTablerMuiIcon(IconUsers, 'PeopleIcon');
export const PeopleOutlineOutlinedIcon = createTablerMuiIcon(
  IconUsersGroup,
  'PeopleOutlineOutlinedIcon',
);
export const PersonAddIcon = createTablerMuiIcon(IconUserPlus, 'PersonAddIcon');
export const PersonAddAlt1RoundedIcon = createTablerMuiIcon(IconUserPlus, 'PersonAddAlt1RoundedIcon');
export const PlaceIcon = createTablerMuiIcon(IconMapPin, 'PlaceIcon');
export const PlayCircleOutlineIcon = createTablerMuiIcon(IconPlayerPlay, 'PlayCircleOutlineIcon');
export const ReceiptIcon = createTablerMuiIcon(IconReceipt, 'ReceiptIcon');
export const ReceiptLongIcon = createTablerMuiIcon(IconReceipt2, 'ReceiptLongIcon');
export const RedoIcon = createTablerMuiIcon(IconArrowForwardUp, 'RedoIcon');
export const ReplayOutlinedIcon = createTablerMuiIcon(IconRotateClockwise, 'ReplayOutlinedIcon');
export const RocketLaunchIcon = createTablerMuiIcon(IconRocket, 'RocketLaunchIcon');
export const SaveIcon = createTablerMuiIcon(IconDeviceFloppy, 'SaveIcon');
export const ScheduleIcon = createTablerMuiIcon(IconCalendarTime, 'ScheduleIcon');
export const SearchIcon = createTablerMuiIcon(IconSearch, 'SearchIcon');
export const SellOutlinedIcon = createTablerMuiIcon(IconDiscount, 'SellOutlinedIcon');
export const SettingsIcon = createTablerMuiIcon(IconSettings, 'SettingsIcon');
export const SettingsBackupRestoreIcon = createTablerMuiIcon(
  IconRotateClockwise,
  'SettingsBackupRestoreIcon',
);
export const SettingsEthernetIcon = createTablerMuiIcon(IconPlugConnected, 'SettingsEthernetIcon');
export const SettingsSuggestIcon = createTablerMuiIcon(IconWand, 'SettingsSuggestIcon');
export const ShoppingBagOutlinedIcon = createTablerMuiIcon(IconShoppingBag, 'ShoppingBagOutlinedIcon');
export const ShoppingCartIcon = createTablerMuiIcon(IconShoppingCart, 'ShoppingCartIcon');
export const ShoppingCartCheckoutOutlinedIcon = createTablerMuiIcon(
  IconShoppingCart,
  'ShoppingCartCheckoutOutlinedIcon',
);
export const StarIcon = createTablerMuiIcon(IconStarFilled, 'StarIcon');
export const StarBorderIcon = createTablerMuiIcon(IconStar, 'StarBorderIcon');
export const StorefrontIcon = createTablerMuiIcon(IconBuildingStore, 'StorefrontIcon');
export const StorefrontRoundedIcon = createTablerMuiIcon(IconBuildingStore, 'StorefrontRoundedIcon');
export const StyleIcon = createTablerMuiIcon(IconColorSwatch, 'StyleIcon');
export const SyncIcon = createTablerMuiIcon(IconRefresh, 'SyncIcon');
export const TelegramIcon = createTablerMuiIcon(IconBrandTelegram, 'TelegramIcon');
export const TimeIcon = createTablerMuiIcon(IconClock, 'TimeIcon');
export const TikTokIcon = createTablerMuiIcon(IconBrandTiktok, 'TikTokIcon');
export const TrendingUpIcon = createTablerMuiIcon(IconTrendingUp, 'TrendingUpIcon');
export const TuneIcon = createTablerMuiIcon(IconAdjustmentsHorizontal, 'TuneIcon');
export const TwitterIcon = createTablerMuiIcon(IconBrandX, 'TwitterIcon');
export const UndoIcon = createTablerMuiIcon(IconArrowBackUp, 'UndoIcon');
export const UploadFileIcon = createTablerMuiIcon(IconUpload, 'UploadFileIcon');
export const VerifiedUserIcon = createTablerMuiIcon(IconShieldCheck, 'VerifiedUserIcon');
export const Visibility = createTablerMuiIcon(IconEye, 'Visibility');
export const VisibilityIcon = createTablerMuiIcon(IconEye, 'VisibilityIcon');
export const VisibilityOff = createTablerMuiIcon(IconEyeOff, 'VisibilityOff');
export const WarningAmberIcon = createTablerMuiIcon(IconAlertTriangle, 'WarningAmberIcon');
export const WebhookIcon = createTablerMuiIcon(IconWebhook, 'WebhookIcon');
export const SnapchatIcon = createTablerMuiIcon(IconBrandSnapchat, 'SnapchatIcon');
export const WhatsAppIcon = createTablerMuiIcon(IconBrandWhatsapp, 'WhatsAppIcon');
export const YouTubeIcon = createTablerMuiIcon(IconBrandYoutube, 'YouTubeIcon');
