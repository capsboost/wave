import Link from "next/link";
import { WaveLogo } from "@/components/ui/WaveLogo";

export function Footer() {
  return (
    <footer className="bg-void-black py-stack-lg border-t border-outline-variant mt-auto z-10 relative">
      <div className="flex flex-col md:flex-row justify-between items-center px-margin-mobile md:px-margin-desktop gap-stack-md">
        <Link href="/" className="flex items-center group whitespace-nowrap focus:outline-none" aria-label="Wave Anime Home">
          <WaveLogo variant="full" size="md" />
        </Link>
        <div className="flex flex-wrap justify-center gap-stack-md font-label-md text-label-md uppercase">
          <Link className="text-on-surface-variant hover:text-cyber-cyan transition-opacity duration-200" href="/">Home</Link>
          <Link className="text-on-surface-variant hover:text-cyber-cyan transition-opacity duration-200" href="/schedule">Schedule</Link>
          <Link className="text-on-surface-variant hover:text-cyber-cyan transition-opacity duration-200" href="/continue-watching">Recents</Link>
          <a className="text-on-surface-variant hover:text-cyber-cyan transition-opacity duration-200" href="https://flicmovies.me" target="_blank" rel="noopener noreferrer">Movies & TV Shows</a>
          <a className="text-on-surface-variant hover:text-cyber-cyan transition-opacity duration-200" href="https://sports.flicmovies.me" target="_blank" rel="noopener noreferrer">Sports</a>
          <a className="text-on-surface-variant hover:text-cyber-cyan transition-opacity duration-200" href="#">Terms & Privacy</a>
        </div>
        <div className="font-body-md text-body-md text-on-surface-variant text-sm">
          &copy; {new Date().getFullYear()} WAVE ANIME
        </div>
      </div>
    </footer>
  );
}
