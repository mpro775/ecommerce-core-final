import { CancelOutlinedIcon } from '../../../components/icons';
import { Box, IconButton, Typography, alpha, useTheme } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { MarketingMascot3D, type MascotMood } from './marketing-mascot-3d';

const STORAGE_KEY = 'ecommerce_core.marketing.floatingMascot.dismissed.v2';

const mascotMessages = [
  {
    id: 'hero',
    label: 'البداية',
    shortMessage: 'نبدأ من الوعد: متجر واضح وجاهز للنمو.',
    message: 'أنا معك من أول الصفحة: هنا نشرح الوعد الأساسي وكيف يتحول متجرك إلى نظام تشغيل واضح.',
    selector: '#hero',
  },
  {
    id: 'showcase',
    label: 'المنتج',
    shortMessage: 'هنا تشوف المنتج وهو يعمل أمامك.',
    message: 'في هذا الجزء تشوف المنتج كأنه يعمل أمامك: متجر، طلبات، ثيمات، ودومين في تجربة واحدة.',
    selector: '#showcase',
  },
  {
    id: 'features',
    label: 'المميزات',
    shortMessage: 'أدوات التشغيل اليومي في مكان واحد.',
    message: 'هنا نمر على الأدوات التي يحتاجها التاجر يومياً: منتجات، طلبات، شحن، عروض، ونمو.',
    selector: '#features',
  },
  {
    id: 'themes',
    label: 'الثيمات',
    shortMessage: 'غيّر هوية المتجر بصرياً وبسرعة.',
    message: 'هذا القسم يوضح كيف يمكن لهوية المتجر أن تتغير بصرياً بدون تعقيد تقني.',
    selector: '#themes',
  },
  {
    id: 'domain',
    label: 'الدومين',
    shortMessage: 'اسم علامتك يظهر بدومين آمن.',
    message: 'هنا نوضح كيف يصبح متجرك باسم علامتك مع دومين آمن وشهادة حماية واضحة.',
    selector: '#domain',
  },
  {
    id: 'how-it-works',
    label: 'الخطوات',
    shortMessage: 'من إنشاء الحساب إلى متجر منشور.',
    message: 'هذا المسار يشرح الرحلة من إنشاء الحساب إلى متجر منشور وجاهز للبيع.',
    selector: '#how-it-works',
  },
  {
    id: 'pricing',
    label: 'الأسعار',
    shortMessage: 'ابدأ صغيراً ووسّع الخطة عند النمو.',
    message: 'هنا تختار البداية المناسبة ثم توسع الخطة عندما يكبر نشاطك.',
    selector: '#pricing',
  },
  {
    id: 'faq',
    label: 'الأسئلة',
    shortMessage: 'هنا نغلق آخر علامات التردد.',
    message: 'في النهاية نجيب على الاعتراضات والأسئلة قبل اتخاذ قرار البدء.',
    selector: '#faq',
  },
] as const;

type MascotMessageId = (typeof mascotMessages)[number]['id'];
type MascotSide = 'right' | 'left';

interface MascotRouteStop {
  id: MascotMessageId;
  inlineProgress: number;
  blockProgress: number;
  side: MascotSide;
  mood: MascotMood;
  tilt: number;
}

interface MascotPose {
  inlineOffset: number;
  blockOffset: number;
  side: MascotSide;
  mood: MascotMood;
  tilt: number;
  progress: number;
}

const mascotRoute: MascotRouteStop[] = [
  { id: 'hero', inlineProgress: 0.03, blockProgress: 0.18, side: 'right', mood: 'welcome', tilt: -4 },
  { id: 'showcase', inlineProgress: 0.34, blockProgress: 0.34, side: 'right', mood: 'focus', tilt: 3 },
  { id: 'features', inlineProgress: 0.78, blockProgress: 0.5, side: 'left', mood: 'spark', tilt: -3 },
  { id: 'themes', inlineProgress: 0.5, blockProgress: 0.63, side: 'left', mood: 'spark', tilt: 4 },
  { id: 'domain', inlineProgress: 0.1, blockProgress: 0.43, side: 'right', mood: 'focus', tilt: -2 },
  { id: 'how-it-works', inlineProgress: 0.7, blockProgress: 0.57, side: 'left', mood: 'steady', tilt: 2 },
  { id: 'pricing', inlineProgress: 0.46, blockProgress: 0.71, side: 'left', mood: 'spark', tilt: -4 },
  { id: 'faq', inlineProgress: 0.06, blockProgress: 0.55, side: 'right', mood: 'steady', tilt: 1 },
];

const routeById = mascotRoute.reduce<Record<MascotMessageId, MascotRouteStop>>(
  (items, stop) => ({ ...items, [stop.id]: stop }),
  {} as Record<MascotMessageId, MascotRouteStop>,
);

const initialPose: MascotPose = {
  inlineOffset: 24,
  blockOffset: 118,
  side: 'right',
  mood: 'welcome',
  tilt: -4,
  progress: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveActiveSection(viewportHeight: number): MascotMessageId {
  const readingLine = viewportHeight * 0.42;
  let bestId: MascotMessageId = 'hero';
  let bestDistance = Number.POSITIVE_INFINITY;

  mascotMessages.forEach((item) => {
    const element = document.querySelector(item.selector);
    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > viewportHeight) {
      return;
    }

    const sectionAnchor = rect.top + Math.min(rect.height * 0.3, 260);
    const distance = Math.abs(sectionAnchor - readingLine);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = item.id;
    }
  });

  return bestId;
}

function getRouteProgress(id: MascotMessageId): number {
  const index = mascotRoute.findIndex((item) => item.id === id);
  return index <= 0 ? 0 : index / Math.max(mascotRoute.length - 1, 1);
}

function createMascotPose(id: MascotMessageId, isExpanded: boolean, isFooterVisible: boolean): MascotPose {
  const stop = routeById[id] ?? mascotRoute[0];
  const viewportHeight = window.innerHeight || 900;
  const viewportWidth = window.innerWidth || 1024;
  const isMobile = viewportWidth < 600;
  const edgeOffset = isMobile ? 10 : 24;
  const mascotSize = isMobile ? (isExpanded ? 82 : 64) : 132;
  const bubbleWidth = isMobile ? (isExpanded ? 222 : 92) : isExpanded ? 336 : 264;
  const groupWidth = mascotSize + bubbleWidth + (isMobile ? 8 : 12);
  const maxInlineTravel = Math.max(0, viewportWidth - groupWidth - edgeOffset * 2);
  const progress = getRouteProgress(id);
  const sideWave = Math.sin(progress * Math.PI * 3.5 + 0.65) * (isMobile ? 5 : 18);
  const bob = Math.sin(progress * Math.PI * 4.25) * (isMobile ? 4 : 12);
  const maxBlock = Math.max(90, viewportHeight - (isMobile ? 182 : 236));
  const blockProgress = isMobile ? (isExpanded ? 0.56 : 0.68) : stop.blockProgress;
  const footerBlock = viewportHeight - (isMobile ? 156 : 214);
  const blockOffset = isFooterVisible
    ? footerBlock
    : clamp(viewportHeight * blockProgress + bob, isMobile ? 86 : 108, maxBlock);
  const inlineProgress = isMobile ? 0.96 : stop.inlineProgress;
  const inlineOffset = clamp(edgeOffset + maxInlineTravel * inlineProgress + sideWave, edgeOffset, edgeOffset + maxInlineTravel);

  return {
    inlineOffset: Math.round(inlineOffset),
    blockOffset: Math.round(blockOffset),
    side: isMobile ? 'left' : stop.side,
    mood: stop.mood,
    tilt: stop.tilt,
    progress,
  };
}

export function MarketingFloatingMascot() {
  const theme = useTheme();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFooterVisible, setIsFooterVisible] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState<MascotMessageId>('hero');
  const [pose, setPose] = useState<MascotPose>(initialPose);

  useEffect(() => {
    try {
      setIsDismissed(window.sessionStorage.getItem(STORAGE_KEY) === 'true');
    } catch {
      setIsDismissed(false);
    }
  }, []);

  useEffect(() => {
    if (isDismissed) {
      return undefined;
    }

    let frameId = 0;

    function updateMascotPose(): void {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const viewportHeight = window.innerHeight || 900;
        const nextActiveId = resolveActiveSection(viewportHeight);
        setActiveMessageId(nextActiveId);
        setPose(createMascotPose(nextActiveId, isExpanded, isFooterVisible));
      });
    }

    updateMascotPose();
    window.addEventListener('scroll', updateMascotPose, { passive: true });
    window.addEventListener('resize', updateMascotPose);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', updateMascotPose);
      window.removeEventListener('resize', updateMascotPose);
    };
  }, [isDismissed, isExpanded, isFooterVisible]);

  useEffect(() => {
    if (isDismissed || !('IntersectionObserver' in window)) {
      return undefined;
    }

    const footer = document.querySelector('footer');
    if (!footer) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsFooterVisible(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.08 },
    );

    observer.observe(footer);
    return () => observer.disconnect();
  }, [isDismissed]);

  const activeMessage = useMemo(
    () => mascotMessages.find((item) => item.id === activeMessageId) ?? mascotMessages[0],
    [activeMessageId],
  );
  const bubbleBorderColor =
    theme.palette.mode === 'dark'
      ? alpha(theme.palette.common.white, 0.12)
      : alpha(theme.palette.primary.main, 0.14);
  const bubbleBackground =
    theme.palette.mode === 'dark'
      ? alpha('#17181D', 0.92)
      : alpha(theme.palette.background.paper, 0.92);
  const isNearRight = pose.side === 'right';
  const compactMobileLabel = !isExpanded ? activeMessage.shortMessage : activeMessage.message;

  function dismissMascot(): void {
    setIsDismissed(true);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      return;
    }
  }

  if (isDismissed) {
    return null;
  }

  return (
    <Box
      aria-label="مساعد النظام العائم"
      dir="rtl"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      onClick={() => setIsExpanded((current) => !current)}
      style={{
        insetInlineStart: 0,
        transform: `translate3d(${-pose.inlineOffset}px, ${pose.blockOffset}px, 0)`,
      }}
      sx={{
        position: 'fixed',
        insetBlockStart: 0,
        zIndex: 42,
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 0.8, sm: 1.15 },
        maxWidth: { xs: 'calc(100vw - 20px)', sm: 500 },
        pointerEvents: 'auto',
        perspective: '900px',
        transformStyle: 'preserve-3d',
        transition: 'transform 640ms cubic-bezier(0.22, 1, 0.36, 1)',
        willChange: 'transform',
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
        },
      }}
    >
      <Box
        sx={{
          order: isNearRight ? 1 : 0,
          display: { xs: isFooterVisible && !isExpanded ? 'none' : 'block', sm: 'block' },
          maxWidth: { xs: isExpanded ? 222 : 92, sm: isExpanded ? 336 : 264 },
          minWidth: { xs: isExpanded ? 214 : 82, sm: 242 },
          p: { xs: isExpanded ? 1.1 : 0.7, sm: 1.35 },
          borderRadius: isNearRight ? '20px 20px 20px 6px' : '20px 20px 6px 20px',
          border: '1px solid',
          borderColor: bubbleBorderColor,
          bgcolor: bubbleBackground,
          color: 'text.primary',
          boxShadow:
            theme.palette.mode === 'dark'
              ? '0 18px 36px rgba(0,0,0,0.26)'
              : '0 18px 36px rgba(80,46,145,0.12)',
          backdropFilter: 'blur(18px)',
          transform: isExpanded
            ? `translate3d(0, -5px, 46px) rotateY(${isNearRight ? 4 : -4}deg)`
            : `translate3d(0, 0, 22px) rotateY(${isNearRight ? 2 : -2}deg)`,
          transition: 'max-width 220ms ease, min-width 220ms ease, transform 220ms ease, opacity 180ms ease',
          cursor: 'pointer',
          position: 'relative',
          direction: 'rtl',
          textAlign: 'start',
          isolation: 'isolate',
          '@media (prefers-reduced-motion: reduce)': {
            transform: 'none',
            transition: 'none',
          },
        }}
      >
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            color: 'primary.main',
            fontWeight: 900,
            mb: { xs: isExpanded ? 0.45 : 0, sm: 0.45 },
            fontSize: { xs: '0.66rem', sm: '0.75rem' },
          }}
        >
          {activeMessage.label}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 800,
            lineHeight: { xs: 1.45, sm: 1.55 },
            fontSize: { xs: isExpanded ? '0.78rem' : '0.7rem', sm: '0.875rem' },
            display: { xs: isExpanded ? '-webkit-box' : 'none', sm: '-webkit-box' },
            WebkitLineClamp: { xs: isExpanded ? 5 : 2, sm: isExpanded ? 'unset' : 2 },
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {compactMobileLabel}
        </Typography>
      </Box>

      <Box
        sx={{
          order: isNearRight ? 0 : 1,
          position: 'relative',
          width: { xs: isExpanded ? 82 : 64, md: 132 },
          height: { xs: isExpanded ? 82 : 64, md: 132 },
          flexShrink: 0,
          cursor: 'pointer',
          transformStyle: 'preserve-3d',
          transform: `rotateZ(${pose.tilt}deg)`,
          transition: 'transform 420ms ease',
          '@media (prefers-reduced-motion: reduce)': {
            transform: 'none',
            transition: 'none',
          },
        }}
      >
        <MarketingMascot3D
          isDarkMode={theme.palette.mode === 'dark'}
          mood={pose.mood}
          sx={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: '100%',
            transformStyle: 'preserve-3d',
            filter: 'none',
            transformOrigin: '50% 80%',
          }}
        />
        <IconButton
          aria-label="إخفاء مساعد النظام"
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            dismissMascot();
          }}
          sx={{
            position: 'absolute',
            top: { xs: -3, md: -6 },
            insetInlineEnd: { xs: -3, md: -6 },
            zIndex: 2,
            width: { xs: 22, md: 26 },
            height: { xs: 22, md: 26 },
            bgcolor: alpha(theme.palette.background.paper, 0.92),
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 8px 18px rgba(15,23,42,0.12)',
            '&:hover': {
              bgcolor: 'background.paper',
            },
          }}
        >
          <CancelOutlinedIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Box>
    </Box>
  );
}
