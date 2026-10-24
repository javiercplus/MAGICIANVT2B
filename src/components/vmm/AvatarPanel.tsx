'use client';

import { useMemo, useState } from 'react';
import {
  Upload, RotateCcw, Save, AlertCircle, Sparkles, Wand2, Dna, X, Shirt, Wind, Smile,
  Layers, Search, Eye, EyeOff, ChevronDown, ChevronRight, Boxes, FoldVertical, UnfoldVertical,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { LightSlider, StatusPill, type VrmStatus } from './controls';
import {
  DEFAULT_MTOON, DEFAULT_WIND, FACE_EMOTIONS, matchFaceEmotion,
  type MToonConfig, type ShaderConfig, type ShaderPreset, type WindConfig, type FacePreset,
} from '@/lib/vrm/constants';
import type { VrmMeshItem } from '@/lib/vrm/loadVRM';

const SHADER_PRESETS: { value: ShaderPreset; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'hologram', label: 'Hologram' },
  { value: 'dissolve', label: 'Dissolve' },
  { value: 'glow', label: 'Glow' },
  { value: 'scanline', label: 'Scanline' },
  { value: 'outline', label: 'Outline' },
  { value: 'chromatic', label: 'Chromatic' },
  { value: 'pixel', label: 'Pixel' },
];

const FACE_PRESET_BUTTONS: { value: FacePreset; label: string }[] = [
  { value: 'neutral', label: 'All neutral' },
  { value: 'fun', label: 'All fun' },
  { value: 'happy', label: 'Happy' },
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'surprised', label: 'Surprised' },
  { value: 'sad', label: 'Sad' },
  { value: 'angry', label: 'Angry' },
];

export function getMeshBaseName(rawName: string): string {
  let name = rawName.trim();
  // Strip clone, merged, instance, copy patterns
  name = name
    .replace(/[\s_.-]*\(clone\)|\(clone\)/gi, '')
    .replace(/[\s_.-]*\(merged\)|\(merged\)/gi, '')
    .replace(/[\s_.-]*\(instance\)|\(instance\)/gi, '')
    .replace(/[\s_.-]*copy\s*\d*/gi, '');

  // Strip trailing numeric indices: _0, _1, .001, (1), etc.
  name = name
    .replace(/[_\s.-]+\d+$/g, '')
    .replace(/\s*\(\d+\)$/g, '');

  // Strip trailing separators
  name = name.replace(/[_\s.-]+$/g, '').trim();

  return name || rawName;
}

interface MeshGroup {
  baseName: string;
  items: VrmMeshItem[];
}

interface AvatarPanelProps {
  vrmName: string;
  vrmStatus: VrmStatus;
  vrmError: string | null;
  mtoon: MToonConfig;
  shader: ShaderConfig;
  wind: WindConfig;
  expressionNames: string[];
  faceWeights: Record<string, number>;
  antiAlias: boolean;
  msaa: boolean;
  meshes?: VrmMeshItem[];
  meshVisibility?: Record<string, boolean>;
  onToggleMesh?: (id: string, visible: boolean) => void;
  onToggleAllMeshes?: (visible: boolean) => void;
  onMtoonChange: (m: MToonConfig) => void;
  onShaderChange: (s: ShaderConfig) => void;
  onWindChange: (w: WindConfig) => void;
  onAntiAliasChange: (v: boolean) => void;
  onMsaaChange: (v: boolean) => void;
  onFaceWeightChange: (name: string, value: number) => void;
  onFacePreset: (preset: FacePreset) => void;
  onPickFile: () => void;
  onResetVRM: () => void;
  onSaveConfig: () => void;
  onClose: () => void;
}

export function AvatarPanel({
  vrmName, vrmStatus, vrmError, mtoon, shader, wind,
  expressionNames, faceWeights, antiAlias, msaa, meshes = [], meshVisibility = {},
  onToggleMesh, onToggleAllMeshes,
  onMtoonChange, onShaderChange, onWindChange, onPickFile, onResetVRM, onSaveConfig, onClose,
  onFaceWeightChange, onFacePreset, onAntiAliasChange, onMsaaChange,
}: AvatarPanelProps) {
  const [meshFilter, setMeshFilter] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const sortedExpressions = useMemo(() => {
    return [...expressionNames].sort((a, b) => {
      const ea = matchFaceEmotion(a);
      const eb = matchFaceEmotion(b);
      const ia = ea ? FACE_EMOTIONS.indexOf(ea) : FACE_EMOTIONS.length;
      const ib = eb ? FACE_EMOTIONS.indexOf(eb) : FACE_EMOTIONS.length;
      return ia - ib || a.localeCompare(b);
    });
  }, [expressionNames]);

  // Group meshes by base common name (e.g. Face, Body, Hair)
  const groupedMeshes = useMemo<MeshGroup[]>(() => {
    const map = new Map<string, VrmMeshItem[]>();
    for (const m of meshes) {
      const base = getMeshBaseName(m.name);
      const list = map.get(base) || [];
      list.push(m);
      map.set(base, list);
    }
    return Array.from(map.entries()).map(([baseName, items]) => ({
      baseName,
      items,
    }));
  }, [meshes]);

  // Filter groups and their child meshes
  const filteredGroups = useMemo<MeshGroup[]>(() => {
    const q = meshFilter.trim().toLowerCase();
    if (!q) return groupedMeshes;
    return groupedMeshes
      .map((g) => {
        const groupMatches = g.baseName.toLowerCase().includes(q);
        const matchingItems = g.items.filter(
          (m) => groupMatches || m.name.toLowerCase().includes(q)
        );
        return {
          baseName: g.baseName,
          items: matchingItems,
        };
      })
      .filter((g) => g.items.length > 0);
  }, [groupedMeshes, meshFilter]);

  // Default is COLLAPSED: a group is expanded only when its name is in the set.
  const toggleGroupCollapse = (baseName: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [baseName]: !prev[baseName],
    }));
  };

  const handleExpandAll = () => {
    const next: Record<string, boolean> = {};
    for (const g of groupedMeshes) {
      next[g.baseName] = true;
    }
    setExpandedGroups(next);
  };

  const handleCollapseAll = () => {
    setExpandedGroups({});
  };

  return (
    <Card className={cn(
      'w-[440px] max-w-[calc(100vw-2rem)] bg-zinc-900/95 border-zinc-800',
      'backdrop-blur-md shadow-2xl shadow-black/60 text-zinc-100 overflow-hidden rounded-xl',
    )}>
      <CardHeader className="pb-2 pt-3 px-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center justify-center rounded-md w-7 h-7 bg-violet-500/20 text-violet-300 shrink-0">
              <Shirt className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold tracking-wide text-zinc-200">VRM model</CardTitle>
              <p className="text-[11px] text-zinc-400 truncate" title={vrmName}>{vrmName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusPill status={vrmStatus} error={vrmError} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close VRM model"
              className="w-7 h-7 rounded-md bg-zinc-800/70 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700 flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {vrmError && (
          <div className="mt-2 text-[11px] text-rose-300 bg-rose-950/40 border border-rose-800/40 rounded-md p-1.5 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="leading-tight">{vrmError}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-3 pt-0 overflow-hidden">
        <Tabs defaultValue="avatar" className="w-full">
          <TabsList className="grid w-full grid-cols-6 bg-zinc-800/60 h-8">
            <TabsTrigger value="avatar" className="text-[8.5px] uppercase tracking-wider">Model</TabsTrigger>
            <TabsTrigger value="meshes" className="text-[8.5px] uppercase tracking-wider">Meshes</TabsTrigger>
            <TabsTrigger value="mtoon" className="text-[8.5px] uppercase tracking-wider">MToon</TabsTrigger>
            <TabsTrigger value="effects" className="text-[8.5px] uppercase tracking-wider">Effects</TabsTrigger>
            <TabsTrigger value="face" className="text-[8.5px] uppercase tracking-wider">Face</TabsTrigger>
            <TabsTrigger value="wind" className="text-[8.5px] uppercase tracking-wider">Wind</TabsTrigger>
          </TabsList>

          {/* TAB 1: MODEL */}
          <TabsContent value="avatar" className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onPickFile}
                className="bg-violet-600/20 border-violet-500/40 hover:bg-violet-600/40 hover:text-white text-violet-100">
                <Upload className="w-3.5 h-3.5 mr-1.5" />Open .vrm
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onResetVRM}
                className="bg-zinc-800/60 border-zinc-700 hover:bg-zinc-700 hover:text-white text-zinc-200">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Sample
              </Button>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={onSaveConfig}
              className="w-full bg-emerald-600/20 border-emerald-500/40 hover:bg-emerald-600/40 hover:text-white text-emerald-100">
              <Save className="w-3.5 h-3.5 mr-1.5" />Save Config &amp; Avatar
            </Button>

            <div className="rounded-lg p-2 bg-zinc-800/30 border border-zinc-800 space-y-1">
              <p className="text-[11px] text-zinc-400 leading-snug">
                Drag a <span className="text-zinc-200">.vrm</span> anywhere in the window, or use
                <span className="text-zinc-200"> Open .vrm</span>.
              </p>
              <p className="text-[10px] text-zinc-500 leading-snug">
                Middle-drag moves the avatar. Ctrl + left-drag rotates it.
                Both are reset from Camera → Reset view.
              </p>
            </div>
          </TabsContent>

          {/* TAB 2: MESHES (GROUPED & COLLAPSIBLE PANEL) */}
          <TabsContent value="meshes" className="mt-3 space-y-2 overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-200">
                <Boxes className="w-3.5 h-3.5 text-violet-400" />
                <span>Meshes ({meshes.length})</span>
                {groupedMeshes.length > 1 && (
                  <span className="text-[10px] text-zinc-500">· {groupedMeshes.length} groups</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {groupedMeshes.some((g) => g.items.length > 1) && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleExpandAll}
                      className="h-6 w-6 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                      title="Expand all groups"
                    >
                      <UnfoldVertical className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleCollapseAll}
                      className="h-6 w-6 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                      title="Collapse all groups"
                    >
                      <FoldVertical className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onToggleAllMeshes?.(true)}
                  className="h-6 px-2 text-[10px] bg-zinc-800/60 border-zinc-700 hover:bg-zinc-700 text-zinc-300 hover:text-white"
                  title="Show all meshes"
                >
                  <Eye className="w-3 h-3 mr-1 text-emerald-400" />
                  Show all
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onToggleAllMeshes?.(false)}
                  className="h-6 px-2 text-[10px] bg-zinc-800/60 border-zinc-700 hover:bg-zinc-700 text-zinc-300 hover:text-white"
                  title="Hide all meshes"
                >
                  <EyeOff className="w-3 h-3 mr-1 text-rose-400" />
                  Hide all
                </Button>
              </div>
            </div>

            {meshes.length > 0 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter meshes (e.g. Face, Body, Hair)..."
                  value={meshFilter}
                  onChange={(e) => setMeshFilter(e.target.value)}
                  className="w-full h-7 pl-8 pr-2.5 rounded-md bg-zinc-800/60 border border-zinc-700 text-[11px] text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
                />
              </div>
            )}

            <ScrollArea className="h-[340px] max-h-[340px] w-full overflow-hidden pr-2">
              {meshes.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500 bg-zinc-800/30 rounded-lg border border-zinc-800">
                  Load a VRM avatar to view and toggle its individual meshes.
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500 bg-zinc-800/30 rounded-lg border border-zinc-800">
                  No meshes matching &quot;{meshFilter}&quot;
                </div>
              ) : (
                <div className="space-y-2 pr-0.5 pb-2">
                  {filteredGroups.map((group) => {
                    const isGroupOfOne = group.items.length === 1;

                    // If single mesh, render a clean direct item row
                    if (isGroupOfOne) {
                      const mesh = group.items[0];
                      const isVisible = meshVisibility[mesh.id] !== false;
                      return (
                        <div
                          key={mesh.id}
                          className={cn(
                            'flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition-colors',
                            isVisible
                              ? 'bg-zinc-800/40 border-zinc-700/60 text-zinc-200'
                              : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-500 opacity-60'
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0 mr-2">
                            <Layers className={cn('w-3.5 h-3.5 shrink-0', isVisible ? 'text-violet-400' : 'text-zinc-600')} />
                            <span className="truncate font-mono text-[11px]" title={mesh.name}>
                              {mesh.name}
                            </span>
                          </div>
                          <Switch
                            checked={isVisible}
                            onCheckedChange={(checked) => onToggleMesh?.(mesh.id, checked)}
                            aria-label={`Toggle ${mesh.name}`}
                          />
                        </div>
                      );
                    }

                    // Multiple meshes in this group -> Render Collapsible Group
                    const isExpanded = !!expandedGroups[group.baseName];
                    const isCollapsed = !isExpanded;
                    const visibleCount = group.items.filter((m) => meshVisibility[m.id] !== false).length;
                    const allVisible = visibleCount === group.items.length;
                    const someVisible = visibleCount > 0;

                    return (
                      <div
                        key={group.baseName}
                        className="rounded-lg border border-zinc-800/90 bg-zinc-900/50 overflow-hidden transition-all shadow-sm"
                      >
                        {/* Group Header */}
                        <div
                          onClick={() => toggleGroupCollapse(group.baseName)}
                          className={cn(
                            'flex items-center justify-between px-2.5 py-1.5 cursor-pointer select-none transition-colors',
                            someVisible
                              ? 'bg-zinc-800/50 hover:bg-zinc-800/75 text-zinc-200'
                              : 'bg-zinc-900/70 hover:bg-zinc-800/40 text-zinc-400 opacity-70'
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0 mr-2">
                            <button
                              type="button"
                              className="p-0.5 text-zinc-400 hover:text-zinc-100 transition-transform"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleGroupCollapse(group.baseName);
                              }}
                              aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
                            >
                              {isCollapsed ? (
                                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-violet-400" />
                              )}
                            </button>

                            <Boxes className={cn('w-3.5 h-3.5 shrink-0', someVisible ? 'text-violet-400' : 'text-zinc-500')} />

                            <span className="font-semibold text-xs truncate text-zinc-100" title={group.baseName}>
                              {group.baseName}
                            </span>

                            <span className={cn(
                              'text-[10px] font-mono px-1.5 py-0.2 rounded-full border shrink-0',
                              allVisible
                                ? 'bg-violet-500/15 border-violet-500/30 text-violet-300'
                                : someVisible
                                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                  : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                            )}>
                              {visibleCount}/{group.items.length}
                            </span>
                          </div>

                          {/* Group Master Switch */}
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Switch
                              checked={allVisible}
                              onCheckedChange={(checked) => {
                                for (const item of group.items) {
                                  onToggleMesh?.(item.id, checked);
                                }
                              }}
                              aria-label={`Toggle all meshes in ${group.baseName}`}
                            />
                          </div>
                        </div>

                        {/* Collapsible Sub-items */}
                        {!isCollapsed && (
                          <div className="px-2 py-1.5 space-y-1 bg-zinc-950/40 border-t border-zinc-800/70">
                            {group.items.map((mesh) => {
                              const isItemVisible = meshVisibility[mesh.id] !== false;
                              return (
                                <div
                                  key={mesh.id}
                                  className={cn(
                                    'flex items-center justify-between pl-3 pr-2 py-1 rounded border text-[11px] transition-colors',
                                    isItemVisible
                                      ? 'bg-zinc-800/35 border-zinc-700/50 text-zinc-300'
                                      : 'bg-zinc-900/40 border-zinc-800/60 text-zinc-500 opacity-60'
                                  )}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 mr-2">
                                    <Layers className={cn('w-3 h-3 shrink-0', isItemVisible ? 'text-violet-400/80' : 'text-zinc-600')} />
                                    <span className="truncate font-mono text-[10.5px]" title={mesh.name}>
                                      {mesh.name}
                                    </span>
                                  </div>
                                  <Switch
                                    className="scale-90"
                                    checked={isItemVisible}
                                    onCheckedChange={(checked) => onToggleMesh?.(mesh.id, checked)}
                                    aria-label={`Toggle ${mesh.name}`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* TAB 3: MTOON */}
          <TabsContent value="mtoon" className="mt-3 space-y-2">
            <ScrollArea className="h-[360px] max-h-[360px] w-full overflow-hidden pr-2">
              <div className="space-y-2 pr-0.5">
                <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                      <Dna className="w-3.5 h-3.5 text-emerald-300" />MToon look
                    </div>
                    <Switch
                      checked={mtoon.enabled}
                      onCheckedChange={(v) => onMtoonChange({ ...mtoon, enabled: v })}
                    />
                  </div>

                  {mtoon.enabled && (
                    <>
                      <LightSlider
                        label="Toon shading"
                        value={mtoon.toony}
                        min={0}
                        max={1}
                        step={0.01}
                        percent
                        onChange={(v) => onMtoonChange({ ...mtoon, toony: v })}
                      />
                      <LightSlider
                        label="GI equalization"
                        value={mtoon.gi}
                        min={0}
                        max={1}
                        step={0.01}
                        percent
                        onChange={(v) => onMtoonChange({ ...mtoon, gi: v })}
                      />
                      <LightSlider
                        label="Shade shift"
                        value={mtoon.shadingShift}
                        min={-1}
                        max={1}
                        step={0.01}
                        onChange={(v) => onMtoonChange({ ...mtoon, shadingShift: v })}
                      />
                      <LightSlider
                        label="Color boost"
                        value={mtoon.colorBoost}
                        min={0}
                        max={2}
                        step={0.01}
                        percent
                        onChange={(v) => onMtoonChange({ ...mtoon, colorBoost: v })}
                      />
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <LightSlider
                          label="Rim light"
                          value={mtoon.rim}
                          min={0}
                          max={1}
                          step={0.01}
                          percent
                          onChange={(v) => onMtoonChange({ ...mtoon, rim: v })}
                        />
                        <LightSlider
                          label="Rim power"
                          value={mtoon.rimPower}
                          min={1}
                          max={8}
                          step={0.1}
                          onChange={(v) => onMtoonChange({ ...mtoon, rimPower: v })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-400">Rim color</span>
                        <input
                          type="color"
                          value={mtoon.rimColor}
                          onChange={(e) => onMtoonChange({ ...mtoon, rimColor: e.target.value })}
                          className="h-6 w-10 rounded border border-zinc-700 bg-transparent cursor-pointer"
                          aria-label="Rim color"
                        />
                      </div>
                    </>
                  )}

                  <p className="text-[10px] text-zinc-500 leading-snug">
                    Applied to every MToon material. Color textures are read as sRGB and materials
                    do not tone map twice, so skin and fabric keep their source colors.
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onMtoonChange({ ...DEFAULT_MTOON })}
                      className="h-7 bg-zinc-800/60 border-zinc-700 hover:bg-zinc-700 hover:text-white text-zinc-200 text-[10px]"
                    >
                      Recommended
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onMtoonChange({ ...mtoon, enabled: false })}
                      className="h-7 bg-zinc-800/60 border-zinc-700 hover:bg-zinc-700 hover:text-white text-zinc-200 text-[10px]"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />Model values
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* TAB 4: EFFECTS */}
          <TabsContent value="effects" className="mt-3 space-y-2">
            <ScrollArea className="h-[360px] max-h-[360px] w-full overflow-hidden pr-2">
              <div className="space-y-2 pr-0.5">
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">Effects (multi)</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {SHADER_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => {
                          if (p.value === 'off') {
                            onShaderChange({ ...shader, effects: [] });
                            return;
                          }
                          const isActive = shader.effects.includes(p.value);
                          const effects = isActive
                            ? shader.effects.filter((e) => e !== p.value)
                            : [...shader.effects, p.value];
                          onShaderChange({
                            ...shader,
                            effects,
                            intensity: Math.max(shader.intensity, 0.05),
                          });
                        }}
                        className={cn(
                          'text-[10px] py-1.5 rounded-md border transition-colors',
                          (p.value === 'off' ? shader.effects.length === 0 : shader.effects.includes(p.value))
                            ? 'bg-violet-600/30 border-violet-500/50 text-violet-100'
                            : 'bg-zinc-800/40 border-zinc-700/60 text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200',
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-snug">
                    Tap several effects to combine them. Off clears all.
                  </p>
                </div>

                <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                      <Sparkles className="w-3.5 h-3.5 text-violet-300" />Effect
                    </div>
                    <input
                      type="color"
                      value={shader.color}
                      onChange={(e) => onShaderChange({ ...shader, color: e.target.value })}
                      className="h-6 w-10 rounded border border-zinc-700 bg-transparent cursor-pointer"
                      aria-label="Effect color"
                    />
                  </div>
                  <LightSlider
                    label={shader.effects.length === 1 && shader.effects.includes('outline') ? 'Outline width' : 'Intensity'}
                    value={shader.intensity}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => onShaderChange({ ...shader, intensity: v })}
                  />
                  {(shader.effects.includes('hologram') || shader.effects.includes('scanline')) && (
                    <LightSlider
                      label="Scanline density"
                      value={shader.scanline}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(v) => onShaderChange({ ...shader, scanline: v })}
                    />
                  )}
                  {shader.effects.includes('dissolve') && (
                    <LightSlider
                      label="Dissolve"
                      value={shader.dissolve}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(v) => onShaderChange({ ...shader, dissolve: v })}
                    />
                  )}
                </div>

                <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                    <Wand2 className="w-3.5 h-3.5 text-amber-300" />Bloom
                  </div>
                  <LightSlider
                    label="Strength"
                    value={shader.bloom}
                    min={0}
                    max={2}
                    step={0.05}
                    onChange={(v) => onShaderChange({ ...shader, bloom: v })}
                  />
                  <LightSlider
                    label="Radius"
                    value={shader.bloomRadius}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => onShaderChange({ ...shader, bloomRadius: v })}
                  />
                  <LightSlider
                    label="Threshold"
                    value={shader.bloomThreshold}
                    min={0}
                    max={3}
                    step={0.05}
                    onChange={(v) => onShaderChange({ ...shader, bloomThreshold: v })}
                  />
                </div>

                <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                  <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                    <Sparkles className="w-3.5 h-3.5 text-sky-300" />Antialiasing
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] text-zinc-200">FXAA</p>
                      <p className="text-[10px] text-zinc-500 leading-tight">
                        Post-process AA. Smooths effect edges and scanlines cheaply.
                      </p>
                    </div>
                    <Switch checked={antiAlias} onCheckedChange={onAntiAliasChange} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] text-zinc-200">MSAA 4x</p>
                      <p className="text-[10px] text-zinc-500 leading-tight">
                        Multisampling on the render targets. Crisper geometry edges.
                      </p>
                    </div>
                    <Switch checked={msaa} onCheckedChange={onMsaaChange} />
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* TAB 5: FACE */}
          <TabsContent value="face" className="mt-3 space-y-2">
            <ScrollArea className="h-[360px] max-h-[360px] w-full overflow-hidden pr-2">
              <div className="space-y-2 pr-0.5">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
                    <Smile className="w-3 h-3" />Blend shapes
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {FACE_PRESET_BUTTONS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => onFacePreset(p.value)}
                        className="text-[10px] py-1.5 rounded-md border bg-zinc-800/40 border-zinc-700/60 text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200 transition-colors"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {sortedExpressions.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 leading-snug rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                    Load a VRM model to list its expressions.
                  </p>
                ) : (
                  <div className="space-y-2.5 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                    {sortedExpressions.map((name) => (
                      <LightSlider
                        key={name}
                        label={name.charAt(0).toUpperCase() + name.slice(1)}
                        value={faceWeights[name] ?? 0}
                        min={0}
                        max={1}
                        step={0.01}
                        percent
                        onChange={(v) => onFaceWeightChange(name, v)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* TAB 6: WIND */}
          <TabsContent value="wind" className="mt-3 space-y-2">
            <ScrollArea className="h-[360px] max-h-[360px] w-full overflow-hidden pr-2">
              <div className="space-y-2 pr-0.5">
                <div className="space-y-2 rounded-lg p-2 bg-zinc-800/30 border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                      <Wind className="w-3.5 h-3.5 text-cyan-300" />Wind
                    </div>
                    <Switch
                      checked={wind.enabled}
                      onCheckedChange={(v) => onWindChange({ ...wind, enabled: v })}
                    />
                  </div>

                  {wind.enabled && (
                    <>
                      <LightSlider
                        label="Strength"
                        value={wind.strength}
                        min={0}
                        max={3}
                        step={0.05}
                        onChange={(v) => onWindChange({ ...wind, strength: v })}
                      />
                      <LightSlider
                        label="Direction"
                        value={wind.direction}
                        min={0}
                        max={360}
                        step={1}
                        unit="°"
                        onChange={(v) => onWindChange({ ...wind, direction: v })}
                      />
                      <LightSlider
                        label="Gusts"
                        value={wind.gusts}
                        min={0}
                        max={1}
                        step={0.05}
                        percent
                        onChange={(v) => onWindChange({ ...wind, gusts: v })}
                      />
                    </>
                  )}

                  <p className="text-[10px] text-zinc-500 leading-snug">
                    Breeze on hair, skirt and ribbons, driven by the VRM spring bones.
                    It needs Physics quality Medium/High in the optimization panel.
                    Direction is world-space (0° = right, 90° = away from camera).
                  </p>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onWindChange({ ...DEFAULT_WIND, enabled: wind.enabled })}
                    className="w-full h-7 bg-zinc-800/60 border-zinc-700 hover:bg-zinc-700 hover:text-white text-zinc-200"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reset wind
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
