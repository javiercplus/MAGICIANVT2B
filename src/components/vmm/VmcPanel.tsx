'use client';

import { useEffect, useState } from 'react';
import {
  Radio, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, AlertCircle, Activity, RotateCcw, Axis3d, Eye, Sparkles, Smile,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  isVmcReceivingActive,
  vmcReceivedState,
  PERFECT_SYNC_CLIP_NAMES,
  type VmcConfig,
  type VmcReceiveConfig,
  type VmcSendConfig,
} from '@/lib/vmc/vmc';

interface VmcPanelProps {
  config: VmcConfig;
  modelPerfectSyncCount?: number;
  onChange: (config: VmcConfig) => void;
  onResetAvatar?: () => void;
  onClose: () => void;
}

interface ReceiveSocketStatus {
  listening: boolean;
  port: number;
  error: string | null;
}

function XpCheckItem({
  id,
  label,
  hint,
  icon,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        'border border-[#d0d0bf] bg-[#f8f7f1] px-2 py-1 rounded-[2px]',
        disabled && 'opacity-50 pointer-events-none',
      )}
      data-no-drag
    >
      <div className="field-row">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange(e.target.checked)}
        />
        <label htmlFor={id} className="text-[11px] font-semibold text-[#111] cursor-pointer flex items-center gap-1">
          {icon}
          <span>{label}</span>
        </label>
      </div>
      {hint && (
        <p className="text-[9.5px] text-[#555] leading-tight pl-4 mt-0.5 truncate" title={hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function VmcPanel({
  config,
  modelPerfectSyncCount = 0,
  onChange,
  onResetAvatar,
  onClose,
}: VmcPanelProps) {
  const { receive, send } = config;
  const [activeTab, setActiveTab] = useState<'receive' | 'send'>('receive');

  const [recvPortInput, setRecvPortInput] = useState<string>(String(receive.port));
  const [sendHostInput, setSendHostInput] = useState<string>(send.host);
  const [sendPortInput, setSendPortInput] = useState<string>(String(send.port));

  const [socketStatus, setSocketStatus] = useState<ReceiveSocketStatus>({
    listening: receive.enabled,
    port: receive.port,
    error: null,
  });
  const [receivingTraffic, setReceivingTraffic] = useState(false);
  const [packetCount, setPacketCount] = useState(0);
  const [boneCount, setBoneCount] = useState(0);
  const [rxPerfectSyncCount, setRxPerfectSyncCount] = useState(0);

  useEffect(() => {
    setRecvPortInput(String(receive.port));
  }, [receive.port]);

  useEffect(() => {
    setSendHostInput(send.host);
    setSendPortInput(String(send.port));
  }, [send.host, send.port]);

  useEffect(() => {
    const api = (window as unknown as {
      electronAPI?: {
        onVmcReceiveStatus?: (cb: (status: ReceiveSocketStatus) => void) => () => void;
      };
    }).electronAPI;
    if (!api?.onVmcReceiveStatus) return;
    const unsub = api.onVmcReceiveStatus((status) => {
      setSocketStatus(status);
    });
    return () => {
      unsub?.();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const active = receive.enabled && isVmcReceivingActive();
      setReceivingTraffic(active);
      setPacketCount(vmcReceivedState.packetCount);
      setBoneCount(Object.keys(vmcReceivedState.bones).length);
      setRxPerfectSyncCount(vmcReceivedState.perfectSyncActiveCount);
    }, 300);
    return () => clearInterval(timer);
  }, [receive.enabled]);

  const setReceive = <K extends keyof VmcReceiveConfig>(key: K, value: VmcReceiveConfig[K]) => {
    onChange({
      ...config,
      receive: { ...receive, [key]: value },
    });
  };

  const setSend = <K extends keyof VmcSendConfig>(key: K, value: VmcSendConfig[K]) => {
    onChange({
      ...config,
      send: { ...send, [key]: value },
    });
  };

  const handleApplyReceivePort = () => {
    const p = Number(recvPortInput);
    if (!Number.isInteger(p) || p < 1 || p > 65535) return;
    setReceive('port', p);
  };

  const handleApplySendTarget = () => {
    const p = Number(sendPortInput);
    const validPort = Number.isInteger(p) && p >= 1 && p <= 65535 ? p : send.port;
    const validHost = sendHostInput.trim() || '127.0.0.1';
    onChange({
      ...config,
      send: {
        ...send,
        host: validHost,
        port: validPort,
      },
    });
  };

  const applyAxisPreset = (preset: 'vrm0_unity' | 'vrm1_direct' | 'mirror_z') => {
    if (preset === 'vrm0_unity') {
      onChange({
        ...config,
        receive: { ...receive, invertX: false, invertY: true, invertZ: true, mirrorLeftRight: false },
      });
    } else if (preset === 'vrm1_direct') {
      onChange({
        ...config,
        receive: { ...receive, invertX: false, invertY: false, invertZ: false, mirrorLeftRight: false },
      });
    } else if (preset === 'mirror_z') {
      onChange({
        ...config,
        receive: { ...receive, invertX: true, invertY: true, invertZ: false, mirrorLeftRight: false },
      });
    }
  };

  const totalPerfectSyncClips = PERFECT_SYNC_CLIP_NAMES.length;
  const hasModelPerfectSync = modelPerfectSyncCount > 0;

  return (
    <div className="window w-[740px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-4rem)] flex flex-col">
      <div className="title-bar shrink-0">
        <div className="title-bar-text flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5" />
          <span>VMC Protocol &amp; Perfect Sync — External Tracking (VMagicMirror / iOS ARKit)</span>
        </div>
        <div className="title-bar-controls">
          <button type="button" aria-label="Close" onClick={onClose} />
        </div>
      </div>

      <div className="window-body flex-1 min-h-0 flex flex-col overflow-hidden">
        <menu role="tablist" className="shrink-0">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'receive'}
            onClick={() => setActiveTab('receive')}
            className="flex items-center gap-1"
          >
            <ArrowDownToLine className="w-3 h-3 text-[#1d7a1d]" />
            <span>Receiving (Recibir / Perfect Sync)</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'send'}
            onClick={() => setActiveTab('send')}
            className="flex items-center gap-1"
          >
            <ArrowUpFromLine className="w-3 h-3 text-[#003399]" />
            <span>Sending (Enviar / Perfect Sync)</span>
          </button>
        </menu>

        <article role="tabpanel" className="flex-1 min-h-0 overflow-y-auto">
          {activeTab === 'receive' && (
            <div className="grid grid-cols-2 gap-2.5">
              {/* LEFT COLUMN: Connection, Perfect Sync & Data Parts */}
              <div className="space-y-2">
                <fieldset>
                  <legend>VMC Receiver Connection (UDP OSC)</legend>
                  <div className="space-y-2" data-no-drag>
                    <div className="field-row">
                      <input
                        id="vmc-receive-enable"
                        type="checkbox"
                        checked={receive.enabled}
                        onChange={(e) => {
                          setReceive('enabled', e.target.checked);
                          if (!e.target.checked) onResetAvatar?.();
                        }}
                      />
                      <label htmlFor="vmc-receive-enable" className="text-[11px] font-bold text-[#003399] cursor-pointer">
                        Enable VMC Protocol (Receive)
                      </label>
                    </div>
                    <p className="text-[10px] text-[#444] leading-tight">
                      Receive motion &amp; Perfect Sync from VMagicMirror, VSeeFace, Luppet, Vear
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#d0d0bf]">
                      <div className="flex items-center gap-1 min-w-0">
                        {socketStatus.error ? (
                          <AlertCircle className="w-3.5 h-3.5 text-[#b91c1c] shrink-0" />
                        ) : receivingTraffic ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#1d7a1d] shrink-0" />
                        ) : (
                          <Activity className="w-3.5 h-3.5 text-[#555] shrink-0" />
                        )}
                        <span className="text-[10px] text-[#222] truncate">
                          {!receive.enabled
                            ? 'Receiver disabled'
                            : socketStatus.error
                              ? socketStatus.error
                              : receivingTraffic
                                ? `Live (${boneCount} bones · ${rxPerfectSyncCount} ARKit)`
                                : `Listening on UDP :${receive.port}…`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <label htmlFor="vmc-recv-port" className="text-[10px] text-[#222]">Port:</label>
                        <input
                          id="vmc-recv-port"
                          type="number"
                          min={1}
                          max={65535}
                          value={recvPortInput}
                          onChange={(e) => setRecvPortInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleApplyReceivePort(); }}
                          className="w-16 text-right font-mono text-[11px]"
                          title="UDP Port (default 39539)"
                        />
                        <button
                          type="button"
                          onClick={handleApplyReceivePort}
                          className="xp-compact-btn"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 inline mr-1" />
                    Ex.Tracker · Perfect Sync (52 ARKit BlendShapes)
                  </legend>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] bg-[#f8f7f1] border border-[#d0d0bf] px-2 py-1">
                      <span className="text-[#222] font-semibold">VRM Perfect Sync Status:</span>
                      <span className={cn('font-mono font-bold', hasModelPerfectSync ? 'text-[#1d7a1d]' : 'text-[#b45309]')}>
                        {hasModelPerfectSync
                          ? `${modelPerfectSyncCount}/${totalPerfectSyncClips} clips ready`
                          : 'Standard VRM Fallback'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <XpCheckItem
                        id="vmc-recv-perfect-sync"
                        label="Use Perfect Sync"
                        hint="Map 52 iOS ARKit BlendShapeClips"
                        icon={<Smile className="w-3 h-3 text-[#003399]" />}
                        checked={receive.usePerfectSync}
                        onCheckedChange={(v) => setReceive('usePerfectSync', v)}
                        disabled={!receive.applyBlendShape}
                      />
                      <XpCheckItem
                        id="vmc-recv-ps-fallback"
                        label="Standard VRM Fallback"
                        hint="ARKit → A/I/U/E/O/Blink if missing"
                        checked={receive.perfectSyncFallback}
                        onCheckedChange={(v) => setReceive('perfectSyncFallback', v)}
                        disabled={!receive.applyBlendShape}
                      />
                    </div>

                    <p className="text-[10px] text-[#444] leading-snug">
                      Compatible with <strong>VMagicMirror</strong> (Ex.Tracker → Use Perfect Sync),{' '}
                      <strong>HANA_Tool</strong>, <strong>Vear</strong> &amp; <strong>Luppet</strong>.
                    </p>
                  </div>
                </fieldset>

                <fieldset>
                  <legend>Data to Apply (Partes a trackear)</legend>
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <XpCheckItem
                        id="vmc-recv-upper"
                        label="Upper Body"
                        hint="Head, spine, arms"
                        checked={receive.applyUpperBody}
                        onCheckedChange={(v) => setReceive('applyUpperBody', v)}
                      />
                      <XpCheckItem
                        id="vmc-recv-hand"
                        label="Hands & Fingers"
                        hint="30 finger bones"
                        checked={receive.applyHand}
                        onCheckedChange={(v) => setReceive('applyHand', v)}
                      />
                      <XpCheckItem
                        id="vmc-recv-leg"
                        label="Legs & Feet"
                        hint="Upper/lower legs"
                        checked={receive.applyLeg}
                        onCheckedChange={(v) => setReceive('applyLeg', v)}
                      />
                      <XpCheckItem
                        id="vmc-recv-face"
                        label="Facial (BlendShape)"
                        hint="Expressions & Perfect Sync"
                        checked={receive.applyBlendShape}
                        onCheckedChange={(v) => setReceive('applyBlendShape', v)}
                      />
                    </div>
                    <XpCheckItem
                      id="vmc-recv-eye"
                      label="Eye Bones (Ojos VMC)"
                      hint="Off = ojos siguen ratón/ARKit; On = rotar huesos por VMC"
                      icon={<Eye className="w-3 h-3 text-[#003399]" />}
                      checked={receive.applyEye}
                      onCheckedChange={(v) => setReceive('applyEye', v)}
                    />
                  </div>
                </fieldset>
              </div>

              {/* RIGHT COLUMN: Axis Calibration & Motion Options */}
              <div className="space-y-2">
                <fieldset>
                  <legend>
                    <Axis3d className="w-3 h-3 inline mr-1" />
                    Axis Calibration (Ejes de Rotación)
                  </legend>
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => applyAxisPreset('vrm0_unity')}
                        className={cn(
                          'xp-compact-btn truncate',
                          !receive.invertX && receive.invertY && receive.invertZ && !receive.mirrorLeftRight && 'font-bold text-[#003399]',
                        )}
                      >
                        Unity Standard
                      </button>
                      <button
                        type="button"
                        onClick={() => applyAxisPreset('mirror_z')}
                        className={cn(
                          'xp-compact-btn truncate',
                          receive.invertX && receive.invertY && !receive.invertZ && !receive.mirrorLeftRight && 'font-bold text-[#003399]',
                        )}
                      >
                        Invert X+Y
                      </button>
                      <button
                        type="button"
                        onClick={() => applyAxisPreset('vrm1_direct')}
                        className={cn(
                          'xp-compact-btn truncate',
                          !receive.invertX && !receive.invertY && !receive.invertZ && !receive.mirrorLeftRight && 'font-bold text-[#003399]',
                        )}
                      >
                        Raw (Direct)
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <XpCheckItem
                        id="vmc-axis-x"
                        label="Invert X (Pitch)"
                        hint="Up / Down tilt"
                        checked={receive.invertX}
                        onCheckedChange={(v) => setReceive('invertX', v)}
                      />
                      <XpCheckItem
                        id="vmc-axis-y"
                        label="Invert Y (Yaw)"
                        hint="Left / Right twist"
                        checked={receive.invertY}
                        onCheckedChange={(v) => setReceive('invertY', v)}
                      />
                      <XpCheckItem
                        id="vmc-axis-z"
                        label="Invert Z (Roll)"
                        hint="Arm raise / Side tilt"
                        checked={receive.invertZ}
                        onCheckedChange={(v) => setReceive('invertZ', v)}
                      />
                      <XpCheckItem
                        id="vmc-axis-mirror"
                        label="Swap Left ↔ Right"
                        hint="Mirror L/R bones & ARKit"
                        checked={receive.mirrorLeftRight}
                        onCheckedChange={(v) => setReceive('mirrorLeftRight', v)}
                      />
                    </div>
                  </div>
                </fieldset>

                <fieldset>
                  <legend>Pose &amp; Position Options</legend>
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <XpCheckItem
                        id="vmc-recv-smooth"
                        label="Smooth Pose"
                        hint="Slerp anti-jitter"
                        checked={receive.smoothPose}
                        onCheckedChange={(v) => setReceive('smoothPose', v)}
                      />
                      <XpCheckItem
                        id="vmc-recv-spine-base"
                        label="Add Idle Sway"
                        hint="Natural breathing"
                        checked={receive.applySpineBase}
                        onCheckedChange={(v) => setReceive('applySpineBase', v)}
                      />
                      <XpCheckItem
                        id="vmc-recv-hips-pos"
                        label="Hips Position"
                        hint="Relative translation"
                        checked={receive.applyHipsPosition}
                        onCheckedChange={(v) => setReceive('applyHipsPosition', v)}
                      />
                      <XpCheckItem
                        id="vmc-recv-root"
                        label="Root Transform"
                        hint="/VMC/Ext/Root/Pos"
                        checked={receive.applyRoot}
                        onCheckedChange={(v) => setReceive('applyRoot', v)}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => onResetAvatar?.()}
                      className="w-full flex items-center justify-center gap-1 mt-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Pose &amp; Position to Default</span>
                    </button>
                  </div>
                </fieldset>
              </div>
            </div>
          )}

          {activeTab === 'send' && (
            <div className="grid grid-cols-2 gap-2.5">
              {/* LEFT COLUMN: Target & Master Enable */}
              <div className="space-y-2">
                <fieldset>
                  <legend>VMC Sender Destination (UDP OSC)</legend>
                  <div className="space-y-2" data-no-drag>
                    <div className="field-row">
                      <input
                        id="vmc-send-enable"
                        type="checkbox"
                        checked={send.enabled}
                        onChange={(e) => setSend('enabled', e.target.checked)}
                      />
                      <label htmlFor="vmc-send-enable" className="text-[11px] font-bold text-[#003399] cursor-pointer">
                        Enable VMC Protocol (Send)
                      </label>
                    </div>
                    <p className="text-[10px] text-[#444] leading-tight">
                      Broadcast motion &amp; Perfect Sync as Performer via UDP OSC
                    </p>

                    <div className="pt-1.5 border-t border-[#d0d0bf] space-y-2">
                      <div className="grid grid-cols-3 gap-1.5 items-end">
                        <div className="col-span-2">
                          <label htmlFor="vmc-send-host" className="block text-[10px] text-[#222] mb-0.5">
                            Target IP / Host
                          </label>
                          <input
                            id="vmc-send-host"
                            type="text"
                            value={sendHostInput}
                            onChange={(e) => setSendHostInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleApplySendTarget(); }}
                            className="w-full font-mono text-[11px]"
                            placeholder="127.0.0.1"
                          />
                        </div>
                        <div>
                          <label htmlFor="vmc-send-port" className="block text-[10px] text-[#222] mb-0.5">
                            Port
                          </label>
                          <input
                            id="vmc-send-port"
                            type="number"
                            min={1}
                            max={65535}
                            value={sendPortInput}
                            onChange={(e) => setSendPortInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleApplySendTarget(); }}
                            className="w-full text-right font-mono text-[11px]"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleApplySendTarget}
                        className="w-full"
                      >
                        Apply Target Destination
                      </button>
                    </div>
                  </div>
                </fieldset>
              </div>

              {/* RIGHT COLUMN: What to Send & Options */}
              <div className="space-y-2">
                <fieldset>
                  <legend>Data to Send (Datos a emitir)</legend>
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <XpCheckItem
                        id="vmc-send-bones"
                        label="Bone Poses"
                        hint="Head, spine, arms"
                        checked={send.sendBonePoses}
                        onCheckedChange={(v) => setSend('sendBonePoses', v)}
                      />
                      <XpCheckItem
                        id="vmc-send-fingers"
                        label="Finger Bones"
                        hint="30 finger joints"
                        checked={send.sendFingerBonePoses}
                        onCheckedChange={(v) => setSend('sendFingerBonePoses', v)}
                      />
                      <XpCheckItem
                        id="vmc-send-blend"
                        label="Standard Facial"
                        hint="Joy, Sorrow, A, I..."
                        checked={send.sendBlendShapeData}
                        onCheckedChange={(v) => setSend('sendBlendShapeData', v)}
                      />
                      <XpCheckItem
                        id="vmc-send-custom-blend"
                        label="Custom Morphs"
                        hint="Non-standard morphs"
                        checked={send.sendCustomBlendShape}
                        onCheckedChange={(v) => setSend('sendCustomBlendShape', v)}
                      />
                    </div>
                    <XpCheckItem
                      id="vmc-send-perfect-sync"
                      label="Perfect Sync (52 ARKit Clips)"
                      hint="Send BrowInnerUp, JawOpen, TongueOut via /VMC/Ext/Blend/Val"
                      icon={<Sparkles className="w-3 h-3 text-[#003399]" />}
                      checked={send.sendPerfectSync}
                      onCheckedChange={(v) => setSend('sendPerfectSync', v)}
                      disabled={!send.sendBlendShapeData}
                    />
                  </div>
                </fieldset>

                <fieldset>
                  <legend>Transmission Options</legend>
                  <div className="grid grid-cols-2 gap-1.5">
                    <XpCheckItem
                      id="vmc-send-vrm0-names"
                      label="VRM 0.x Names"
                      hint="Joy/Fun instead of happy/relaxed"
                      checked={send.convertToVrm0BlendShapeName}
                      onCheckedChange={(v) => setSend('convertToVrm0BlendShapeName', v)}
                    />
                    <XpCheckItem
                      id="vmc-send-rate"
                      label="Limit 30 FPS"
                      hint="Saves network bandwidth"
                      checked={send.limitDataRate30}
                      onCheckedChange={(v) => setSend('limitDataRate30', v)}
                    />
                  </div>
                </fieldset>
              </div>
            </div>
          )}
        </article>
      </div>

      <div className="status-bar shrink-0">
        <p className="status-bar-field">
          Perfect Sync: {modelPerfectSyncCount}/{totalPerfectSyncClips} clips
        </p>
        <p className="status-bar-field">
          RX: {receive.enabled ? (receivingTraffic ? `Tracking (${packetCount} pkts)` : `Listening :${receive.port}`) : 'Off'}
        </p>
        <p className="status-bar-field">
          TX: {send.enabled ? `${send.host}:${send.port}` : 'Off'}
        </p>
      </div>
    </div>
  );
}
