'use client';

import { useEffect, useState } from 'react';
import {
  Radio, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, AlertCircle, X, Activity, RotateCcw, Axis3d, Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  DEFAULT_VMC_CONFIG,
  isVmcReceivingActive,
  vmcReceivedState,
  type VmcConfig,
  type VmcReceiveConfig,
  type VmcSendConfig,
} from '@/lib/vmc/vmc';

interface VmcPanelProps {
  config: VmcConfig;
  onChange: (config: VmcConfig) => void;
  onResetAvatar?: () => void;
  onClose: () => void;
}

interface ReceiveSocketStatus {
  listening: boolean;
  port: number;
  error: string | null;
}

function CompactSwitch({
  id,
  label,
  hint,
  icon,
  checked,
  onCheckedChange,
  accentClass,
}: {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  accentClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 bg-zinc-800/35 border border-zinc-800/80 hover:bg-zinc-800/55 transition-colors">
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {icon && <span className="text-zinc-400 shrink-0">{icon}</span>}
        <div className="min-w-0 flex-1">
          <Label htmlFor={id} className={cn('text-[11px] font-medium text-zinc-100 cursor-pointer block truncate', accentClass)}>
            {label}
          </Label>
          {hint && (
            <p className="text-[9px] text-zinc-500 leading-tight truncate" title={hint}>{hint}</p>
          )}
        </div>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} className="scale-90 shrink-0" />
    </div>
  );
}

export function VmcPanel({ config, onChange, onResetAvatar, onClose }: VmcPanelProps) {
  const { receive, send } = config;

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

  return (
    <Card className={cn(
      'w-[740px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-4rem)] flex flex-col bg-zinc-900/95 border-zinc-800',
      'backdrop-blur-md shadow-2xl shadow-black/70 text-zinc-100 overflow-hidden',
    )}>
      {/* Header bar */}
      <CardHeader className="py-2 px-3.5 shrink-0 border-b border-zinc-800/80">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn(
              'flex items-center justify-center rounded-md w-6 h-6 shrink-0',
              (receive.enabled || send.enabled)
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-zinc-800 text-zinc-400',
            )}>
              <Radio className="w-3.5 h-3.5" />
            </span>
            <div className="min-w-0 flex items-center gap-2">
              <CardTitle className="text-xs font-semibold tracking-wide text-zinc-200">
                VMC Protocol
              </CardTitle>
              <span className="text-[10px] text-zinc-500">·</span>
              <p className="text-[11px] text-zinc-400 truncate">
                Receiving (Marionette) &amp; Sending (Performer)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {receive.enabled && (
              <Badge className={cn(
                'text-[9px] px-1.5 py-0 h-4 font-mono',
                receivingTraffic
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-sky-500/15 text-sky-300 border-sky-500/40',
              )}>
                RX {receivingTraffic ? 'TRACKING' : `:${receive.port}`}
              </Badge>
            )}
            {send.enabled && (
              <Badge className="text-[9px] px-1.5 py-0 h-4 bg-violet-500/20 text-violet-300 border-violet-500/40 font-mono">
                TX :{send.port}
              </Badge>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-zinc-400 hover:text-zinc-100"
              onClick={onClose}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 flex-1 min-h-0 flex flex-col overflow-hidden">
        <Tabs defaultValue="receive" className="w-full flex-1 min-h-0 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 bg-zinc-800/60 h-7 shrink-0">
            <TabsTrigger value="receive" className="text-[10px] uppercase tracking-wider flex items-center gap-1.5 py-0.5">
              <ArrowDownToLine className="w-3 h-3 text-emerald-400" />
              Receiving (Recibir Movimiento)
            </TabsTrigger>
            <TabsTrigger value="send" className="text-[10px] uppercase tracking-wider flex items-center gap-1.5 py-0.5">
              <ArrowUpFromLine className="w-3 h-3 text-violet-400" />
              Sending (Enviar Movimiento)
            </TabsTrigger>
          </TabsList>

          {/* ==================== TAB 1: RECEIVING (HORIZONTAL 2-COLUMN LAYOUT) ==================== */}
          <TabsContent value="receive" className="mt-2.5 flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              {/* LEFT COLUMN: Connection & Data Parts */}
              <div className="space-y-2.5">
                {/* Enable + Status Card */}
                <div className="rounded-lg p-2.5 bg-zinc-800/40 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Label htmlFor="vmc-receive-enable" className="text-xs font-semibold text-emerald-300 cursor-pointer">
                        Enable VMC Protocol (Receive)
                      </Label>
                      <p className="text-[10px] text-zinc-400 leading-tight">
                        Receive motion from VRM Posing Desktop, VSeeFace, LuppetX, VMagicMirror
                      </p>
                    </div>
                    <Switch
                      id="vmc-receive-enable"
                      checked={receive.enabled}
                      onCheckedChange={(v) => {
                        setReceive('enabled', v);
                        if (!v) onResetAvatar?.();
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {socketStatus.error ? (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      ) : receivingTraffic ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Activity className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      )}
                      <span className="text-[10px] text-zinc-300 truncate">
                        {!receive.enabled
                          ? 'Receiver disabled'
                          : socketStatus.error
                            ? socketStatus.error
                            : receivingTraffic
                              ? `Live (${boneCount} bones · ${packetCount} pkts)`
                              : `Listening on UDP port ${receive.port}…`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[9px] text-zinc-400">Port:</span>
                      <input
                        type="number"
                        min={1}
                        max={65535}
                        value={recvPortInput}
                        onChange={(e) => setRecvPortInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleApplyReceivePort(); }}
                        className="w-16 bg-zinc-900/90 border border-zinc-700 rounded px-1.5 py-0.5 text-[11px] text-zinc-100 tabular-nums text-right focus:outline-none focus:border-emerald-500/60"
                        title="UDP Port (default 39539)"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleApplyReceivePort}
                        className="h-6 px-2 text-[10px] bg-emerald-600/20 border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/30"
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Data to Apply */}
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 px-0.5">
                    Data to apply (Partes a trackear)
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <CompactSwitch
                      id="vmc-recv-upper"
                      label="Upper Body"
                      hint="Head, spine, arms"
                      checked={receive.applyUpperBody}
                      onCheckedChange={(v) => setReceive('applyUpperBody', v)}
                    />
                    <CompactSwitch
                      id="vmc-recv-hand"
                      label="Hands & Fingers"
                      hint="30 finger bones"
                      checked={receive.applyHand}
                      onCheckedChange={(v) => setReceive('applyHand', v)}
                    />
                    <CompactSwitch
                      id="vmc-recv-leg"
                      label="Legs & Feet"
                      hint="Upper/lower legs"
                      checked={receive.applyLeg}
                      onCheckedChange={(v) => setReceive('applyLeg', v)}
                    />
                    <CompactSwitch
                      id="vmc-recv-face"
                      label="Facial (BlendShape)"
                      hint="Expressions & mouth"
                      checked={receive.applyBlendShape}
                      onCheckedChange={(v) => setReceive('applyBlendShape', v)}
                    />
                  </div>

                  {/* Dedicated Eye Bones Switch */}
                  <CompactSwitch
                    id="vmc-recv-eye"
                    label="Eye Bones (Ojos VMC)"
                    hint="Off = ojos siguen ratón/gaze natural; On = rotar por VMC"
                    icon={<Eye className="w-3.5 h-3.5" />}
                    checked={receive.applyEye}
                    onCheckedChange={(v) => setReceive('applyEye', v)}
                    accentClass={receive.applyEye ? 'text-amber-300' : 'text-zinc-200'}
                  />
                </div>
              </div>

              {/* RIGHT COLUMN: Axis Calibration & Motion Options */}
              <div className="space-y-2.5">
                {/* Axis Calibration */}
                <div className="rounded-lg p-2.5 bg-zinc-800/30 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-amber-300 flex items-center gap-1">
                      <Axis3d className="w-3.5 h-3.5" /> Axis Calibration (Ejes de Rotación)
                    </span>
                    <button
                      type="button"
                      onClick={() => applyAxisPreset('vrm0_unity')}
                      className="text-[9px] text-zinc-400 hover:text-zinc-100 flex items-center gap-1"
                      title="Reset axes to standard Unity VMC"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> Reset Default
                    </button>
                  </div>

                  {/* Presets */}
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => applyAxisPreset('vrm0_unity')}
                      className={cn(
                        'text-[9px] py-1 px-1 rounded border transition-colors truncate',
                        !receive.invertX && receive.invertY && receive.invertZ && !receive.mirrorLeftRight
                          ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-100 font-medium'
                          : 'bg-zinc-900/50 border-zinc-700/60 text-zinc-400 hover:text-zinc-200',
                      )}
                    >
                      Unity Standard
                    </button>
                    <button
                      type="button"
                      onClick={() => applyAxisPreset('mirror_z')}
                      className={cn(
                        'text-[9px] py-1 px-1 rounded border transition-colors truncate',
                        receive.invertX && receive.invertY && !receive.invertZ && !receive.mirrorLeftRight
                          ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-100 font-medium'
                          : 'bg-zinc-900/50 border-zinc-700/60 text-zinc-400 hover:text-zinc-200',
                      )}
                    >
                      Invert X+Y (Z-Flip)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyAxisPreset('vrm1_direct')}
                      className={cn(
                        'text-[9px] py-1 px-1 rounded border transition-colors truncate',
                        !receive.invertX && !receive.invertY && !receive.invertZ && !receive.mirrorLeftRight
                          ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-100 font-medium'
                          : 'bg-zinc-900/50 border-zinc-700/60 text-zinc-400 hover:text-zinc-200',
                      )}
                    >
                      Raw (Direct)
                    </button>
                  </div>

                  {/* Individual Inversion Switches */}
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <CompactSwitch
                      id="vmc-axis-x"
                      label="Invert X (Pitch)"
                      hint="Up / Down tilt"
                      checked={receive.invertX}
                      onCheckedChange={(v) => setReceive('invertX', v)}
                    />
                    <CompactSwitch
                      id="vmc-axis-y"
                      label="Invert Y (Yaw)"
                      hint="Left / Right twist"
                      checked={receive.invertY}
                      onCheckedChange={(v) => setReceive('invertY', v)}
                    />
                    <CompactSwitch
                      id="vmc-axis-z"
                      label="Invert Z (Roll)"
                      hint="Arm raise / Side tilt"
                      checked={receive.invertZ}
                      onCheckedChange={(v) => setReceive('invertZ', v)}
                    />
                    <CompactSwitch
                      id="vmc-axis-mirror"
                      label="Swap Left ↔ Right"
                      hint="Mirror L/R bones"
                      checked={receive.mirrorLeftRight}
                      onCheckedChange={(v) => setReceive('mirrorLeftRight', v)}
                    />
                  </div>
                </div>

                {/* Pose & Position Options */}
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 px-0.5">
                    Pose &amp; Position Options
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <CompactSwitch
                      id="vmc-recv-smooth"
                      label="Smooth Pose"
                      hint="Slerp anti-jitter"
                      checked={receive.smoothPose}
                      onCheckedChange={(v) => setReceive('smoothPose', v)}
                    />
                    <CompactSwitch
                      id="vmc-recv-spine-base"
                      label="Add Idle Sway"
                      hint="Natural breathing"
                      checked={receive.applySpineBase}
                      onCheckedChange={(v) => setReceive('applySpineBase', v)}
                    />
                    <CompactSwitch
                      id="vmc-recv-hips-pos"
                      label="Hips Position"
                      hint="Relative translation"
                      checked={receive.applyHipsPosition}
                      onCheckedChange={(v) => setReceive('applyHipsPosition', v)}
                    />
                    <CompactSwitch
                      id="vmc-recv-root"
                      label="Root Transform"
                      hint="/VMC/Ext/Root/Pos"
                      checked={receive.applyRoot}
                      onCheckedChange={(v) => setReceive('applyRoot', v)}
                    />
                  </div>

                  {/* Quick Reset Pose & Position Button */}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onResetAvatar?.()}
                    className="w-full h-6 text-[10px] bg-zinc-800/60 border-zinc-700 hover:bg-zinc-700 hover:text-white text-zinc-300 mt-1"
                  >
                    <RotateCcw className="w-3 h-3 mr-1 text-emerald-400" />
                    Reset Pose &amp; Position to Default
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ==================== TAB 2: SENDING (HORIZONTAL 2-COLUMN LAYOUT) ==================== */}
          <TabsContent value="send" className="mt-2.5 flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              {/* LEFT COLUMN: Target & Master Enable */}
              <div className="space-y-2.5">
                <div className="rounded-lg p-2.5 bg-zinc-800/40 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Label htmlFor="vmc-send-enable" className="text-xs font-semibold text-violet-300 cursor-pointer">
                        Enable VMC Protocol (Send)
                      </Label>
                      <p className="text-[10px] text-zinc-400 leading-tight">
                        Broadcast motion as Performer via UDP OSC
                      </p>
                    </div>
                    <Switch
                      id="vmc-send-enable"
                      checked={send.enabled}
                      onCheckedChange={(v) => setSend('enabled', v)}
                    />
                  </div>

                  <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                    <div className="grid grid-cols-3 gap-1.5 items-end">
                      <div className="col-span-2 space-y-0.5">
                        <span className="text-[9px] text-zinc-400">Target IP / Host</span>
                        <input
                          type="text"
                          value={sendHostInput}
                          onChange={(e) => setSendHostInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleApplySendTarget(); }}
                          className="w-full bg-zinc-900/90 border border-zinc-700 rounded px-2 py-0.5 text-[11px] text-zinc-100 font-mono focus:outline-none focus:border-violet-500/60"
                          placeholder="127.0.0.1"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-zinc-400">Port</span>
                        <input
                          type="number"
                          min={1}
                          max={65535}
                          value={sendPortInput}
                          onChange={(e) => setSendPortInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleApplySendTarget(); }}
                          className="w-full bg-zinc-900/90 border border-zinc-700 rounded px-1.5 py-0.5 text-[11px] text-zinc-100 tabular-nums text-right font-mono focus:outline-none focus:border-violet-500/60"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleApplySendTarget}
                      className="w-full h-6 text-[10px] bg-violet-600/20 border-violet-500/40 text-violet-200 hover:bg-violet-600/30"
                    >
                      Apply Target Destination
                    </Button>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: What to Send & Options */}
              <div className="space-y-2.5">
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 px-0.5">
                    Data to send (Datos a emitir)
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <CompactSwitch
                      id="vmc-send-bones"
                      label="Bone Poses"
                      hint="Head, spine, arms"
                      checked={send.sendBonePoses}
                      onCheckedChange={(v) => setSend('sendBonePoses', v)}
                    />
                    <CompactSwitch
                      id="vmc-send-fingers"
                      label="Finger Bones"
                      hint="30 finger joints"
                      checked={send.sendFingerBonePoses}
                      onCheckedChange={(v) => setSend('sendFingerBonePoses', v)}
                    />
                    <CompactSwitch
                      id="vmc-send-blend"
                      label="Standard Facial"
                      hint="Joy, Sorrow, A, I..."
                      checked={send.sendBlendShapeData}
                      onCheckedChange={(v) => setSend('sendBlendShapeData', v)}
                    />
                    <CompactSwitch
                      id="vmc-send-custom-blend"
                      label="Custom Morphs"
                      hint="All model morphs"
                      checked={send.sendCustomBlendShape}
                      onCheckedChange={(v) => setSend('sendCustomBlendShape', v)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 px-0.5">
                    Transmission Options
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <CompactSwitch
                      id="vmc-send-vrm0-names"
                      label="VRM 0.x Names"
                      hint="Joy/Fun instead of happy/relaxed"
                      checked={send.convertToVrm0BlendShapeName}
                      onCheckedChange={(v) => setSend('convertToVrm0BlendShapeName', v)}
                    />
                    <CompactSwitch
                      id="vmc-send-rate"
                      label="Limit 30 FPS"
                      hint="Saves network bandwidth"
                      checked={send.limitDataRate30}
                      onCheckedChange={(v) => setSend('limitDataRate30', v)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
