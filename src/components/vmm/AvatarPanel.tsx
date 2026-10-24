'use client';

import { useMemo, useState } from 'react';
import {
  Upload, RotateCcw, Save, AlertCircle, Sparkles, Wand2, Dna, Shirt, Wind, Smile,
  Layers, Search, Eye, EyeOff, ChevronDown, ChevronRight, Boxes, FoldVertical, UnfoldVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LightSlider, StatusPill, type VrmStatus } from './controls';
import {
  DEFAULT_MTOON, DEFAULT_WIND, FACE_EMOTIONS, matchFaceEmotion,
  type MToonConfig, type ShaderConfig, type ShaderPreset, type WindConfig, type FacePreset,
} from '@/lib/vrm/constants';
import { PERFECT_SYNC_CLIP_NAMES } from '@/lib/vmc/vmc';
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
  name = name
    .replace(/[\s_.-]*\(clone\)|\(clone\)/gi, '')
    .replace(/[\s_.-]*\(merged\)|\(merged\)/gi, '')
    .replace(/[\s_.-]*\(instance\)|\(instance\)/gi, '')
    .replace(/[\s_.-]*copy\s*\d*/gi, '');

  name = name
    .replace(/[_\s.-]+\d+$/g, '')
    .replace(/\s*\(\d+\)$/g, '');

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
  perfectSyncNames?: string[];
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
  expressionNames, perfectSyncNames = [], faceWeights, antiAlias, msaa, meshes = [], meshVisibility = {},
  onToggleMesh, onToggleAllMeshes,
  onMtoonChange, onShaderChange, onWindChange, onPickFile, onResetVRM, onSaveConfig, onClose,
  onFaceWeightChange, onFacePreset, onAntiAliasChange, onMsaaChange,
}: AvatarPanelProps) {
  const [activeTab, setActiveTab] = useState<'avatar' | 'meshes' | 'mtoon' | 'effects' | 'face' | 'wind'>('avatar');
  const [meshFilter, setMeshFilter] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [showPerfectSyncSliders, setShowPerfectSyncSliders] = useState(false);

  const sortedExpressions = useMemo(() => {
    return [...expressionNames].sort((a, b) => {
      const ea = matchFaceEmotion(a);
      const eb = matchFaceEmotion(b);
      const ia = ea ? FACE_EMOTIONS.indexOf(ea) : FACE_EMOTIONS.length;
      const ib = eb ? FACE_EMOTIONS.indexOf(eb) : FACE_EMOTIONS.length;
      return ia - ib || a.localeCompare(b);
    });
  }, [expressionNames]);

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
    <div className="window w-[430px] max-w-[calc(100vw-2rem)]">
      <div className="title-bar">
        <div className="title-bar-text">
          <Shirt className="w-3.5 h-3.5" />
          <span>VRM Model — {vrmName}</span>
        </div>
        <div className="title-bar-controls">
          <button type="button" aria-label="Minimize" />
          <button type="button" aria-label="Close" onClick={onClose} />
        </div>
      </div>

      <div className="window-body space-y-2">
        {vrmError && (
          <div className="text-[11px] text-[#800000] bg-[#ffe6e6] border border-[#b82e2e] p-1.5 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="leading-tight">{vrmError}</span>
          </div>
        )}

        <menu role="tablist" aria-label="VRM Model Tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'avatar'}
            onClick={() => setActiveTab('avatar')}
          >
            Model
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'meshes'}
            onClick={() => setActiveTab('meshes')}
          >
            Meshes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'mtoon'}
            onClick={() => setActiveTab('mtoon')}
          >
            MToon
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'effects'}
            onClick={() => setActiveTab('effects')}
          >
            Effects
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'face'}
            onClick={() => setActiveTab('face')}
          >
            Face
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'wind'}
            onClick={() => setActiveTab('wind')}
          >
            Wind
          </button>
        </menu>

        {/* TAB 1: MODEL */}
        {activeTab === 'avatar' && (
          <article role="tabpanel" className="space-y-2.5">
            <fieldset>
              <legend>Avatar File</legend>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  type="button"
                  onClick={onPickFile}
                  className="flex items-center justify-center gap-1.5 font-semibold"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Open .vrm…</span>
                </button>
                <button
                  type="button"
                  onClick={onResetVRM}
                  className="flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Load Sample</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onSaveConfig}
                className="w-full flex items-center justify-center gap-1.5 font-bold"
              >
                <Save className="w-3.5 h-3.5 text-[#005500]" />
                <span>Save Config &amp; Avatar</span>
              </button>
            </fieldset>

            <fieldset>
              <legend>Tips</legend>
              <p className="text-[11px] text-[#222222] leading-snug mb-1">
                Drag a <strong>.vrm</strong> anywhere in the window, or click <strong>Open .vrm…</strong>
              </p>
              <p className="text-[10px] text-[#555555] leading-snug">
                Middle-drag moves the avatar. Ctrl + left-drag rotates it. Both are reset from Camera → Reset view.
              </p>
            </fieldset>
          </article>
        )}

        {/* TAB 2: MESHES */}
        {activeTab === 'meshes' && (
          <article role="tabpanel" className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-[#003399]">
                <Boxes className="w-3.5 h-3.5" />
                <span>Meshes ({meshes.length})</span>
                {groupedMeshes.length > 1 && (
                  <span className="text-[10px] font-normal text-[#555555]">· {groupedMeshes.length} groups</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {groupedMeshes.some((g) => g.items.length > 1) && (
                  <>
                    <button
                      type="button"
                      onClick={handleExpandAll}
                      className="xp-compact-btn"
                      title="Expand all groups"
                    >
                      <UnfoldVertical className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCollapseAll}
                      className="xp-compact-btn"
                      title="Collapse all groups"
                    >
                      <FoldVertical className="w-3 h-3" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => onToggleAllMeshes?.(true)}
                  className="xp-compact-btn flex items-center gap-1"
                  title="Show all meshes"
                >
                  <Eye className="w-3 h-3 text-[#005500]" /> Show all
                </button>
                <button
                  type="button"
                  onClick={() => onToggleAllMeshes?.(false)}
                  className="xp-compact-btn flex items-center gap-1"
                  title="Hide all meshes"
                >
                  <EyeOff className="w-3 h-3 text-[#800000]" /> Hide all
                </button>
              </div>
            </div>

            {meshes.length > 0 && (
              <div className="field-row" data-no-drag>
                <Search className="w-3.5 h-3.5 text-[#555555] shrink-0" />
                <input
                  type="text"
                  placeholder="Filter meshes (e.g. Face, Body, Hair)..."
                  value={meshFilter}
                  onChange={(e) => setMeshFilter(e.target.value)}
                  className="w-full"
                />
              </div>
            )}

            <div className="max-h-[300px] overflow-y-auto border border-[#7f9db9] bg-white p-1.5 space-y-1.5" data-no-drag>
              {meshes.length === 0 ? (
                <div className="p-3 text-center text-[#555555]">
                  Load a VRM avatar to view and toggle its individual meshes.
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="p-3 text-center text-[#555555]">
                  No meshes matching &quot;{meshFilter}&quot;
                </div>
              ) : (
                filteredGroups.map((group) => {
                  const isGroupOfOne = group.items.length === 1;

                  if (isGroupOfOne) {
                    const mesh = group.items[0];
                    const isVisible = meshVisibility[mesh.id] !== false;
                    const chkId = `mesh-chk-${mesh.id}`;
                    return (
                      <div
                        key={mesh.id}
                        className={cn(
                          'flex items-center justify-between px-2 py-1 border',
                          isVisible ? 'bg-[#f7f6f0] border-[#d0d0bf]' : 'bg-[#ece9d8] border-[#c0c0b0] opacity-70',
                        )}
                      >
                        <div className="field-row min-w-0 flex-1">
                          <input
                            id={chkId}
                            type="checkbox"
                            checked={isVisible}
                            onChange={(e) => onToggleMesh?.(mesh.id, e.target.checked)}
                          />
                          <label htmlFor={chkId} className="truncate font-mono text-[11px] cursor-pointer" title={mesh.name}>
                            {mesh.name}
                          </label>
                        </div>
                      </div>
                    );
                  }

                  const isExpanded = !!expandedGroups[group.baseName];
                  const isCollapsed = !isExpanded;
                  const visibleCount = group.items.filter((m) => meshVisibility[m.id] !== false).length;
                  const allVisible = visibleCount === group.items.length;
                  const grpChkId = `grp-chk-${group.baseName}`;

                  return (
                    <div key={group.baseName} className="border border-[#919b9c] bg-[#f4f3ee]">
                      <div
                        onClick={() => toggleGroupCollapse(group.baseName)}
                        className="flex items-center justify-between px-2 py-1 cursor-pointer select-none bg-[#ece9d8] hover:bg-[#e2dfd0]"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isCollapsed ? (
                            <ChevronRight className="w-3.5 h-3.5 text-[#333333]" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-[#003399]" />
                          )}
                          <Boxes className="w-3.5 h-3.5 text-[#003399] shrink-0" />
                          <span className="font-bold truncate text-[#000000]" title={group.baseName}>
                            {group.baseName}
                          </span>
                          <span className="text-[10px] font-mono px-1 bg-white border border-[#7f9db9] text-[#003399]">
                            {visibleCount}/{group.items.length}
                          </span>
                        </div>

                        <div className="field-row shrink-0" onClick={(e) => e.stopPropagation()}>
                          <input
                            id={grpChkId}
                            type="checkbox"
                            checked={allVisible}
                            onChange={(e) => {
                              for (const item of group.items) {
                                onToggleMesh?.(item.id, e.target.checked);
                              }
                            }}
                          />
                          <label htmlFor={grpChkId} className="cursor-pointer text-[10px]">All</label>
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div className="p-1.5 space-y-1 bg-white border-t border-[#d0d0bf]">
                          {group.items.map((mesh) => {
                            const isItemVisible = meshVisibility[mesh.id] !== false;
                            const itemChkId = `mesh-item-${mesh.id}`;
                            return (
                              <div
                                key={mesh.id}
                                className="flex items-center justify-between pl-3 pr-1.5 py-0.5 border border-[#e4e1d0] bg-[#faf9f5]"
                              >
                                <div className="field-row min-w-0 flex-1">
                                  <input
                                    id={itemChkId}
                                    type="checkbox"
                                    checked={isItemVisible}
                                    onChange={(e) => onToggleMesh?.(mesh.id, e.target.checked)}
                                  />
                                  <label htmlFor={itemChkId} className="truncate font-mono text-[10.5px] cursor-pointer" title={mesh.name}>
                                    <Layers className="w-3 h-3 mr-1 inline text-[#003399]" />
                                    {mesh.name}
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </article>
        )}

        {/* TAB 3: MTOON */}
        {activeTab === 'mtoon' && (
          <article role="tabpanel" className="space-y-2 max-h-[370px] overflow-y-auto">
            <fieldset>
              <legend className="flex items-center gap-1">
                <Dna className="w-3 h-3" /> MToon Shader Look
              </legend>
              <div className="field-row mb-2" data-no-drag>
                <input
                  id="mtoon-enable-chk"
                  type="checkbox"
                  checked={mtoon.enabled}
                  onChange={(e) => onMtoonChange({ ...mtoon, enabled: e.target.checked })}
                />
                <label htmlFor="mtoon-enable-chk" className="font-bold cursor-pointer">
                  Enable global MToon overrides
                </label>
              </div>

              {mtoon.enabled && (
                <div className="space-y-1.5">
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
                  <div className="flex items-center justify-between pt-1" data-no-drag>
                    <span className="text-[11px]">Rim color</span>
                    <input
                      type="color"
                      value={mtoon.rimColor}
                      onChange={(e) => onMtoonChange({ ...mtoon, rimColor: e.target.value })}
                      className="h-5 w-10 border border-[#7f9db9] bg-transparent cursor-pointer"
                      aria-label="Rim color"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onMtoonChange({ ...DEFAULT_MTOON })}
                >
                  Recommended
                </button>
                <button
                  type="button"
                  onClick={() => onMtoonChange({ ...mtoon, enabled: false })}
                  className="flex items-center justify-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Model values
                </button>
              </div>
            </fieldset>
          </article>
        )}

        {/* TAB 4: EFFECTS */}
        {activeTab === 'effects' && (
          <article role="tabpanel" className="space-y-2 max-h-[370px] overflow-y-auto">
            <fieldset>
              <legend>Effects (Multi-Select)</legend>
              <div className="grid grid-cols-4 gap-1">
                {SHADER_PRESETS.map((p) => {
                  const isSelected = p.value === 'off' ? shader.effects.length === 0 : shader.effects.includes(p.value);
                  return (
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
                        'xp-compact-btn text-[10px]',
                        isSelected && 'active font-bold text-[#003399]',
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Effect Parameters
              </legend>
              <div className="flex items-center justify-between mb-1" data-no-drag>
                <span className="text-[11px]">Tint / Glow Color</span>
                <input
                  type="color"
                  value={shader.color}
                  onChange={(e) => onShaderChange({ ...shader, color: e.target.value })}
                  className="h-5 w-10 border border-[#7f9db9] bg-transparent cursor-pointer"
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
            </fieldset>

            <fieldset>
              <legend className="flex items-center gap-1">
                <Wand2 className="w-3 h-3" /> HDR Bloom
              </legend>
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
            </fieldset>

            <fieldset>
              <legend>Antialiasing</legend>
              <div className="field-row" data-no-drag>
                <input
                  id="fxaa-chk"
                  type="checkbox"
                  checked={antiAlias}
                  onChange={(e) => onAntiAliasChange(e.target.checked)}
                />
                <label htmlFor="fxaa-chk" className="cursor-pointer">FXAA (Post-process AA)</label>
              </div>
              <div className="field-row mt-1" data-no-drag>
                <input
                  id="msaa-chk"
                  type="checkbox"
                  checked={msaa}
                  onChange={(e) => onMsaaChange(e.target.checked)}
                />
                <label htmlFor="msaa-chk" className="cursor-pointer">MSAA 4x (Multisampling)</label>
              </div>
            </fieldset>
          </article>
        )}

        {/* TAB 5: FACE */}
        {activeTab === 'face' && (
          <article role="tabpanel" className="space-y-2 max-h-[370px] overflow-y-auto">
            <fieldset>
              <legend className="flex items-center gap-1">
                <Smile className="w-3 h-3" /> Emotion Presets
              </legend>
              <div className="grid grid-cols-2 gap-1.5">
                {FACE_PRESET_BUTTONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => onFacePreset(p.value)}
                    className="xp-compact-btn"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>BlendShape Sliders</legend>
              {sortedExpressions.length === 0 ? (
                <p className="text-[11px] text-[#555555]">
                  Load a VRM model to list its expressions.
                </p>
              ) : (
                <div className="space-y-1.5">
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
            </fieldset>

            {/* Perfect Sync (52 ARKit BlendShapeClips) section */}
            <fieldset>
              <legend className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Perfect Sync (ARKit 52) — {perfectSyncNames.length}/{PERFECT_SYNC_CLIP_NAMES.length} clips
              </legend>

              {perfectSyncNames.length === 0 ? (
                <p className="text-[10px] text-[#555555] leading-snug">
                  This VRM has no native ARKit Perfect Sync clips (setup via HANA_Tool / Unity). External tracking will use standard VRM fallback.
                </p>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowPerfectSyncSliders((v) => !v)}
                    className="w-full flex items-center justify-center gap-1"
                  >
                    {showPerfectSyncSliders ? (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" /> Hide 52 ARKit Sliders
                      </>
                    ) : (
                      <>
                        <ChevronRight className="w-3.5 h-3.5" /> Show {perfectSyncNames.length} ARKit Sliders
                      </>
                    )}
                  </button>

                  {showPerfectSyncSliders && (
                    <div className="p-1.5 border border-[#7f9db9] bg-white max-h-[200px] overflow-y-auto space-y-1.5">
                      {perfectSyncNames.map((name) => (
                        <LightSlider
                          key={name}
                          label={name}
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
              )}
            </fieldset>
          </article>
        )}

        {/* TAB 6: WIND */}
        {activeTab === 'wind' && (
          <article role="tabpanel" className="space-y-2">
            <fieldset>
              <legend className="flex items-center gap-1">
                <Wind className="w-3 h-3" /> Spring-Bone Wind Breeze
              </legend>
              <div className="field-row mb-2" data-no-drag>
                <input
                  id="wind-enable-chk"
                  type="checkbox"
                  checked={wind.enabled}
                  onChange={(e) => onWindChange({ ...wind, enabled: e.target.checked })}
                />
                <label htmlFor="wind-enable-chk" className="font-bold cursor-pointer">
                  Enable Wind Physics
                </label>
              </div>

              {wind.enabled && (
                <div className="space-y-1.5">
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
                </div>
              )}

              <p className="text-[10px] text-[#555555] leading-snug my-2">
                Breeze on hair, skirt and ribbons, driven by the VRM spring bones.
                Direction is world-space (0° = right, 90° = away from camera).
              </p>

              <button
                type="button"
                onClick={() => onWindChange({ ...DEFAULT_WIND, enabled: wind.enabled })}
                className="w-full flex items-center justify-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset wind
              </button>
            </fieldset>
          </article>
        )}
      </div>

      <div className="status-bar">
        <p className="status-bar-field">
          <StatusPill status={vrmStatus} error={vrmError} />
        </p>
        <p className="status-bar-field">Meshes: {meshes.length}</p>
        <p className="status-bar-field">ARKit: {perfectSyncNames.length}/{PERFECT_SYNC_CLIP_NAMES.length}</p>
      </div>
    </div>
  );
}
