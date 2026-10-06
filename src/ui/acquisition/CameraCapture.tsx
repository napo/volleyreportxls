/**
 * Live camera (webcam on computers, rear camera on tablets) to shoot the
 * sheets one after the other: every shot is handed over and the camera stays
 * open for the next set.
 */
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n';

interface Props {
  readonly onShot: (photo: Blob) => void;
  readonly onClose: () => void;
}

/** Full-resolution still when the browser can take one, otherwise the current video frame. */
async function shoot(video: HTMLVideoElement, track: MediaStreamTrack): Promise<Blob | null> {
  const Capture = (globalThis as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto(): Promise<Blob> } }).ImageCapture;
  if (Capture) {
    try {
      return await new Capture(track).takePhoto();
    } catch {
      // Fall back to the video frame.
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')!.drawImage(video, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
}

export function CameraCapture({ onShot, onClose }: Props) {
  const { m } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [failed, setFailed] = useState(false);
  const [taken, setTaken] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false })
      .then((s) => {
        if (!active) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => setFailed(true));
    return () => {
      active = false;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const take = async () => {
    const track = stream.current?.getVideoTracks()[0];
    if (!video.current || !track) return;
    setBusy(true);
    try {
      const photo = await shoot(video.current, track);
      if (photo) {
        onShot(photo);
        setTaken((n) => n + 1);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="vr-camera" role="dialog" aria-modal="true" aria-label={m.acquisition.camera.title}>
      {failed ? (
        <p className="vr-camera-message">{m.acquisition.camera.unavailable}</p>
      ) : (
        <div className="vr-camera-view">
          <video ref={video} autoPlay playsInline muted />
          <div className="vr-camera-frame" aria-hidden="true" />
          <p className="vr-camera-hint">{m.acquisition.camera.frame}</p>
        </div>
      )}
      <div className="vr-camera-bar">
        <span>{taken > 0 && m.acquisition.camera.taken(taken)}</span>
        {!failed && (
          <button type="button" className="vr-camera-shoot" onClick={take} disabled={busy} aria-label={m.acquisition.camera.shoot}>
            <span />
          </button>
        )}
        <button type="button" className="vr-btn vr-btn-secondary" onClick={onClose}>
          {m.acquisition.camera.done}
        </button>
      </div>
    </div>
  );
}
