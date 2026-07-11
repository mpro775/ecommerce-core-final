import { Box } from '@mui/material';
import { useTheme, type SxProps, type Theme } from '@mui/material/styles';
import { useId } from 'react';
import { ADMIN_TOKENS } from '../theme/tokens';

type KaleemPatternVariant = 'hero' | 'dashboard' | 'section' | 'card';
type KaleemPatternAnchor = 'start' | 'end' | 'center';

interface EcommerceCorePatternLayerProps {
  variant?: KaleemPatternVariant;
  opacity?: number;
  anchor?: KaleemPatternAnchor;
  sx?: SxProps<Theme>;
}

const variantSettings: Record<
  KaleemPatternVariant,
  { strokeWidth: number; nodeScale: number; showCards: boolean; viewBox: string }
> = {
  hero: { strokeWidth: 2.6, nodeScale: 1, showCards: true, viewBox: '0 0 1000 620' },
  dashboard: { strokeWidth: 1.8, nodeScale: 0.78, showCards: true, viewBox: '0 0 1000 620' },
  section: { strokeWidth: 2.1, nodeScale: 0.86, showCards: true, viewBox: '0 0 1000 620' },
  card: { strokeWidth: 1.5, nodeScale: 0.62, showCards: false, viewBox: '0 0 760 420' },
};

const signalNodes: Array<[number, number, number]> = [
  [184, 160, 8],
  [292, 138, 5],
  [432, 206, 7],
  [618, 108, 7],
  [756, 214, 5],
  [846, 300, 8],
  [626, 486, 6],
  [866, 558, 7],
];

function resolveTransform(anchor: KaleemPatternAnchor) {
  if (anchor === 'end') {
    return 'scaleX(-1)';
  }

  if (anchor === 'center') {
    return 'scale(1.08)';
  }

  return 'none';
}

export function EcommerceCorePatternLayer({
  variant = 'section',
  opacity = 1,
  anchor = 'start',
  sx,
}: EcommerceCorePatternLayerProps) {
  const theme = useTheme();
  const rawId = useId().replace(/:/g, '');
  const gradientId = `ecommerce_core-signal-${rawId}`;
  const settings = variantSettings[variant];
  const colors = ADMIN_TOKENS.pattern[theme.palette.mode];
  const isCard = variant === 'card';

  return (
    <Box
      aria-hidden="true"
      sx={[
        {
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          opacity,
          color: colors.patternInk,
          zIndex: 0,
          '&::before': {
            content: '""',
            position: 'absolute',
            width: isCard ? '54%' : { xs: 260, md: 420 },
            height: isCard ? '62%' : { xs: 260, md: 420 },
            insetBlockStart: isCard ? '-18%' : { xs: '-12%', md: '-18%' },
            insetInlineStart:
              anchor === 'end' ? 'auto' : anchor === 'center' ? '23%' : { xs: '-20%', md: '-8%' },
            insetInlineEnd: anchor === 'end' ? { xs: '-20%', md: '-8%' } : 'auto',
            borderRadius: '44% 56% 48% 52% / 46% 42% 58% 54%',
            background: `radial-gradient(circle at 48% 42%, ${colors.patternGlow} 0%, transparent 68%)`,
            filter: 'blur(1px)',
          },
          '& svg': {
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            transform: resolveTransform(anchor),
            transformOrigin: '50% 50%',
          },
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <svg viewBox={settings.viewBox} preserveAspectRatio="none" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="120" x2="880" y1="80" y2="520" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={colors.patternInk} stopOpacity="0.95" />
            <stop offset="0.58" stopColor={colors.patternNode} stopOpacity="0.76" />
            <stop offset="1" stopColor={colors.patternMuted} stopOpacity="0.42" />
          </linearGradient>
        </defs>

        <path
          d="M72 176 C176 72 344 82 430 178 C486 240 486 316 430 374 C372 434 264 438 198 390 L118 424 L148 346 C84 300 42 238 72 176 Z"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={settings.strokeWidth}
          strokeDasharray={variant === 'dashboard' ? '12 16' : 'none'}
        />
        <path
          d="M420 205 C548 176 646 198 716 270 C780 336 838 342 930 296"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeLinecap="round"
          strokeWidth={settings.strokeWidth}
        />
        <path
          d="M254 388 C330 480 458 514 598 486 C708 464 778 494 868 558"
          fill="none"
          stroke={colors.patternMuted}
          strokeLinecap="round"
          strokeWidth={Math.max(1, settings.strokeWidth - 0.6)}
          strokeDasharray="10 18"
        />
        <path
          d="M614 108 C676 122 724 160 754 212"
          fill="none"
          stroke={colors.patternNode}
          strokeLinecap="round"
          strokeWidth={Math.max(1, settings.strokeWidth - 0.4)}
        />

        {settings.showCards ? (
          <>
            <rect
              x="676"
              y="238"
              width="118"
              height="68"
              rx="18"
              fill={colors.patternMuted}
              opacity="0.58"
            />
            <rect
              x="810"
              y="214"
              width="96"
              height="52"
              rx="16"
              fill={colors.patternGlow}
              opacity="0.82"
            />
            <rect
              x="654"
              y="456"
              width="132"
              height="50"
              rx="18"
              fill={colors.patternGlow}
              opacity="0.64"
            />
          </>
        ) : null}

        {signalNodes.map(([cx, cy, r], index) => (
          <circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r={r * settings.nodeScale}
            fill={index % 3 === 0 ? colors.patternNode : colors.patternInk}
            opacity={index % 2 === 0 ? 0.82 : 0.58}
          />
        ))}
      </svg>
    </Box>
  );
}
