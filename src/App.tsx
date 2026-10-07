/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Flame,
  Scissors,
  Volume2,
  VolumeX,
  RotateCcw,
  Crosshair,
  Sliders,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { HyperRealScene3D, SceneTelemetry } from './components/HyperRealScene3D';
import {
  PROTAGONIST_STATES,
  FLAME_PRESETS,
  PAPER_TEAR_MODES,
  FlamePreset,
} from './data/protagonistStates';
import { soundEngine } from './utils/soundEngine';

type ActivePanelTab = 'remote' | 'ocular' | 'physics';

export default function App() {
  const [currentStateIdx, setCurrentStateIdx] = useState<number>(0);
  const [nextStateIdx, setNextStateIdx] = useState<number>(1);
  const [tearMode, setTearMode] = useState<number>(0);
  const [flamePreset, setFlamePreset] = useState<FlamePreset>(FLAME_PRESETS[0]);

  // 3D & Shader Physics Controls
  const [depthStrength, setDepthStrength] = useState<number>(0.68);
  const [paperCurl, setPaperCurl] = useState<number>(0.75);
  const [tearJaggedness, setTearJaggedness] = useState<number>(8.5);
  const [alwaysBurnEyes, setAlwaysBurnEyes] = useState<boolean>(false);
  const [mouseRipEnabled, setMouseRipEnabled] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Interactive Eye Anchor Calibration
  const [calibrateStep, setCalibrateStep] = useState<'off' | 'left' | 'right'>('off');

  // Imperative counters to trigger 3D scene actions
  const [triggerTearCounter, setTriggerTearCounter] = useState<number>(0);
  const [clearScratchCounter, setClearScratchCounter] = useState<number>(0);

  // Active drawer tab on the Remote Controller
  const [activeTab, setActiveTab] = useState<ActivePanelTab>('remote');

  // Live Telemetry from the 60fps 3D WebGL scene
  const [telemetry, setTelemetry] = useState<SceneTelemetry>({
    eyeIgnition: 0.45,
    tearProgress: 0.0,
    mouseSpeed: 0.0,
    scratchCoverage: 0.0,
    leftEyeUV: [0.395, 0.555],
    rightEyeUV: [0.605, 0.555],
  });

  const currentState = PROTAGONIST_STATES[currentStateIdx] || PROTAGONIST_STATES[0];
  const queuedState = PROTAGONIST_STATES[nextStateIdx] || PROTAGONIST_STATES[1];

  // Trigger a full-screen paper tear transition to a specific target state or the next state
  const handleTriggerPaperTear = useCallback(
    (targetIdx?: number) => {
      soundEngine.playRemoteClick();
      if (typeof targetIdx === 'number' && targetIdx !== currentStateIdx) {
        setNextStateIdx(targetIdx);
      } else {
        const upcoming = (currentStateIdx + 1) % PROTAGONIST_STATES.length;
        setNextStateIdx(upcoming);
      }
      setTriggerTearCounter((c) => c + 1);
    },
    [currentStateIdx]
  );

  // Callback when the 3D paper-tear transition completes
  const handleTransitionComplete = useCallback((landedIdx: number) => {
    setCurrentStateIdx(landedIdx);
    setNextStateIdx((landedIdx + 1) % PROTAGONIST_STATES.length);
  }, []);

  // Callback when user clicks on the portrait during Eye Calibration mode
  const handleCalibrateComplete = useCallback((side: 'left' | 'right') => {
    if (side === 'left') {
      setCalibrateStep('right');
    } else {
      setCalibrateStep('off');
    }
  }, []);

  // Toggle procedural Web Audio sound engine
  const handleToggleAudio = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    soundEngine.setMuted(nextMute);
    if (!nextMute) {
      soundEngine.playRemoteClick();
    }
  };

  // Keyboard shortcuts for Remote Controller (Space / R = Rip Paper, E = Lock Eye Fire, 1/2/3 = States)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space' || e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleTriggerPaperTear();
      } else if (e.key === 'e' || e.key === 'E') {
        soundEngine.playRemoteClick();
        setAlwaysBurnEyes((prev) => !prev);
      } else if (e.key === '1') {
        handleTriggerPaperTear(0);
      } else if (e.key === '2') {
        handleTriggerPaperTear(1);
      } else if (e.key === '3') {
        handleTriggerPaperTear(2);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTriggerPaperTear]);

  const ignitionPercent = Math.round(Math.min(100, telemetry.eyeIgnition * 100));
  const scratchPercent = Math.round(Math.min(100, telemetry.scratchCoverage * 100));

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#09090B] text-[#FAFAFA] select-none">
      {/* =====================================================================
          FULL-VIEWPORT 3D WEBGL SCENE (Z-0)
      ===================================================================== */}
      <HyperRealScene3D
        currentStateIdx={currentStateIdx}
        nextStateIdx={nextStateIdx}
        tearMode={tearMode}
        flamePreset={flamePreset}
        depthStrength={depthStrength}
        paperCurl={paperCurl}
        tearJaggedness={tearJaggedness}
        alwaysBurnEyes={alwaysBurnEyes}
        mouseRipEnabled={mouseRipEnabled}
        calibrateStep={calibrateStep}
        triggerTearCounter={triggerTearCounter}
        clearScratchCounter={clearScratchCounter}
        onTransitionComplete={handleTransitionComplete}
        onCalibrateComplete={handleCalibrateComplete}
        onTelemetryUpdate={setTelemetry}
      />

      {/* =====================================================================
          TOP BAR CONTRACT (Z-20): Strictly 1 Row, 3 Zones
          Zone 1: Single text wordmark | Zone 2: 4 Nav Links | Zone 3: 2 Actions
      ===================================================================== */}
      <header className="fixed top-0 inset-x-0 z-20 flex items-center justify-between px-6 py-3.5 bg-black/50 backdrop-blur-md border-b border-white/10">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            handleTriggerPaperTear(0);
          }}
          className="font-display text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          GTASG2
        </a>

        {/* Zone 2: 4 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-300">
          <button
            type="button"
            onClick={() => {
              soundEngine.playRemoteClick();
              setActiveTab('remote');
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'remote' ? 'text-white underline underline-offset-8 decoration-[#FF4500]' : ''
            }`}
          >
            Paper Tear Remote
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playRemoteClick();
              setActiveTab('ocular');
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'ocular' ? 'text-white underline underline-offset-8 decoration-[#FF4500]' : ''
            }`}
          >
            Ocular Ignition
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playRemoteClick();
              setActiveTab('physics');
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'physics' ? 'text-white underline underline-offset-8 decoration-[#FF4500]' : ''
            }`}
          >
            3D Relief Physics
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playRemoteClick();
              setMouseRipEnabled((v) => !v);
            }}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              mouseRipEnabled ? 'text-[#FF4500] underline underline-offset-8 decoration-[#FF4500]' : ''
            }`}
          >
            {mouseRipEnabled ? 'Cursor Rip: Active' : 'Cursor Rip Mode'}
          </button>
        </nav>

        {/* Zone 3: 2 Primary Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggleAudio}
            aria-label={isMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
            className="px-3 py-2 text-xs font-medium text-zinc-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-zinc-400" /> : <Volume2 className="w-3.5 h-3.5 text-[#FF4500]" />}
            <span>{isMuted ? 'Sound Off' : 'Sound FX'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleTriggerPaperTear()}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#FF4500] hover:bg-[#e03d00] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-lg shadow-[#FF4500]/25"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Rip Paper State</span>
          </button>
        </div>
      </header>

      {/* =====================================================================
          CALIBRATION BANNER (Only visible when user clicks "Calibrate Eye Sockets")
      ===================================================================== */}
      {calibrateStep !== 'off' && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 bg-black/85 backdrop-blur-md border border-[#FF4500] px-5 py-3 rounded-xl flex items-center gap-4 shadow-2xl">
          <Crosshair className="w-4 h-4 text-[#FF4500] shrink-0" />
          <p className="text-xs font-medium text-white whitespace-nowrap">
            {calibrateStep === 'left'
              ? 'Step 1 of 2: Click directly on the boy’s LEFT EYE on the 3D portrait'
              : 'Step 2 of 2: Now click directly on the boy’s RIGHT EYE on the 3D portrait'}
          </p>
          <button
            type="button"
            onClick={() => setCalibrateStep('off')}
            className="px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white bg-white/10 rounded-md whitespace-nowrap"
          >
            Cancel
          </button>
        </div>
      )}

      {/* =====================================================================
          LEFT PERIMETER HUD: PROTAGONIST DOSSIER & STATE DECK (Z-10)
      ===================================================================== */}
      <aside className="fixed left-6 top-20 bottom-6 z-10 w-80 hidden lg:flex flex-col justify-between pointer-events-none">
        {/* Top Protagonist Identity Card */}
        <div className="pointer-events-auto bg-black/55 backdrop-blur-md border border-white/10 rounded-xl p-5 flex flex-col gap-4">
          {/* Unboxed clean metadata with typographic separators (Zero-Pill Discipline) */}
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
            <span>com.webapp.gtasg2</span>
            <span aria-hidden="true">·</span>
            <span>State {currentState.index}</span>
            <span aria-hidden="true">·</span>
            <span>3D Relief</span>
          </div>

          <div>
            <h1
              className="font-display text-2xl font-bold tracking-tight text-white leading-tight"
              style={{ textWrap: 'balance' }}
            >
              {currentState.index}. {currentState.name}
            </h1>
            <p className="text-xs text-amber-400/90 mt-1 font-medium">
              {currentState.hindiSubtitle}
            </p>
            <p className="text-xs text-zinc-300 mt-2.5 leading-relaxed">
              {currentState.description}
            </p>
          </div>

          {/* Live Ocular Thermal Ignition Meter */}
          <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-[#FF4500]" />
                <span>Ocular Flame Ignition</span>
              </span>
              <span className="font-mono font-semibold text-white tabular-nums">
                {ignitionPercent}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-sm overflow-hidden">
              <div
                className="h-full transition-transform duration-150 origin-left"
                style={{
                  backgroundColor: flamePreset.primaryHex,
                  transform: `scaleX(${Math.max(0.05, telemetry.eyeIgnition)})`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Move mouse to ignite eyes</span>
              <span className="font-mono tabular-nums">{currentState.stats.thermalOutput}</span>
            </div>
          </div>
        </div>

        {/* Bottom 3-State Persona Switcher (Triggers Paper Tear on Click) */}
        <div className="pointer-events-auto bg-black/55 backdrop-blur-md border border-white/10 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-semibold text-zinc-200">Protagonist States</span>
            <span>Click to Rip Paper</span>
          </div>

          <div className="flex flex-col gap-2">
            {PROTAGONIST_STATES.map((st, idx) => {
              const isCurrent = idx === currentStateIdx;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => handleTriggerPaperTear(idx)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center gap-3 ${
                    isCurrent
                      ? 'bg-white/12 border-[#FF4500] text-white'
                      : 'bg-white/4 border-white/8 text-zinc-300 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  {/* Thumbnail with mandatory referrerPolicy & fallback background */}
                  <div className="w-10 h-12 rounded-md overflow-hidden bg-zinc-800 shrink-0 border border-white/10">
                    <img
                      src={st.imageUrl}
                      alt={st.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono text-zinc-400 tabular-nums">
                        {st.index}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400 truncate">
                        {isCurrent ? 'Active Layer' : 'Tear to Reveal'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-white truncate mt-0.5">
                      {st.name.replace('Aryan Vance — ', '')}
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate">{st.location}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* =====================================================================
          RIGHT PERIMETER HUD: INTERACTIVE REMOTE TRANSITION CONTROLLER (Z-10)
          "remote transition se idhar ekadam paper fatane jaise"
      ===================================================================== */}
      <aside className="fixed right-6 top-20 bottom-6 z-10 w-80 flex flex-col justify-between pointer-events-none">
        <div className="pointer-events-auto bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-5 flex flex-col gap-4 max-h-full overflow-y-auto">
          {/* Remote Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h2 className="font-display text-base font-bold text-white tracking-tight">
                Remote Transition Controller
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Paper Tear & Ocular Ignition Deck
              </p>
            </div>
            <span className="text-xs font-mono text-zinc-400 tabular-nums">
              [{ currentState.index } → { queuedState.index }]
            </span>
          </div>

          {/* Segmented Interactive Mode Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-white/5 rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => {
                soundEngine.playRemoteClick();
                setActiveTab('remote');
              }}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap truncate ${
                activeTab === 'remote'
                  ? 'bg-[#FF4500] text-white'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              Paper Rip
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playRemoteClick();
                setActiveTab('ocular');
              }}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap truncate ${
                activeTab === 'ocular'
                  ? 'bg-[#FF4500] text-white'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              Eye Fire
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playRemoteClick();
                setActiveTab('physics');
              }}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap truncate ${
                activeTab === 'physics'
                  ? 'bg-[#FF4500] text-white'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              3D Sculpt
            </button>
          </div>

          {/* =================================================================
              TAB 1: PAPER TEAR REMOTE CONTROLS
          ================================================================= */}
          {activeTab === 'remote' && (
            <div className="flex flex-col gap-4">
              {/* Primary Remote Trigger Button */}
              <button
                type="button"
                onClick={() => handleTriggerPaperTear()}
                className="w-full py-3.5 px-4 bg-[#FF4500] hover:bg-[#e03d00] active:scale-[0.99] text-white font-semibold text-sm rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#FF4500]/25 whitespace-nowrap"
              >
                <Scissors className="w-4 h-4" />
                <span>Trigger Paper Tear Transition</span>
              </button>

              {/* 4 Paper Tear Geometry Styles */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">Paper Tear Style</span>
                  <span className="text-zinc-400 font-mono">4 Modes</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {PAPER_TEAR_MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playRemoteClick();
                        setTearMode(m.id);
                      }}
                      className={`px-3 py-2 text-left rounded-lg border transition-colors ${
                        tearMode === m.id
                          ? 'bg-white/15 border-[#FF4500] text-white'
                          : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-xs font-semibold whitespace-nowrap truncate">
                        {m.shortLabel}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {m.hindiDesc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Interactive Cursor Paper-Rip Mode ("Mouse se Paper Phado") */}
              <div className="pt-3 border-t border-white/10 flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">Live Cursor Paper Tear</span>
                  <span className="font-mono text-zinc-400 tabular-nums">
                    {scratchPercent}% Torn
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playRemoteClick();
                      setMouseRipEnabled((v) => !v);
                    }}
                    className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap truncate ${
                      mouseRipEnabled
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-white/5 border-white/10 text-zinc-300 hover:text-white'
                    }`}
                  >
                    {mouseRipEnabled ? 'Cursor Rip: ON (Move to Tear)' : 'Enable Cursor Hover Rip'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playRemoteClick();
                      setClearScratchCounter((c) => c + 1);
                    }}
                    title="Re-paste torn paper"
                    className="p-2 text-xs text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors shrink-0"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Tip: You can also click and drag directly across the 3D portrait at any time to rip fibrous paper strips by hand.
                </p>
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 2: OCULAR IGNITION ("Aankhen Bhi Jal Jaaye")
          ================================================================= */}
          {activeTab === 'ocular' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-zinc-300">
                  Eye Ignition Trigger Mode
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playRemoteClick();
                      setAlwaysBurnEyes(false);
                    }}
                    className={`px-3 py-2.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap truncate ${
                      !alwaysBurnEyes
                        ? 'bg-white/15 border-[#FF4500] text-white'
                        : 'bg-white/5 border-white/10 text-zinc-300 hover:text-white'
                    }`}
                  >
                    Mouse Motion Burn
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playRemoteClick();
                      setAlwaysBurnEyes(true);
                    }}
                    className={`px-3 py-2.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap truncate ${
                      alwaysBurnEyes
                        ? 'bg-white/15 border-[#FF4500] text-white'
                        : 'bg-white/5 border-white/10 text-zinc-300 hover:text-white'
                    }`}
                  >
                    100% Inferno Lock
                  </button>
                </div>
              </div>

              {/* Flame Color Spectrum Presets */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-zinc-300">
                  Ocular Flame Spectrum
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {FLAME_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playRemoteClick();
                        setFlamePreset(preset);
                      }}
                      className={`px-3 py-2 rounded-lg border text-left transition-colors flex items-center gap-2.5 ${
                        flamePreset.id === preset.id
                          ? 'bg-white/15 border-white text-white'
                          : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: preset.primaryHex }}
                      />
                      <span className="text-xs font-medium whitespace-nowrap truncate">
                        {preset.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Eye Socket Calibration */}
              <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">Eye Socket Coordinates</span>
                  <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                    Auto-Aligned
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playRemoteClick();
                    setCalibrateStep(calibrateStep === 'off' ? 'left' : 'off');
                  }}
                  className="w-full py-2 px-3 text-xs font-medium text-zinc-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Crosshair className="w-3.5 h-3.5 text-[#FF4500]" />
                  <span>
                    {calibrateStep === 'off'
                      ? 'Custom Click-Calibrate Eye Sockets'
                      : 'Cancel Eye Calibration'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 3: 3D SCULPT & PAPER TEAR PHYSICS SLIDERS
          ================================================================= */}
          {activeTab === 'physics' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300">3D Facial Relief Depth</span>
                  <span className="font-mono text-zinc-400 tabular-nums">
                    {Math.round(depthStrength * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.15"
                  max="1.25"
                  step="0.05"
                  value={depthStrength}
                  onChange={(e) => setDepthStrength(parseFloat(e.target.value))}
                  className="w-full accent-[#FF4500] cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300">3D Paper Peel Curl</span>
                  <span className="font-mono text-zinc-400 tabular-nums">
                    {Math.round(paperCurl * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.4"
                  step="0.05"
                  value={paperCurl}
                  onChange={(e) => setPaperCurl(parseFloat(e.target.value))}
                  className="w-full accent-[#FF4500] cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300">Paper Fiber Jaggedness</span>
                  <span className="font-mono text-zinc-400 tabular-nums">
                    {tearJaggedness.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="4.0"
                  max="15.0"
                  step="0.5"
                  value={tearJaggedness}
                  onChange={(e) => setTearJaggedness(parseFloat(e.target.value))}
                  className="w-full accent-[#FF4500] cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playRemoteClick();
                  setDepthStrength(0.68);
                  setPaperCurl(0.75);
                  setTearJaggedness(8.5);
                }}
                className="w-full py-2 px-3 text-xs font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Reset Default 3D Physics</span>
              </button>
            </div>
          )}

          {/* Bottom Interactive Guide Footer inside Remote */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-400">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#FF4500]" />
              <span>Move Mouse: Ignite Eyes</span>
            </span>
            <span className="font-mono">[Space] Rip Paper</span>
          </div>
        </div>
      </aside>

      {/* =====================================================================
          MOBILE / COMPACT BOTTOM BAR (Only on smaller screens < lg)
      ===================================================================== */}
      <div className="fixed bottom-4 left-4 right-4 z-10 flex lg:hidden items-center justify-between gap-3 bg-black/75 backdrop-blur-md border border-white/10 px-4 py-3 rounded-xl pointer-events-auto">
        <div className="min-w-0">
          <p className="text-xs font-bold text-white truncate">{currentState.name}</p>
          <p className="text-[11px] text-zinc-400 truncate">
            Move / Touch to Ignite Eyes · Tap Rip for Paper Tear
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleTriggerPaperTear()}
          className="px-3.5 py-2 text-xs font-semibold text-white bg-[#FF4500] rounded-lg whitespace-nowrap shrink-0"
        >
          Rip Paper
        </button>
      </div>
    </div>
  );
}
