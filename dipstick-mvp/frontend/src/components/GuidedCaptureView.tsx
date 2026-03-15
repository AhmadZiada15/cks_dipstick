/**
 * GuidedCaptureView
 * ==================
 * Live camera viewfinder with an overlay guide for standardized dipstick capture.
 * Similar to mobile check scanning: shows a dashed guide rectangle where the user
 * should place the strip/template, with a shutter button to capture a frame.
 *
 * Falls back gracefully if getUserMedia is not available or permission is denied.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Lock, ShieldAlert, AlertTriangle, X as CloseIcon, Zap } from 'lucide-react';

interface GuidedCaptureViewProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
}

type CameraState = 'starting' | 'active' | 'denied' | 'error' | 'insecure';

interface MarkerAssistState {
  markerDetected: boolean;
  markerConfidence: number;
  stripAligned: boolean;
  lightingOk: boolean;
  brightness: number;
  ready: boolean;
  hint: string;
}

const INITIAL_ASSIST_STATE: MarkerAssistState = {
  markerDetected: false,
  markerConfidence: 0,
  stripAligned: false,
  lightingOk: true,
  brightness: 0,
  ready: false,
  hint: 'Point the camera at the guide card and keep the marker corner visible.',
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function sampleRegion(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  const left = Math.max(0, Math.floor(x0 * width));
  const top = Math.max(0, Math.floor(y0 * height));
  const right = Math.min(width, Math.ceil(x1 * width));
  const bottom = Math.min(height, Math.ceil(y1 * height));

  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const value = gray[y * width + x];
      sum += value;
      sumSq += value * value;
      count += 1;
    }
  }

  const mean = count > 0 ? sum / count : 0;
  const variance = count > 0 ? Math.max(0, sumSq / count - mean * mean) : 0;

  return {
    mean,
    stdDev: Math.sqrt(variance),
    count,
  };
}

function assessMarkerAssist(video: HTMLVideoElement, canvas: HTMLCanvasElement): MarkerAssistState {
  const width = 240;
  const height = 360;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return INITIAL_ASSIST_STATE;
  }

  ctx.drawImage(video, 0, 0, width, height);
  const frame = ctx.getImageData(0, 0, width, height);
  const gray = new Uint8ClampedArray(width * height);

  for (let i = 0, px = 0; i < frame.data.length; i += 4, px += 1) {
    const r = frame.data[i];
    const g = frame.data[i + 1];
    const b = frame.data[i + 2];
    gray[px] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  const full = sampleRegion(gray, width, height, 0, 0, 1, 1);
  const markerRegion = sampleRegion(gray, width, height, 0.12, 0.66, 0.24, 0.82);
  const markerInner = sampleRegion(gray, width, height, 0.145, 0.685, 0.215, 0.785);
  const stripRegion = sampleRegion(gray, width, height, 0.42, 0.22, 0.58, 0.82);

  const markerContrast = clamp((markerRegion.stdDev - 14) / 45);
  const markerCenterDelta = clamp(Math.abs(markerRegion.mean - markerInner.mean) / 80);
  const markerConfidence = clamp(markerContrast * 0.65 + markerCenterDelta * 0.35);
  const markerDetected = markerConfidence > 0.38;

  const stripTexture = clamp((stripRegion.stdDev - 10) / 38);
  const stripAligned = stripTexture > 0.32;

  const lightingOk = full.mean > 68 && full.mean < 212;
  const ready = markerDetected && stripAligned && lightingOk;

  let hint = 'Point the camera at the guide card and keep the marker corner visible.';
  if (!lightingOk) {
    hint = full.mean <= 68
      ? 'Lighting looks too dark. Move closer to a window or turn on a light.'
      : 'Highlights are too bright. Reduce glare and tilt away from reflections.';
  } else if (!markerDetected) {
    hint = 'Marker not locked yet. Bring the lower-left fiducial corner fully into frame.';
  } else if (!stripAligned) {
    hint = 'Marker found. Now center the dipstick inside the teal lane.';
  } else if (ready) {
    hint = 'Ready to capture. Marker lock and strip alignment look stable.';
  }

  return {
    markerDetected,
    markerConfidence: Number(markerConfidence.toFixed(2)),
    stripAligned,
    lightingOk,
    brightness: Number(full.mean.toFixed(0)),
    ready,
    hint,
  };
}

export default function GuidedCaptureView({ onCapture, onCancel }: GuidedCaptureViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoCaptureTimerRef = useRef<number | null>(null);
  const autoCaptureLockRef = useRef(false);

  const [cameraState, setCameraState] = useState<CameraState>('starting');
  const [flashOn, setFlashOn] = useState(false);
  const [flashSupported, setFlashSupported] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [assistState, setAssistState] = useState<MarkerAssistState>(INITIAL_ASSIST_STATE);
  const [autoCaptureState, setAutoCaptureState] = useState<'idle' | 'arming' | 'capturing'>('idle');

  // Start camera on mount
  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      // getUserMedia requires HTTPS (except localhost)
      const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      if (!isLocalhost && location.protocol !== 'https:') {
        setCameraState('insecure');
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('error');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Check flash/torch support
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const caps = videoTrack.getCapabilities?.();
          if (caps && 'torch' in caps) {
            setFlashSupported(true);
          }
        }

        setCameraState('active');
      } catch (err: unknown) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          setCameraState('denied');
        } else {
          setCameraState('error');
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (autoCaptureTimerRef.current !== null) {
        window.clearTimeout(autoCaptureTimerRef.current);
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (cameraState !== 'active') return;

    const timer = window.setInterval(() => {
      const video = videoRef.current;
      const canvas = analysisCanvasRef.current;
      if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
        return;
      }
      setAssistState(assessMarkerAssist(video, canvas));
    }, 650);

    return () => window.clearInterval(timer);
  }, [cameraState]);

  // Toggle flash
  const toggleFlash = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const newState = !flashOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: newState } as MediaTrackConstraintSet] });
      setFlashOn(newState);
    } catch {
      // Torch not supported on this device
    }
  }, [flashOn]);

  // Capture frame from video
  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setCapturing(true);
    setAutoCaptureState('capturing');

    // Use the video's intrinsic resolution, not CSS size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], 'dipstick-capture.jpg', { type: 'image/jpeg' });
          // Stop camera before delivering
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          onCapture(file);
        }
        setCapturing(false);
      },
      'image/jpeg',
      0.92,
    );
  }, [onCapture]);

  useEffect(() => {
    if (cameraState !== 'active' || capturing || autoCaptureLockRef.current) {
      return;
    }

    if (assistState.ready) {
      if (autoCaptureTimerRef.current === null) {
        setAutoCaptureState('arming');
        autoCaptureTimerRef.current = window.setTimeout(() => {
          autoCaptureTimerRef.current = null;
          autoCaptureLockRef.current = true;
          setAutoCaptureState('capturing');
          handleCapture();
        }, 850);
      }
      return;
    }

    if (autoCaptureTimerRef.current !== null) {
      window.clearTimeout(autoCaptureTimerRef.current);
      autoCaptureTimerRef.current = null;
    }
    setAutoCaptureState('idle');
  }, [assistState.ready, cameraState, capturing, handleCapture]);

  // Permission denied, error, or insecure context
  if (cameraState === 'denied' || cameraState === 'error' || cameraState === 'insecure') {
    const icon = cameraState === 'insecure' ? <Lock size={48} /> : cameraState === 'denied' ? <ShieldAlert size={48} /> : <AlertTriangle size={48} />;
    const title =
      cameraState === 'insecure' ? 'HTTPS required for live camera' :
      cameraState === 'denied'   ? 'Camera access denied' :
                                   'Camera unavailable';
    const body =
      cameraState === 'insecure'
        ? "Live camera only works over HTTPS. To test on your phone, run:\n\nnpx ngrok http 5173\n\nthen open the https:// URL on your phone."
        : cameraState === 'denied'
        ? 'Please allow camera access in your browser settings to use guided capture.'
        : 'Your device or browser does not support live camera access.';

    return (
      <div style={styles.fallbackContainer}>
        <div style={styles.fallbackIcon}>{icon}</div>
        <h3 style={styles.fallbackTitle}>{title}</h3>
        <p style={{ ...styles.fallbackText, whiteSpace: 'pre-wrap', fontFamily: cameraState === 'insecure' ? 'monospace' : 'inherit' }}>
          {body}
        </p>
        <button style={styles.fallbackBtn} onClick={onCancel}>
          Use Photo Upload Instead
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Live camera feed */}
      <div style={styles.viewfinderWrapper}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={styles.video}
          onLoadedMetadata={() => setCameraState('active')}
        />

        {/* SVG overlay with guide */}
        <svg style={styles.overlay} viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">
          {/* Dark mask with transparent cutout */}
          <defs>
            <mask id="guideMask">
              <rect width="400" height="600" fill="white" />
              {/* Template card cutout — landscape card centered */}
              <rect x="40" y="120" width="320" height="360" rx="12" fill="black" />
            </mask>
          </defs>
          <rect width="400" height="600" fill="rgba(0,0,0,0.55)" mask="url(#guideMask)" />

          {/* Template card border (dashed) */}
          <rect
            x="40" y="120" width="320" height="360" rx="12"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeDasharray="12 6"
            style={{ animation: 'guidePulse 2.5s ease-in-out infinite' }}
          />

          {/* Strip placement zone — narrow vertical rectangle centered in the card */}
          <rect
            x="155" y="145" width="90" height="310" rx="6"
            fill="none"
            stroke="#8B6A4D"
            strokeWidth="2"
            strokeDasharray="8 4"
          />

          {/* "STRIP" label */}
          <text x="200" y="470" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="11" fontWeight="600" fontFamily="sans-serif">
            STRIP ZONE
          </text>

          {/* Structured fiducial marker */}
          <rect x="46" y="442" width="46" height="46" rx="4" fill="#FFFFFF" stroke="#F59E0B" strokeWidth="1.5" />
          <rect x="49" y="445" width="8" height="8" fill="#0F172A" />
          <rect x="57" y="445" width="8" height="8" fill="#0F172A" />
          <rect x="65" y="445" width="8" height="8" fill="#FFFFFF" />
          <rect x="73" y="445" width="8" height="8" fill="#0F172A" />
          <rect x="81" y="445" width="8" height="8" fill="#0F172A" />
          <rect x="49" y="453" width="8" height="8" fill="#0F172A" />
          <rect x="57" y="453" width="8" height="8" fill="#FFFFFF" />
          <rect x="65" y="453" width="8" height="8" fill="#8B6A4D" />
          <rect x="73" y="453" width="8" height="8" fill="#FFFFFF" />
          <rect x="81" y="453" width="8" height="8" fill="#0F172A" />
          <rect x="49" y="461" width="8" height="8" fill="#FFFFFF" />
          <rect x="57" y="461" width="8" height="8" fill="#8B6A4D" />
          <rect x="65" y="461" width="8" height="8" fill="#0F172A" />
          <rect x="73" y="461" width="8" height="8" fill="#8B6A4D" />
          <rect x="81" y="461" width="8" height="8" fill="#FFFFFF" />
          <rect x="49" y="469" width="8" height="8" fill="#0F172A" />
          <rect x="57" y="469" width="8" height="8" fill="#FFFFFF" />
          <rect x="65" y="469" width="8" height="8" fill="#8B6A4D" />
          <rect x="73" y="469" width="8" height="8" fill="#FFFFFF" />
          <rect x="81" y="469" width="8" height="8" fill="#0F172A" />
          <rect x="49" y="477" width="8" height="8" fill="#0F172A" />
          <rect x="57" y="477" width="8" height="8" fill="#0F172A" />
          <rect x="65" y="477" width="8" height="8" fill="#FFFFFF" />
          <rect x="73" y="477" width="8" height="8" fill="#0F172A" />
          <rect x="81" y="477" width="8" height="8" fill="#0F172A" />

        </svg>

        {/* Loading spinner while camera starts */}
        {cameraState === 'starting' && (
          <div style={styles.loadingOverlay}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Starting camera...</p>
          </div>
        )}

        {/* Top controls */}
        <div style={styles.topBar}>
          <button style={styles.topBtn} onClick={onCancel} aria-label="Close camera">
            <CloseIcon size={20} />
          </button>
          <span style={styles.topTitle}>Scan Strip</span>
          {flashSupported ? (
            <button
              style={{ ...styles.topBtn, ...(flashOn ? styles.topBtnActive : {}) }}
              onClick={toggleFlash}
              aria-label="Toggle flash"
            >
              <Zap size={20} />
            </button>
          ) : (
            <div style={{ width: 40 }} />
          )}
        </div>

        <div style={styles.statusRail}>
          <StatusPill
            label="Marker"
            ok={assistState.markerDetected}
            detail={assistState.markerDetected ? `Lock ${Math.round(assistState.markerConfidence * 100)}%` : 'Searching'}
          />
          <StatusPill
            label="Strip"
            ok={assistState.stripAligned}
            detail={assistState.stripAligned ? 'Aligned' : 'Move into lane'}
          />
          <StatusPill
            label="Light"
            ok={assistState.lightingOk}
            detail={assistState.lightingOk ? `${assistState.brightness} lux-ish` : 'Adjust scene'}
          />
        </div>
      </div>

      {/* Guidance text */}
      <div style={styles.guidanceBar}>
        <div style={styles.guidanceStack}>
          <p style={styles.guidanceTitle}>Marker-assisted capture</p>
          <p style={styles.guidanceText}>{assistState.hint}</p>
          {autoCaptureState !== 'idle' && (
            <p style={styles.autoCaptureText}>
              {autoCaptureState === 'arming'
                ? 'Stable marker lock detected. Auto-capturing...'
                : 'Capturing frame...'}
            </p>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div style={styles.bottomBar}>
        <button style={styles.uploadFallbackBtn} onClick={onCancel}>
          Upload
        </button>

        {/* Shutter button */}
        <button
          style={{
            ...styles.shutterBtn,
            ...(assistState.ready ? styles.shutterBtnReady : {}),
            opacity: cameraState === 'active' && !capturing ? 1 : 0.5,
          }}
          onClick={handleCapture}
          disabled={cameraState !== 'active' || capturing}
          aria-label="Take photo"
        >
          <div style={styles.shutterInner} />
        </button>

        <div style={{ width: 60 }} /> {/* Spacer for centering */}
      </div>

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <canvas ref={analysisCanvasRef} style={{ display: 'none' }} />
    </div>
  );
}

function StatusPill({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div style={{ ...styles.statusPill, ...(ok ? styles.statusPillOk : styles.statusPillWarn) }}>
      <div style={styles.statusLabel}>{label}</div>
      <div style={styles.statusDetail}>{detail}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: '580px',
    backgroundColor: '#000',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  viewfinderWrapper: {
    position: 'relative',
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '3px solid rgba(255,255,255,0.3)',
    borderTopColor: '#FFFFFF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: '14px',
    marginTop: '12px',
    fontWeight: 500,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 12px',
    zIndex: 10,
  },
  topBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '1.5px solid rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(0,0,0,0.3)',
    color: '#FFFFFF',
    fontSize: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    backdropFilter: 'blur(4px)',
  },
  topBtnActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  topTitle: {
    color: '#FFFFFF',
    fontSize: '16px',
    fontWeight: 700,
    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
  },
  statusRail: {
    position: 'absolute',
    top: '62px',
    left: '12px',
    right: '12px',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '8px',
    zIndex: 10,
  },
  statusPill: {
    borderRadius: '12px',
    padding: '10px 10px 9px',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.18)',
  },
  statusPillOk: {
    backgroundColor: 'rgba(139, 106, 77, 0.24)',
  },
  statusPillWarn: {
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  statusLabel: {
    color: '#E2E8F0',
    fontSize: '10px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 700,
    marginBottom: '3px',
  },
  statusDetail: {
    color: '#FFFFFF',
    fontSize: '12px',
    fontWeight: 600,
  },
  guidanceBar: {
    backgroundColor: '#1E293B',
    padding: '12px 16px 14px',
  },
  guidanceStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    textAlign: 'center',
  },
  guidanceTitle: {
    color: '#E4D5C7',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    margin: 0,
  },
  guidanceText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: '13px',
    fontWeight: 500,
    lineHeight: 1.4,
    margin: 0,
  },
  autoCaptureText: {
    color: '#E4D5C7',
    fontSize: '12px',
    fontWeight: 700,
    margin: 0,
  },
  bottomBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    backgroundColor: '#0F1419',
  },
  shutterBtn: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    border: '4px solid #FFFFFF',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.15s',
  },
  shutterBtnReady: {
    boxShadow: '0 0 0 8px rgba(139, 106, 77, 0.18), 0 0 24px rgba(139, 106, 77, 0.55)',
  },
  shutterInner: {
    width: '58px',
    height: '58px',
    borderRadius: '50%',
    backgroundColor: '#FFFFFF',
  },
  uploadFallbackBtn: {
    background: 'none',
    border: '1.5px solid rgba(255,255,255,0.35)',
    borderRadius: '10px',
    color: 'rgba(255,255,255,0.8)',
    fontSize: '13px',
    fontWeight: 600,
    padding: '8px 14px',
    cursor: 'pointer',
    width: '60px',
  },
  fallbackContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center',
    gap: '8px',
  },
  fallbackIcon: {
    fontSize: '48px',
    marginBottom: '8px',
  },
  fallbackTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#1E293B',
    margin: 0,
  },
  fallbackText: {
    fontSize: '14px',
    color: '#64748B',
    lineHeight: 1.6,
    margin: '4px 0 16px',
    maxWidth: '280px',
  },
  fallbackBtn: {
    padding: '12px 24px',
    backgroundColor: '#8B6A4D',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
