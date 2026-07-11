import { Box, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import Lottie, { type LottieRefCurrentProps } from 'lottie-react';
import { useEffect, useMemo, useRef } from 'react';

type AnimationData = Record<string, unknown>;

interface IconsaxAnimatedIconProps {
  animationData: AnimationData;
  playOnHover?: boolean;
  size?: number;
  sx?: SxProps<Theme>;
  title?: string;
  toneColor?: string;
}

const IconFrame = Box as any;

export function IconsaxAnimatedIcon({
  animationData,
  playOnHover = true,
  size = 24,
  sx,
  title,
  toneColor = 'primary.main',
}: IconsaxAnimatedIconProps) {
  const theme = useTheme();
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', { noSsr: true });
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const resolvedColor = resolveColor(theme, toneColor);

  const tintedAnimationData = useMemo(
    () => tintAnimationData(animationData, resolvedColor),
    [animationData, resolvedColor],
  );
  const fallbackPath = getFallbackPath(getAnimationName(animationData));

  useEffect(() => {
    lottieRef.current?.goToAndStop(0, true);
  }, [tintedAnimationData]);

  const playOnce = () => {
    if (!playOnHover || prefersReducedMotion) {
      return;
    }

    lottieRef.current?.stop();
    lottieRef.current?.play();
  };

  return (
    <IconFrame
      aria-hidden={title ? undefined : true}
      aria-label={title}
      onFocus={playOnce}
      onMouseEnter={playOnce}
      role={title ? 'img' : undefined}
      sx={[
        {
          display: 'inline-flex',
          flexShrink: 0,
          height: size,
          lineHeight: 0,
          overflow: 'hidden',
          position: 'relative',
          verticalAlign: 'middle',
          width: size,
          '& svg': {
            display: 'block',
          },
          '& .iconsax-fallback-mark': {
            transformBox: 'fill-box',
            transformOrigin: 'center',
            transition: prefersReducedMotion ? 'none' : 'transform 180ms ease',
          },
          '&:hover .iconsax-fallback-mark, &:focus .iconsax-fallback-mark': {
            transform: prefersReducedMotion ? undefined : 'translateY(-1px) scale(1.06)',
          },
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <Box
        aria-hidden
        component="svg"
        viewBox="0 0 64 64"
        sx={{ color: toneColor, display: 'block', height: '100%', width: '100%' }}
      >
        <Box
          component="path"
          className="iconsax-fallback-mark"
          d={fallbackPath}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4.5"
        />
      </Box>
      <Lottie
        animationData={tintedAnimationData}
        autoplay={false}
        loop={false}
        lottieRef={lottieRef}
        rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
        style={{
          height: '100%',
          inset: 0,
          pointerEvents: 'none',
          position: 'absolute',
          width: '100%',
        }}
      />
    </IconFrame>
  );
}

function tintAnimationData(animationData: AnimationData, color: [number, number, number]) {
  const clone = JSON.parse(JSON.stringify(animationData)) as AnimationData;
  tintNode(clone, color);
  return clone;
}

function getAnimationName(animationData: AnimationData) {
  return typeof animationData.nm === 'string' ? animationData.nm : '';
}

function getFallbackPath(name: string) {
  switch (name) {
    case 'revenue':
      return 'M32 14v36M22 24c0-5 5-8 11-8 5 0 9 2 11 5M42 40c0 5-5 8-11 8-5 0-9-2-11-5';
    case 'orders':
      return 'M18 18h28l-3 22H21L18 18ZM24 18c1-6 5-9 8-9s7 3 8 9M24 48h18';
    case 'average-order':
      return 'M16 44h32M20 36l8-8 7 6 11-14M46 20v12H34';
    case 'cancellation':
      return 'M20 20l24 24M44 20 20 44M32 52c11 0 20-9 20-20S43 12 32 12 12 21 12 32s9 20 20 20Z';
    case 'cart-recovery':
      return 'M16 18h5l5 22h19l4-15H25M28 50a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM43 50a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM20 14c7-5 17-4 23 2M44 16h-9v9';
    case 'sales':
      return 'M15 44h34M20 38V26M32 38V18M44 38V12M18 18l8 7 8-10 12 8';
    case 'payments':
      return 'M14 22h36v24H14V22ZM14 29h36M22 39h10M38 39h5';
    case 'shipping':
      return 'M12 22h28v22H12V22ZM40 30h8l5 7v7H40V30ZM22 48a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM46 48a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z';
    case 'discount':
      return 'M18 18h28v28H18V18ZM25 39l14-14M26 27h.5M38 37h.5';
    case 'inventory':
      return 'M16 22 32 13l16 9-16 9-16-9ZM16 22v20l16 9 16-9V22M32 31v20';
    case 'stock-alert':
      return 'M32 12 52 48H12L32 12ZM32 25v11M32 43h.5';
    case 'customers':
      return 'M25 29a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM12 49c2-8 8-13 16-13s14 5 16 13M42 31a6 6 0 1 0-1-12M48 47c-1-5-4-9-9-11';
    case 'conversion':
      return 'M14 17h36L36 33v12l-8 4V33L14 17Z';
    case 'growth':
      return 'M14 44h36M18 38l9-10 8 7 13-18M48 17v12H36';
    case 'store':
      return 'M16 28h32M19 28v22h26V28M20 14h24l5 14H15l5-14ZM28 50V38h8v12';
    case 'dashboard':
    default:
      return 'M15 17h14v14H15V17ZM35 17h14v14H35V17ZM15 37h14v10H15V37ZM35 37h14v10H35V37Z';
  }
}

function tintNode(value: unknown, color: [number, number, number]) {
  if (!value || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => tintNode(item, color));
    return;
  }

  const node = value as Record<string, unknown>;
  const colorNode = node.c as { k?: unknown } | undefined;
  if (colorNode && Array.isArray(colorNode.k) && colorNode.k.length >= 3) {
    colorNode.k = [...color, colorNode.k.length > 3 ? colorNode.k[3] : 1];
  }

  Object.values(node).forEach((item) => tintNode(item, color));
}

function resolveColor(theme: Theme, toneColor: string): [number, number, number] {
  const paletteColor = resolvePaletteColor(theme, toneColor);
  return (
    parseColor(paletteColor ?? toneColor) ?? parseColor(theme.palette.primary.main) ?? [0, 0, 0]
  );
}

function resolvePaletteColor(theme: Theme, toneColor: string) {
  const [paletteKey, colorKey] = toneColor.split('.');
  if (!paletteKey || !colorKey) {
    return null;
  }

  const paletteGroup = theme.palette[paletteKey as keyof Theme['palette']] as unknown;
  if (!paletteGroup || typeof paletteGroup !== 'object') {
    return null;
  }

  const value = (paletteGroup as Record<string, unknown>)[colorKey];
  return typeof value === 'string' ? value : null;
}

function parseColor(color: string): [number, number, number] | null {
  const trimmedColor = color.trim();

  if (trimmedColor.startsWith('#')) {
    return parseHexColor(trimmedColor);
  }

  const rgbMatch = trimmedColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    return [Number(rgbMatch[1]) / 255, Number(rgbMatch[2]) / 255, Number(rgbMatch[3]) / 255];
  }

  return null;
}

function parseHexColor(color: string): [number, number, number] | null {
  const normalizedColor =
    color.length === 4
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color;

  if (!/^#[0-9a-f]{6}$/i.test(normalizedColor)) {
    return null;
  }

  return [
    Number.parseInt(normalizedColor.slice(1, 3), 16) / 255,
    Number.parseInt(normalizedColor.slice(3, 5), 16) / 255,
    Number.parseInt(normalizedColor.slice(5, 7), 16) / 255,
  ];
}
