"use client";

import React from "react";

interface WaveLogoProps {
  variant?: "full" | "icon" | "stacked";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showSubtitle?: boolean;
}

function WaveLogoIcon({ className = "w-9 h-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-300 group-hover:scale-105 ${className}`}
      aria-hidden="true"
    >
      <defs>
        {/* Neon Crimson Gradient */}
        <linearGradient id="wave-crimson-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF3366" />
          <stop offset="60%" stopColor="#FF003C" />
          <stop offset="100%" stopColor="#A80028" />
        </linearGradient>

        {/* Cyber Cyan Gradient */}
        <linearGradient id="wave-cyan-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00F0FF" />
          <stop offset="70%" stopColor="#00B8D4" />
          <stop offset="100%" stopColor="#007799" />
        </linearGradient>

        {/* Core Electric Energy Glow */}
        <linearGradient id="wave-core-grad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#00F0FF" />
          <stop offset="40%" stopColor="#BD00FF" />
          <stop offset="100%" stopColor="#FF003C" />
        </linearGradient>

        {/* Neon Glow Filters */}
        <filter id="wave-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Background Cyber Octagon Shield Contour */}
      <polygon
        points="22,6 78,6 94,22 94,78 78,94 22,94 6,78 6,22"
        className="fill-void-black/80 stroke-neon-crimson/30"
        strokeWidth="1.5"
      />

      {/* Cyber Grid Sub-layer Accents */}
      <line x1="6" y1="50" x2="94" y2="50" stroke="#FF003C" strokeWidth="0.5" strokeOpacity="0.2" strokeDasharray="2 3" />
      <line x1="50" y1="6" x2="50" y2="94" stroke="#00F0FF" strokeWidth="0.5" strokeOpacity="0.2" strokeDasharray="2 3" />

      {/* Background Kinetic Wave Surge (Back crest) */}
      <path
        d="M 30 42 L 50 16 L 68 30 L 60 34 L 50 24 L 38 38 Z"
        fill="url(#wave-cyan-grad)"
        opacity="0.85"
        filter="url(#wave-glow)"
      />

      {/* Tidal Crest Secondary Arch */}
      <path
        d="M 22 48 L 44 22 L 54 32 L 48 35 L 42 29 L 28 45 Z"
        fill="#00F0FF"
        opacity="0.6"
      />

      {/* Frequency Pulse Equalizer Blades (Audio/Frequency Wave theme) */}
      <polygon points="68,40 71,40 71,58 68,58" fill="#00F0FF" opacity="0.9" />
      <polygon points="74,34 77,34 77,64 74,64" fill="#00F0FF" />
      <polygon points="80,42 83,42 83,56 80,56" fill="#00F0FF" opacity="0.8" />
      <polygon points="86,46 88,46 88,52 86,52" fill="#00F0FF" opacity="0.6" />

      <polygon points="28,46 31,46 31,54 28,54" fill="#FF003C" opacity="0.8" />
      <polygon points="22,38 25,38 25,62 22,62" fill="#FF003C" />
      <polygon points="16,44 18,44 18,56 16,56" fill="#FF003C" opacity="0.7" />

      {/* Left Outer Wing (Akira Neon Crimson Facet) */}
      <polygon
        points="10,22 24,22 40,82 26,82"
        fill="url(#wave-crimson-grad)"
        filter="url(#wave-glow)"
      />
      {/* Left Wing Inner Chamfer Bevel */}
      <polygon
        points="14,26 22,26 35,76 28,76"
        fill="#FF6685"
        opacity="0.8"
      />

      {/* Right Outer Wing (Cyber Cyan Kinetic Facet) */}
      <polygon
        points="90,22 76,22 60,82 74,82"
        fill="url(#wave-cyan-grad)"
        filter="url(#wave-glow)"
      />
      {/* Right Wing Inner Chamfer Bevel */}
      <polygon
        points="86,26 78,26 65,76 72,76"
        fill="#80F7FF"
        opacity="0.8"
      />

      {/* Center Dynamic Blade / Wave Spire (Interlocking Convergence) */}
      <polygon
        points="50,28 62,78 52,78 50,66 48,78 38,78"
        fill="url(#wave-core-grad)"
        filter="url(#wave-glow)"
      />
      {/* Core Apex Light Strike */}
      <polygon
        points="50,28 53,60 50,56 47,60"
        fill="#FFFFFF"
      />

      {/* Bottom Kinetic Anchor Points */}
      <polygon points="26,84 40,84 37,87 29,87" fill="#FF003C" />
      <polygon points="60,84 74,84 71,87 63,87" fill="#00F0FF" />

      {/* Outer Cyber Corner Brackets */}
      <path d="M 12 10 L 6 10 L 6 16" stroke="#FF003C" strokeWidth="1.5" />
      <path d="M 88 10 L 94 10 L 94 16" stroke="#00F0FF" strokeWidth="1.5" />
      <path d="M 6 84 L 6 90 L 12 90" stroke="#FF003C" strokeWidth="1.5" />
      <path d="M 94 84 L 94 90 L 88 90" stroke="#00F0FF" strokeWidth="1.5" />
    </svg>
  );
}

export function WaveLogo({
  variant = "full",
  size = "md",
  className = "",
  showSubtitle = true,
}: WaveLogoProps) {
  const iconSizes = {
    sm: "w-7 h-7",
    md: "w-9 h-9",
    lg: "w-11 h-11",
    xl: "w-16 h-16",
  };

  const textSizes = {
    sm: "text-lg tracking-tight",
    md: "text-xl lg:text-2xl tracking-tighter",
    lg: "text-3xl tracking-tighter",
    xl: "text-4xl lg:text-5xl tracking-tighter",
  };

  if (variant === "icon") {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        <WaveLogoIcon className={iconSizes[size]} />
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <div className={`flex flex-col items-center gap-2 group ${className}`}>
        <WaveLogoIcon className={iconSizes[size]} />
        <div className="flex flex-col items-center">
          <div className={`font-headline-lg font-black italic select-none ${textSizes[size]}`}>
            <span className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">WAVE</span>
            <span className="text-neon-crimson drop-shadow-[0_0_12px_rgba(255,0,60,0.6)]">ANIME</span>
          </div>
          {showSubtitle && (
            <div className="flex items-center gap-1.5 text-[9px] tracking-[0.25em] font-mono uppercase text-cyber-cyan/80">
              <span>ウェイブ</span>
              <span className="text-neon-crimson font-bold">{"///"}</span>
              <span>HD STREAMING</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 md:gap-3 group select-none ${className}`}>
      {/* Glowing Cyber Icon Emblem */}
      <div className="relative flex items-center justify-center">
        {/* Ambient Neon Backlight Halo */}
        <div className="absolute -inset-1 bg-linear-to-r from-neon-crimson/20 to-cyber-cyan/20 blur-sm opacity-40 group-hover:opacity-70 transition-opacity duration-300" />
        <WaveLogoIcon className={iconSizes[size]} />
      </div>

      {/* Typographic Lockup */}
      <div className="flex flex-col leading-none">
        <div className={`font-headline-lg font-black italic flex items-center ${textSizes[size]}`}>
          <span className="text-white transition-colors group-hover:text-cyber-cyan">
            WAVE
          </span>
          <span className="text-neon-crimson transition-colors">
            ANIME
          </span>
        </div>

        {showSubtitle && (
          <div className="hidden sm:flex items-center gap-1.5 text-[8px] md:text-[9px] tracking-[0.22em] font-mono uppercase text-on-surface-variant/70 mt-0.5 group-hover:text-cyber-cyan/90 transition-colors">
            <span className="text-cyber-cyan/90 font-medium">ウェイブ</span>
            <span className="text-neon-crimson font-bold">{"/"}</span>
            <span>NEXT-GEN ANIME</span>
          </div>
        )}
      </div>
    </div>
  );
}
