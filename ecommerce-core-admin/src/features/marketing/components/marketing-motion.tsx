import { Box, type BoxProps } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export const marketingFloat = keyframes`
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(0, -10px, 0); }
`;

export const marketingPulseLine = keyframes`
  0% { transform: translateX(36%); opacity: 0; }
  18% { opacity: 0.8; }
  78% { opacity: 0.8; }
  100% { transform: translateX(-36%); opacity: 0; }
`;

export const marketingMarquee = keyframes`
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
`;

export const marketingMascotDrift = keyframes`
  0%, 100% { transform: translate3d(0, 0, 18px) rotateX(1deg) rotateY(-10deg) rotateZ(-2deg); }
  35% { transform: translate3d(0, -10px, 34px) rotateX(-4deg) rotateY(10deg) rotateZ(2deg); }
  70% { transform: translate3d(0, 4px, 24px) rotateX(3deg) rotateY(-4deg) rotateZ(-1deg); }
`;

export const marketingMascotPulse = keyframes`
  0%, 100% { opacity: 0.34; transform: translateZ(-22px) scale(0.92); }
  50% { opacity: 0.62; transform: translateZ(-22px) scale(1.08); }
`;

export const marketingMascotOrbit = keyframes`
  0% { transform: translateZ(-28px) rotateX(62deg) rotate(0deg) scale(1); opacity: 0.4; }
  50% { transform: translateZ(-28px) rotateX(62deg) rotate(180deg) scale(1.04); opacity: 0.68; }
  100% { transform: translateZ(-28px) rotateX(62deg) rotate(360deg) scale(1); opacity: 0.4; }
`;

export function getReducedMotionSx() {
  return {
    '@media (prefers-reduced-motion: reduce)': {
      animation: 'none',
      scrollBehavior: 'auto',
      transition: 'none',
      transform: 'none',
    },
  };
}

interface RevealOnScrollProps extends Omit<BoxProps, 'children'> {
  children: ReactNode;
  delay?: number;
}

export function RevealOnScroll({ children, delay = 0, sx, ...props }: RevealOnScrollProps) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) {
      return undefined;
    }

    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 1.12) {
      setIsVisible(true);
      return undefined;
    }

    if (!('IntersectionObserver' in window)) {
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.14 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      ref={nodeRef}
      sx={[
        {
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translate3d(0, 0, 0)' : 'translate3d(0, 26px, 0)',
          transition: 'opacity 620ms ease, transform 620ms ease',
          transitionDelay: isVisible ? `${delay}ms` : '0ms',
          willChange: 'opacity, transform',
          '@media (prefers-reduced-motion: reduce)': {
            opacity: 1,
            transform: 'none',
            transition: 'none',
          },
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...props}
    >
      {children}
    </Box>
  );
}
