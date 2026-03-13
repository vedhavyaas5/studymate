import React, { useState, useRef, useEffect } from 'react';

// Ambient sound generator using Web Audio API
const createAmbientSound = (type) => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  if (type === 'rain') {
    // Brown noise filtered to sound like rain
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0.3;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 400;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    return { ctx, source, gain };
  }

  if (type === 'cafe') {
    // Warmer noise with lower frequencies
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      data[i] *= 0.11;
      b6 = white * 0.115926;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0.2;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    return { ctx, source, gain };
  }

  // White noise
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = 0.08;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
  return { ctx, source, gain };
};

const FocusMode = ({
  timeLeft, formatTime, sessionType, subject,
  isRunning, onStart, onPause, onReset, onExit,
  timerProgress, colors, sessionsCompleted,
  breakTip, notification
}) => {
  const [ambientSound, setAmbientSound] = useState(null);
  const [activeSound, setActiveSound] = useState(null);
  const soundRef = useRef(null);
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleSound = (type) => {
    // Stop current sound
    if (soundRef.current) {
      try {
        soundRef.current.source.stop();
        soundRef.current.ctx.close();
      } catch (e) {}
      soundRef.current = null;
    }

    if (activeSound === type) {
      setActiveSound(null);
      return;
    }

    const sound = createAmbientSound(type);
    soundRef.current = sound;
    setActiveSound(type);
  };

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        try {
          soundRef.current.source.stop();
          soundRef.current.ctx.close();
        } catch (e) {}
      }
    };
  }, []);

  const sessionLabel = sessionType === 'study' ? '📚 Study' : sessionType === 'shortBreak' ? '☕ Short Break' : '🌟 Long Break';

  return (
    <div
      ref={containerRef}
      className={`min-h-screen bg-gradient-to-br ${
        sessionType === 'study'
          ? 'from-gray-900 via-blue-950 to-gray-900'
          : sessionType === 'shortBreak'
          ? 'from-gray-900 via-green-950 to-gray-900'
          : 'from-gray-900 via-purple-950 to-gray-900'
      } flex flex-col items-center justify-center relative overflow-hidden`}
    >
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/5 animate-float"
            style={{
              width: `${Math.random() * 6 + 2}px`,
              height: `${Math.random() * 6 + 2}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${Math.random() * 10 + 10}s`,
            }}
          />
        ))}
      </div>

      {/* Notification */}
      {notification && (
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-6 py-3 text-white">
            {notification}
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
        <button
          onClick={() => {
            if (document.fullscreenElement) document.exitFullscreen?.();
            onExit();
          }}
          className="text-white/60 hover:text-white transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Exit Focus
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleFullscreen}
            className="text-white/60 hover:text-white transition-colors p-2"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isFullscreen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="text-center z-10">
        {/* Subject */}
        {subject && (
          <p className="text-white/50 text-lg mb-2">{subject}</p>
        )}

        {/* Session badge */}
        <div className="inline-block px-4 py-1 rounded-full bg-white/10 text-white/80 text-sm mb-8">
          {sessionLabel} · Session {sessionsCompleted + 1}
        </div>

        {/* Large timer ring */}
        <div className="relative w-80 h-80 mx-auto mb-10">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 320 320">
            <circle
              cx="160" cy="160" r="145"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="8"
            />
            <circle
              cx="160" cy="160" r="145"
              fill="none"
              stroke={colors.ring}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 145}`}
              strokeDashoffset={`${2 * Math.PI * 145 * (1 - timerProgress / 100)}`}
              className="transition-all duration-1000"
              style={{ filter: `drop-shadow(0 0 10px ${colors.ring})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-7xl font-mono font-light text-white tracking-widest">
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4 mb-10">
          {!isRunning ? (
            <button
              onClick={onStart}
              className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all text-white"
            >
              <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          ) : (
            <button
              onClick={onPause}
              className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all text-white"
            >
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
              </svg>
            </button>
          )}
          <button
            onClick={onReset}
            className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all text-white/60"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Break tip */}
        {sessionType !== 'study' && breakTip && (
          <div className="max-w-md mx-auto bg-white/5 border border-white/10 rounded-xl px-6 py-4 mb-8">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Break Suggestion</p>
            <p className="text-white/80">{breakTip}</p>
          </div>
        )}

        {/* Ambient Sounds */}
        <div className="flex justify-center gap-3">
          <p className="text-white/30 text-sm self-center mr-2">Ambient:</p>
          {[
            { type: 'rain', label: '🌧️ Rain' },
            { type: 'cafe', label: '☕ Cafe' },
            { type: 'whitenoise', label: '🌊 White Noise' },
          ].map(({ type, label }) => (
            <button
              key={type}
              onClick={() => toggleSound(type)}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                activeSound === type
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FocusMode;
