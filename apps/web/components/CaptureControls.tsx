'use client';

import { useRef, useState } from 'react';
import { useEarth } from '@earthos/core/react';
import { GlassPanel, IconButton } from '@earthos/ui';
import { buildPermalink } from './permalink';

const ATTRIBUTION = 'EarthOS · open-source digital twin · imagery: Esri/NASA · data: CelesTrak/OpenSky/USGS';

/** Screenshot, clip recording, and copy-link: every viewer is a publisher. */
export function CaptureControls() {
  const engine = useEarth();
  const [recording, setRecording] = useState(false);
  const [copied, setCopied] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);

  const canvas = () => engine.getExtension<HTMLCanvasElement>('globe:canvas');

  const screenshot = () => {
    const source = canvas();
    if (!source) return;
    const out = document.createElement('canvas');
    out.width = source.width;
    out.height = source.height + 44;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#191512';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(source, 0, 0);
    ctx.fillStyle = '#9c9280';
    ctx.font = '20px JetBrains Mono, monospace';
    ctx.fillText(ATTRIBUTION, 16, out.height - 15);
    out.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `earthos-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  };

  const toggleRecord = () => {
    if (recorder.current) {
      recorder.current.stop();
      recorder.current = null;
      setRecording(false);
      return;
    }
    const source = canvas();
    if (!source) return;
    const stream = source.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `earthos-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(a.href);
      stream.getTracks().forEach((t) => t.stop());
    };
    rec.start();
    recorder.current = rec;
    setRecording(true);
  };

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}${buildPermalink(engine)}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <GlassPanel className="px-2 py-1.5">
      <div className="flex items-center gap-1">
        <IconButton label="Copy share link" onClick={copyLink} active={copied}>
          {copied ? 'Copied' : 'Share'}
        </IconButton>
        <IconButton label="Save screenshot" onClick={screenshot}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
            <rect x="1" y="3.5" width="12" height="9" rx="1.5" />
            <circle cx="7" cy="8" r="2.6" />
            <path d="M4.5 3.5L5.6 1.5h2.8l1.1 2" />
          </svg>
        </IconButton>
        <IconButton label={recording ? 'Stop recording' : 'Record clip'} onClick={toggleRecord} active={recording}>
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${recording ? 'animate-pulse bg-[var(--danger-600)]' : 'bg-[var(--text-secondary)]'}`}
          />
        </IconButton>
      </div>
    </GlassPanel>
  );
}
