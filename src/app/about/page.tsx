'use client';

import { Header } from '@/components/header';
import { SiteFooter } from '@/components/site-footer';

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-10 space-y-8">
        <section>
          <h1 className="text-xl font-bold text-content mb-3">About LibreTV</h1>
          <p className="text-sm text-muted leading-relaxed">
            LibreTV is a free platform for searching and playing online videos across multiple configured sources.
            You can search by title without registration. LibreTV does not host video files; playback is supplied by third-party sources.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-content mb-2.5">Keyboard shortcuts</h2>
          <ul className="text-sm text-muted space-y-1.5 list-disc list-inside">
            <li><code className="text-accent">Space</code> Play / pause</li>
            <li><code className="text-accent">←</code> / <code className="text-accent">→</code> Back / forward 5 seconds</li>
            <li><code className="text-accent">↑</code> / <code className="text-accent">↓</code> Adjust volume</li>
            <li><code className="text-accent">F</code> Toggle fullscreen</li>
            <li><code className="text-accent">Alt + ←/→</code> Previous / next episode</li>
            <li>On mobile, press and hold the video to play at 3× speed.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-base font-semibold text-content mb-2.5">Privacy and data</h2>
          <p className="text-sm text-muted leading-relaxed">
            Your search history and watch progress are stored in your browser (IndexedDB), not uploaded to the LibreTV server.
            Aggregated search requests are forwarded through the server, rather than sent directly from your browser to each video source.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-content mb-2.5">Disclaimer</h2>
          <p className="text-sm text-faint leading-relaxed">
            LibreTV does not create, host or store video files. It provides an interface for searching and playing content from third-party sources.
            Only use sources and content that you are legally authorized to access.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
