import { Box, IconButton, Tooltip, Typography, alpha, useTheme } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CancelOutlinedIcon, VisibilityIcon } from '../../../components/icons';
import { useMarketingLocale } from '../marketing-locale-context';
import { MarketingMascot3D } from './marketing-mascot-3d';
import {
  marketingMascotSceneById,
  marketingMascotScenes,
  type MarketingMascotPlacement,
  type MarketingMascotScene,
  type MarketingMascotSceneId,
} from './marketing-mascot-scenes';

const SNAP_SELECTOR = '[data-marketing-snap-scene="true"]';
const NAV_OFFSET = 96;
const SNAP_DURATION_MS = 820;
const STORAGE_KEY = 'ecommerce_core.marketing.mascotJourney.hidden.v1';

interface ViewportSize {
  width: number;
  height: number;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getSceneElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(SNAP_SELECTOR));
}

function getSceneId(element: HTMLElement): MarketingMascotSceneId | null {
  const id = element.dataset.mascotScene as MarketingMascotSceneId | undefined;
  return id && marketingMascotSceneById[id] ? id : null;
}

function resolveActiveIndex(elements: HTMLElement[]): number {
  if (elements.length === 0) {
    return -1;
  }

  const readingLine = NAV_OFFSET + window.innerHeight * 0.22;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  elements.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    const anchor = rect.top + Math.min(rect.height * 0.3, 260);
    const distance = Math.abs(anchor - readingLine);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function canUseNativeScroll(element: HTMLElement, direction: number): boolean {
  const rect = element.getBoundingClientRect();
  const tallSection = rect.height > window.innerHeight * 1.12;
  if (!tallSection) {
    return false;
  }

  if (direction > 0) {
    return rect.bottom > window.innerHeight + 42;
  }

  return rect.top < NAV_OFFSET - 42;
}

function resolvePlacement(scene: MarketingMascotScene, viewportWidth: number): MarketingMascotPlacement {
  if (viewportWidth < 600) {
    return scene.mobile;
  }

  if (viewportWidth < 1024) {
    return scene.tablet;
  }

  return scene.desktop;
}

export function MarketingMascotJourney() {
  const theme = useTheme();
  const { content, direction } = useMarketingLocale();
  const isAnimatingRef = useRef(false);
  const lastSnapAtRef = useRef(0);
  const scrollFrameRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<MarketingMascotSceneId>('hero');
  const [isHidden, setIsHidden] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [viewport, setViewport] = useState<ViewportSize>(() => ({
    width: window.innerWidth || 1200,
    height: window.innerHeight || 900,
  }));
  const [isMobileBubbleExpanded, setIsMobileBubbleExpanded] = useState(false);
  const activeScene = useMemo(
    () => marketingMascotSceneById[activeSceneId] ?? marketingMascotScenes[0],
    [activeSceneId],
  );
  const activeSceneText = useMemo(
    () => content.mascot.scenes.find((scene) => scene.id === activeSceneId),
    [activeSceneId, content.mascot.scenes],
  );
  const activePlacement = resolvePlacement(activeScene, viewport.width);
  const isMobileViewport = viewport.width < 600;
  const shouldPlaceMobileBubbleBeforeMascot = isMobileViewport && activePlacement.x > 0.5;
  const shouldShowBubble = activePlacement.bubble !== 'none' || isMobileViewport;
  const mascotSize = viewport.width < 600 ? 96 : viewport.width < 1024 ? 122 : 154;
  const x = clamp(activePlacement.x * viewport.width - mascotSize / 2, 10, viewport.width - mascotSize - 10);
  const y = clamp(activePlacement.y * viewport.height - mascotSize / 2, 94, viewport.height - mascotSize - 24);
  const laneTransform = `translate3d(${Math.round(x)}px, 0, 0)`;
  const motionTransform = `translate3d(0, ${Math.round(y)}px, 0) rotate(${activePlacement.rotate}deg) scale(${activePlacement.scale})`;
  const isDark = theme.palette.mode === 'dark';

  function hideMascot(): void {
    setIsHidden(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      return;
    }
  }

  function restoreMascot(): void {
    setIsHidden(false);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      return;
    }
  }

  useEffect(() => {
    function handleResize(): void {
      setViewport({
        width: window.innerWidth || 1200,
        height: window.innerHeight || 900,
      });
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setIsMobileBubbleExpanded(false);
  }, [activeSceneId]);

  useEffect(() => {
    function updateActiveScene(): void {
      window.cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = window.requestAnimationFrame(() => {
        const elements = getSceneElements();
        const activeElement = elements[resolveActiveIndex(elements)];
        const nextSceneId = activeElement ? getSceneId(activeElement) : null;
        if (nextSceneId) {
          setActiveSceneId((currentSceneId) => (currentSceneId === nextSceneId ? currentSceneId : nextSceneId));
        }
      });
    }

    updateActiveScene();
    window.addEventListener('scroll', updateActiveScene, { passive: true });
    window.addEventListener('resize', updateActiveScene);

    return () => {
      window.cancelAnimationFrame(scrollFrameRef.current);
      window.removeEventListener('scroll', updateActiveScene);
      window.removeEventListener('resize', updateActiveScene);
    };
  }, []);

  useEffect(() => {
    if (prefersReducedMotion()) {
      return undefined;
    }

    function snapToScene(index: number, elements: HTMLElement[]): void {
      const target = elements[index];
      if (!target || isAnimatingRef.current) {
        return;
      }

      const sceneId = getSceneId(target);
      isAnimatingRef.current = true;
      if (sceneId) {
        setActiveSceneId(sceneId);
      }

      window.scrollTo({
        top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - NAV_OFFSET + 6),
        behavior: 'smooth',
      });

      window.setTimeout(() => {
        isAnimatingRef.current = false;
      }, SNAP_DURATION_MS);
    }

    function handleWheel(event: WheelEvent): void {
      if (Math.abs(event.deltaY) < 22 || Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.2) {
        return;
      }

      const elements = getSceneElements();
      const activeIndex = resolveActiveIndex(elements);
      const activeElement = elements[activeIndex];
      if (!activeElement) {
        return;
      }

      const direction = event.deltaY > 0 ? 1 : -1;
      if (canUseNativeScroll(activeElement, direction)) {
        return;
      }

      const now = Date.now();
      if (now - lastSnapAtRef.current < 760 || isAnimatingRef.current) {
        event.preventDefault();
        return;
      }

      const nextIndex = clamp(activeIndex + direction, 0, elements.length - 1);
      if (nextIndex === activeIndex) {
        return;
      }

      event.preventDefault();
      lastSnapAtRef.current = now;
      snapToScene(nextIndex, elements);
    }

    function handleTouchStart(event: TouchEvent): void {
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    }

    function handleTouchEnd(event: TouchEvent): void {
      const startY = touchStartYRef.current;
      const endY = event.changedTouches[0]?.clientY;
      touchStartYRef.current = null;
      if (startY === null || endY === undefined) {
        return;
      }

      const delta = startY - endY;
      if (Math.abs(delta) < 64) {
        return;
      }

      const elements = getSceneElements();
      const activeIndex = resolveActiveIndex(elements);
      const activeElement = elements[activeIndex];
      if (!activeElement) {
        return;
      }

      const direction = delta > 0 ? 1 : -1;
      if (canUseNativeScroll(activeElement, direction) || isAnimatingRef.current) {
        return;
      }

      const nextIndex = clamp(activeIndex + direction, 0, elements.length - 1);
      if (nextIndex !== activeIndex) {
        snapToScene(nextIndex, elements);
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return (
    <Box
      dir="ltr"
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 35,
        pointerEvents: 'none',
        overflow: 'hidden',
        direction: 'ltr',
      }}
    >
      {isHidden ? (
        <Tooltip title={content.mascot.showTooltip} placement={direction === 'rtl' ? 'right' : 'left'}>
          <IconButton
            aria-label={content.mascot.showAria}
            data-mascot-action="restore"
            onClick={restoreMascot}
            sx={{
              position: 'fixed',
              insetInlineStart: { xs: 16, md: 24 },
              bottom: { xs: 78, md: 96 },
              zIndex: 1,
              width: { xs: 42, md: 48 },
              height: { xs: 42, md: 48 },
              pointerEvents: 'auto',
              border: '1px solid',
              borderColor: isDark ? alpha(theme.palette.common.white, 0.14) : alpha(theme.palette.primary.main, 0.16),
              bgcolor: isDark ? alpha('#17181D', 0.9) : alpha(theme.palette.background.paper, 0.9),
              color: 'primary.main',
              boxShadow: isDark ? '0 16px 34px rgba(0,0,0,0.28)' : '0 16px 34px rgba(80,46,145,0.16)',
              backdropFilter: 'blur(18px)',
              '&:hover': {
                bgcolor: isDark ? alpha(theme.palette.common.white, 0.1) : alpha(theme.palette.primary.light, 0.32),
              },
            }}
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
      <Box
        dir="ltr"
        style={{
          transform: laneTransform,
        }}
        sx={{
          position: 'absolute',
          top: 0,
          insetInlineStart: 0,
          width: { xs: 96, sm: 122, lg: 154 },
          height: { xs: 112, sm: 142, lg: 178 },
          transformOrigin: '50% 72%',
          willChange: 'transform',
          transformStyle: 'preserve-3d',
          transition: 'none',
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'none',
            willChange: 'auto',
          },
        }}
      >
        <Box
          style={{
            transform: motionTransform,
          }}
          sx={{
            position: 'relative',
            width: '100%',
            height: '100%',
            filter: isDark ? 'drop-shadow(0 22px 30px rgba(0,0,0,0.34))' : 'drop-shadow(0 22px 30px rgba(80,46,145,0.18))',
            transformOrigin: '50% 72%',
            transformStyle: 'preserve-3d',
            transition: 'transform 680ms cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: 'transform',
            '@media (prefers-reduced-motion: reduce)': {
              transition: 'none',
              willChange: 'auto',
            },
          }}
        >
          <Box
            dir="rtl"
            role={isMobileViewport ? 'button' : undefined}
            tabIndex={isMobileViewport ? 0 : undefined}
            aria-expanded={isMobileViewport ? isMobileBubbleExpanded : undefined}
            onClick={(event) => {
              if (!isMobileViewport) {
                return;
              }
              event.stopPropagation();
              setIsMobileBubbleExpanded((current) => !current);
            }}
            onKeyDown={(event) => {
              if (!isMobileViewport || (event.key !== 'Enter' && event.key !== ' ')) {
                return;
              }
              event.preventDefault();
              setIsMobileBubbleExpanded((current) => !current);
            }}
            sx={{
              position: 'absolute',
              insetInlineStart: {
                xs: shouldPlaceMobileBubbleBeforeMascot ? 'auto' : 'calc(100% + 8px)',
                sm:
                  activePlacement.bubble === 'end'
                    ? '82%'
                    : activePlacement.bubble === 'start'
                      ? 'auto'
                      : '50%',
              },
              insetInlineEnd: {
                xs: shouldPlaceMobileBubbleBeforeMascot ? 'calc(100% + 8px)' : 'auto',
                sm: activePlacement.bubble === 'start' ? '82%' : 'auto',
              },
              top: activePlacement.bubble === 'top' ? { xs: -10, sm: -46, lg: -54 } : { xs: 10, sm: 14, lg: 22 },
              display: {
                xs: 'block',
                sm: shouldShowBubble ? 'block' : 'none',
              },
              width: {
                xs: isMobileBubbleExpanded ? 'min(220px, calc(100vw - 136px))' : 96,
                sm: 244,
                lg: 292,
              },
              minHeight: { xs: isMobileBubbleExpanded ? 0 : 34, sm: 0 },
              p: { xs: isMobileBubbleExpanded ? 1.1 : 0.75, sm: 1.25, lg: 1.45 },
              borderRadius: 1.8,
              border: '1px solid',
              borderColor: isDark ? alpha(theme.palette.common.white, 0.12) : alpha(theme.palette.primary.main, 0.16),
              bgcolor: isDark ? alpha('#17181D', 0.84) : alpha(theme.palette.background.paper, 0.88),
              color: 'text.primary',
              direction,
              textAlign: direction === 'rtl' ? 'right' : 'left',
              unicodeBidi: 'plaintext',
              boxShadow: isDark ? '0 18px 36px rgba(0,0,0,0.26)' : '0 18px 36px rgba(80,46,145,0.12)',
              backdropFilter: 'blur(18px)',
              cursor: { xs: 'pointer', sm: 'default' },
              pointerEvents: 'auto',
              transform:
                activePlacement.bubble === 'top'
                  ? { xs: 'translateX(-50%) translateY(-100%)', sm: 'translateX(-50%) translateY(-100%)' }
                  : activePlacement.bubble === 'start'
                    ? { xs: 'translateX(0)', sm: 'translateX(0)' }
                    : { xs: 'translateX(0)', sm: 'translateX(0)' },
              transition: 'opacity 240ms ease, transform 240ms ease, width 180ms ease, padding 180ms ease',
              '@media (prefers-reduced-motion: reduce)': {
                transition: 'none',
              },
            }}
          >
            <Typography
              variant="caption"
              dir={direction}
              sx={{
                display: 'block',
                color: 'primary.main',
                fontWeight: 900,
                mb: { xs: isMobileBubbleExpanded ? 0.45 : 0, sm: 0.5 },
                lineHeight: 1.35,
                textAlign: direction === 'rtl' ? 'right' : 'left',
                direction,
                unicodeBidi: 'plaintext',
                whiteSpace: { xs: isMobileBubbleExpanded ? 'normal' : 'nowrap', sm: 'normal' },
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {activeSceneText?.label ?? activeScene.label}
            </Typography>
            <Typography
              variant="body2"
              dir={direction}
              sx={{
                display: { xs: isMobileBubbleExpanded ? 'block' : 'none', sm: 'block' },
                fontWeight: 800,
                lineHeight: 1.55,
                textAlign: direction === 'rtl' ? 'right' : 'left',
                direction,
                unicodeBidi: 'plaintext',
              }}
            >
              {activeSceneText?.message ?? activeScene.message}
            </Typography>
          </Box>

          <Box
            sx={{
              position: 'relative',
              width: '100%',
              height: '100%',
              transformStyle: 'preserve-3d',
            }}
          >
            <MarketingMascot3D
              ariaLabel={direction === 'rtl' ? 'مساعد النظام ثلاثي الأبعاد' : 'Ecommerce Core 3D guide'}
              isDarkMode={isDark}
              pose={activeScene.pose}
            />
          </Box>
          <Tooltip title={content.mascot.hideTooltip} placement={direction === 'rtl' ? 'left' : 'right'}>
            <IconButton
              aria-label={content.mascot.hideAria}
              data-mascot-action="hide"
              onClick={hideMascot}
              sx={{
                position: 'absolute',
                top: { xs: -4, md: -8 },
                insetInlineEnd: { xs: -5, md: -9 },
                zIndex: 3,
                width: { xs: 24, md: 28 },
                height: { xs: 24, md: 28 },
                pointerEvents: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: alpha(theme.palette.background.paper, 0.92),
                color: 'text.secondary',
                boxShadow: '0 8px 18px rgba(15,23,42,0.12)',
                '&:hover': {
                  bgcolor: 'background.paper',
                  color: 'primary.main',
                },
              }}
            >
              <CancelOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      )}
    </Box>
  );
}
