import { Box, type SxProps, type Theme } from '@mui/material';

export type MascotPose = 'welcome' | 'focus' | 'spark' | 'steady' | 'think' | 'point' | 'celebrate' | 'guide' | 'assure';
export type MascotMood = MascotPose;

interface MarketingMascot3DProps {
  ariaLabel?: string;
  isDarkMode: boolean;
  mood?: MascotMood;
  pose?: MascotPose;
  sx?: SxProps<Theme>;
}

export function MarketingMascot3D({ ariaLabel = 'Ecommerce Core 3D guide', isDarkMode, mood = 'steady', pose, sx }: MarketingMascot3DProps) {
  const outlineColor = isDarkMode ? '#25105f' : '#321078';
  const activePose = pose ?? mood;

  return (
    <Box
      component="svg"
      role="img"
      aria-label={ariaLabel}
      viewBox="0 0 220 260"
      className={`ecommerce_core-mascot ecommerce_core-mascot--${activePose}`}
      sx={[
        {
          display: 'block',
          width: '100%',
          height: '100%',
          overflow: 'visible',
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <defs>
        <radialGradient id="kaleemPurple" cx="36%" cy="24%" r="82%">
          <stop offset="0%" stopColor="#9f7bff" />
          <stop offset="45%" stopColor="#642dde" />
          <stop offset="100%" stopColor="#321078" />
        </radialGradient>
        <radialGradient id="kaleemPurpleDark" cx="34%" cy="22%" r="86%">
          <stop offset="0%" stopColor="#7d58f4" />
          <stop offset="58%" stopColor="#4218a0" />
          <stop offset="100%" stopColor="#1d0a54" />
        </radialGradient>
        <radialGradient id="kaleemWhite" cx="34%" cy="20%" r="82%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="68%" stopColor="#f8f6ff" />
          <stop offset="100%" stopColor="#d8d1f6" />
        </radialGradient>
        <radialGradient id="kaleemCyan" cx="35%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#7ee8ff" />
          <stop offset="70%" stopColor="#0eb8f2" />
          <stop offset="100%" stopColor="#0874c8" />
        </radialGradient>
        <filter id="kaleemInnerLift" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="-3" dy="-3" stdDeviation="2.2" floodColor="#ffffff" floodOpacity="0.38" />
          <feDropShadow dx="4" dy="6" stdDeviation="3" floodColor="#22075a" floodOpacity="0.24" />
        </filter>
        <linearGradient id="kaleemMouth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#210756" />
          <stop offset="100%" stopColor="#b13bd4" />
        </linearGradient>
      </defs>

      <style>
        {`
          .ecommerce_core-shadow {
            transform-origin: 110px 238px;
            animation: kaleemShadowPulse 3.8s ease-in-out infinite;
          }
          .ecommerce_core-float {
            transform-origin: 110px 132px;
            animation: kaleemFloat 4.8s ease-in-out infinite;
          }
          .ecommerce_core-hand {
            transform-origin: 46px 150px;
            animation: kaleemWave 3.1s ease-in-out infinite;
          }
          .ecommerce_core-right-arm {
            transform-origin: 168px 198px;
            animation: kaleemRightArmIdle 4.2s ease-in-out infinite;
          }
          .ecommerce_core-antenna {
            transform-origin: 130px 54px;
            animation: kaleemAntenna 3.4s ease-in-out infinite;
          }
          .ecommerce_core-eye {
            transform-origin: center;
            animation: kaleemBlink 5.6s ease-in-out infinite;
          }
          .ecommerce_core-pupil {
            transform-origin: center;
            animation: kaleemLook 4.2s ease-in-out infinite;
          }
          .ecommerce_core-spark {
            opacity: 0;
            transform-origin: center;
            animation: kaleemSpark 2.8s ease-in-out infinite;
          }
          .ecommerce_core-mascot--welcome .ecommerce_core-hand { animation-duration: 2.25s; }
          .ecommerce_core-mascot--welcome .ecommerce_core-float { animation-duration: 4.2s; }
          .ecommerce_core-mascot--focus .ecommerce_core-pupil { animation-duration: 2.9s; }
          .ecommerce_core-mascot--spark .ecommerce_core-spark { opacity: 0.75; }
          .ecommerce_core-mascot--spark .ecommerce_core-shadow { animation-duration: 2.7s; }
          .ecommerce_core-mascot--steady .ecommerce_core-hand { animation-duration: 3.8s; }
          .ecommerce_core-mascot--think .ecommerce_core-hand { animation: kaleemThinkHand 3.8s ease-in-out infinite; }
          .ecommerce_core-mascot--think .ecommerce_core-right-arm { animation: kaleemThinkRightArm 3.8s ease-in-out infinite; }
          .ecommerce_core-mascot--point .ecommerce_core-hand { animation: kaleemPointHand 2.9s ease-in-out infinite; }
          .ecommerce_core-mascot--point .ecommerce_core-right-arm { animation: kaleemPointRightArm 2.9s ease-in-out infinite; }
          .ecommerce_core-mascot--celebrate .ecommerce_core-hand { animation: kaleemCelebrateHand 2.1s ease-in-out infinite; }
          .ecommerce_core-mascot--celebrate .ecommerce_core-right-arm { animation: kaleemCelebrateRightArm 2.1s ease-in-out infinite; }
          .ecommerce_core-mascot--celebrate .ecommerce_core-spark { opacity: 0.9; }
          .ecommerce_core-mascot--guide .ecommerce_core-hand { animation: kaleemGuideHand 3.2s ease-in-out infinite; }
          .ecommerce_core-mascot--guide .ecommerce_core-right-arm { animation: kaleemGuideRightArm 3.2s ease-in-out infinite; }
          .ecommerce_core-mascot--assure .ecommerce_core-hand { animation: kaleemAssureHand 4.2s ease-in-out infinite; }
          .ecommerce_core-mascot--assure .ecommerce_core-right-arm { animation: kaleemAssureRightArm 4.2s ease-in-out infinite; }
          .ecommerce_core-mascot--assure .ecommerce_core-float { animation-duration: 5.5s; }
          @keyframes kaleemFloat {
            0%, 100% { transform: translateY(3px) rotate(-1deg); }
            36% { transform: translateY(-7px) rotate(1.5deg); }
            68% { transform: translateY(1px) rotate(-0.6deg); }
          }
          @keyframes kaleemWave {
            0%, 100% { transform: rotate(-8deg); }
            42% { transform: rotate(12deg); }
            58% { transform: rotate(7deg); }
          }
          @keyframes kaleemRightArmIdle {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(5deg) translateY(-2px); }
          }
          @keyframes kaleemThinkHand {
            0%, 100% { transform: rotate(-26deg) translate(-2px, 3px); }
            50% { transform: rotate(-18deg) translate(1px, -1px); }
          }
          @keyframes kaleemThinkRightArm {
            0%, 100% { transform: rotate(-16deg) translate(-4px, 2px); }
            50% { transform: rotate(-8deg) translate(-2px, -3px); }
          }
          @keyframes kaleemPointHand {
            0%, 100% { transform: rotate(20deg) translate(4px, -3px); }
            50% { transform: rotate(31deg) translate(8px, -8px); }
          }
          @keyframes kaleemPointRightArm {
            0%, 100% { transform: rotate(-8deg) translate(-2px, 1px); }
            50% { transform: rotate(-14deg) translate(-5px, -2px); }
          }
          @keyframes kaleemCelebrateHand {
            0%, 100% { transform: rotate(-4deg) translateY(0); }
            36% { transform: rotate(25deg) translate(7px, -9px); }
            68% { transform: rotate(14deg) translate(3px, -5px); }
          }
          @keyframes kaleemCelebrateRightArm {
            0%, 100% { transform: rotate(0deg) translateY(0); }
            44% { transform: rotate(-20deg) translate(-6px, -10px); }
            72% { transform: rotate(-12deg) translate(-3px, -5px); }
          }
          @keyframes kaleemGuideHand {
            0%, 100% { transform: rotate(-16deg) translate(-2px, 0); }
            46% { transform: rotate(9deg) translate(5px, -5px); }
          }
          @keyframes kaleemGuideRightArm {
            0%, 100% { transform: rotate(8deg) translate(2px, 1px); }
            46% { transform: rotate(-7deg) translate(-4px, -4px); }
          }
          @keyframes kaleemAssureHand {
            0%, 100% { transform: rotate(-12deg) translate(0, 1px); }
            50% { transform: rotate(-2deg) translate(2px, -2px); }
          }
          @keyframes kaleemAssureRightArm {
            0%, 100% { transform: rotate(10deg) translate(1px, 0); }
            50% { transform: rotate(2deg) translate(-2px, -3px); }
          }
          @keyframes kaleemAntenna {
            0%, 100% { transform: rotate(-2deg); }
            50% { transform: rotate(4deg); }
          }
          @keyframes kaleemBlink {
            0%, 91%, 100% { transform: scaleY(1); }
            94% { transform: scaleY(0.16); }
            97% { transform: scaleY(1); }
          }
          @keyframes kaleemLook {
            0%, 100% { transform: translateX(0); }
            34% { transform: translateX(-2px); }
            62% { transform: translateX(2px); }
          }
          @keyframes kaleemShadowPulse {
            0%, 100% { opacity: 0.2; transform: scaleX(0.9); }
            50% { opacity: 0.34; transform: scaleX(1.06); }
          }
          @keyframes kaleemSpark {
            0%, 100% { opacity: 0; transform: scale(0.78); }
            34%, 68% { opacity: 0.8; transform: scale(1); }
          }
          @media (prefers-reduced-motion: reduce) {
            .ecommerce_core-shadow,
            .ecommerce_core-float,
            .ecommerce_core-hand,
            .ecommerce_core-right-arm,
            .ecommerce_core-antenna,
            .ecommerce_core-eye,
            .ecommerce_core-pupil,
            .ecommerce_core-spark {
              animation: none;
            }
          }
        `}
      </style>

      <ellipse className="ecommerce_core-shadow" cx="110" cy="237" rx="56" ry="12" fill="#321078" opacity="0.24" />

      <g className="ecommerce_core-float">
        <g className="ecommerce_core-spark">
          <circle cx="48" cy="42" r="4" fill="url(#kaleemCyan)" />
          <circle cx="191" cy="77" r="3.5" fill="#ffffff" />
          <path d="M176 18 L180 28 L190 31 L180 35 L176 45 L172 35 L162 31 L172 28 Z" fill="url(#kaleemCyan)" />
        </g>

        <g className="ecommerce_core-antenna">
          <path d="M116 45 C117 25 124 11 137 6" fill="none" stroke="url(#kaleemPurple)" strokeWidth="10" strokeLinecap="round" />
          <circle cx="140" cy="5" r="16" fill="url(#kaleemPurple)" stroke={outlineColor} strokeWidth="1.3" />
          <path d="M147 54 C151 39 158 31 169 28" fill="none" stroke="url(#kaleemPurple)" strokeWidth="7" strokeLinecap="round" />
          <circle cx="173" cy="27" r="11" fill="url(#kaleemPurple)" stroke={outlineColor} strokeWidth="1.1" />
          <path d="M165 64 C174 51 184 45 196 45" fill="none" stroke="url(#kaleemPurple)" strokeWidth="6" strokeLinecap="round" />
          <circle cx="201" cy="45" r="9" fill="url(#kaleemPurple)" />
        </g>

        <g>
          <path
            d="M36 68 C36 43 53 31 83 31 L138 31 C167 31 185 47 185 75 L185 121 C185 148 169 164 140 165 L126 189 C122 196 111 193 112 184 L113 166 L81 166 C53 166 36 149 36 122 Z"
            fill="url(#kaleemPurple)"
            stroke={outlineColor}
            strokeWidth="2"
          />
          <path
            d="M52 73 C52 54 65 45 89 45 L135 45 C157 45 170 58 170 79 L170 116 C170 136 157 148 134 149 L121 169 C118 174 111 172 112 165 L113 149 L85 149 C64 149 52 136 52 116 Z"
            fill="url(#kaleemWhite)"
            filter="url(#kaleemInnerLift)"
          />
          <path
            d="M35 133 C51 148 77 151 105 151"
            fill="none"
            stroke="#4c1bb4"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.92"
          />
        </g>

        <g>
          <ellipse cx="26" cy="98" rx="15" ry="28" fill="url(#kaleemPurple)" stroke={outlineColor} strokeWidth="1" />
          <ellipse cx="20" cy="98" rx="10" ry="24" fill="url(#kaleemWhite)" />
          <ellipse cx="190" cy="98" rx="15" ry="28" fill="url(#kaleemPurple)" stroke={outlineColor} strokeWidth="1" />
          <ellipse cx="198" cy="98" rx="10" ry="24" fill="url(#kaleemWhite)" />
          <path d="M29 113 C43 130 63 135 83 134" fill="none" stroke="url(#kaleemPurple)" strokeWidth="8" strokeLinecap="round" />
          <ellipse cx="84" cy="135" rx="15" ry="10" fill="url(#kaleemPurple)" />
        </g>

        <g>
          <ellipse className="ecommerce_core-eye" cx="86" cy="92" rx="8" ry="19" fill="url(#kaleemPurpleDark)" />
          <ellipse className="ecommerce_core-eye" cx="133" cy="92" rx="8" ry="19" fill="url(#kaleemPurpleDark)" />
          <g className="ecommerce_core-pupil">
            <circle cx="83" cy="82" r="4.5" fill="#fff" />
            <circle cx="130" cy="82" r="4.5" fill="#fff" />
          </g>
          <path d="M98 117 C104 126 118 126 124 117 C126 114 124 111 120 111 L102 111 C98 111 96 114 98 117 Z" fill="url(#kaleemMouth)" stroke="#1c073f" strokeWidth="1.2" />
        </g>

        <g>
          <path d="M80 158 C85 143 96 136 111 136 C126 136 138 145 143 160 L149 199 C141 213 123 219 106 218 C88 218 73 210 68 198 Z" fill="url(#kaleemPurple)" />
          <path d="M84 160 C89 150 99 144 112 145 C125 145 134 153 138 164 L142 195 C134 204 121 209 108 208 C94 208 82 203 76 194 Z" fill="url(#kaleemWhite)" />
        </g>

        <g>
          <path d="M72 173 C61 166 52 161 41 163 C31 166 27 177 34 185 C43 194 59 193 72 185 Z" fill="url(#kaleemWhite)" />
          <g className="ecommerce_core-hand">
            <ellipse cx="40" cy="161" rx="14" ry="13" fill="url(#kaleemPurple)" />
            <path d="M32 157 L20 145" stroke="url(#kaleemPurple)" strokeWidth="8" strokeLinecap="round" />
            <path d="M40 153 L38 136" stroke="url(#kaleemPurple)" strokeWidth="8" strokeLinecap="round" />
            <path d="M48 157 L58 142" stroke="url(#kaleemPurple)" strokeWidth="8" strokeLinecap="round" />
            <path d="M51 166 L67 160" stroke="url(#kaleemPurple)" strokeWidth="7" strokeLinecap="round" />
          </g>
          <g className="ecommerce_core-right-arm">
            <path d="M147 170 C158 173 166 183 169 197" fill="none" stroke="url(#kaleemWhite)" strokeWidth="14" strokeLinecap="round" />
            <path d="M168 197 C172 204 175 211 171 218" fill="none" stroke="url(#kaleemPurple)" strokeWidth="13" strokeLinecap="round" />
            <ellipse cx="171" cy="219" rx="10" ry="12" fill="url(#kaleemPurple)" />
          </g>
        </g>

        <g>
          <path d="M91 208 L91 225" stroke="url(#kaleemWhite)" strokeWidth="13" strokeLinecap="round" />
          <path d="M128 208 L128 225" stroke="url(#kaleemWhite)" strokeWidth="13" strokeLinecap="round" />
          <ellipse cx="88" cy="231" rx="22" ry="11" fill="url(#kaleemPurple)" />
          <ellipse cx="131" cy="231" rx="22" ry="11" fill="url(#kaleemPurple)" />
        </g>
      </g>
    </Box>
  );
}
