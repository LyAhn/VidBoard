"use client";

import React, { useState, useRef, useEffect } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { 
  Loader2, Image as ImageIcon, Download, Copy, Share, 
  Settings2, AlignLeft, Music, Activity, PlaySquare, DownloadCloud,
  ChevronDown, ChevronRight
} from "lucide-react";

type AspectRatio = "16:9" | "9:16" | "1:1";

const planningSteps = [
  "Searching the web for artist context",
  "Writing the director context guide",
  "Building the visual bible",
  "Structuring the storyboard JSON",
  "Checking prompts and finishing blueprint",
];

interface FramePlan {
  frame_number: number;
  timestamp_hint: string;
  lyric_line: string;
  scene_description: string;
  camera_angle: string;
  lighting: string;
  colour_palette: string;
  motion_hint: string;
  flow_prompt: string;
  image_prompt: string;
  character_present: boolean;
}

interface FrameData extends FramePlan {
  startImageBase64?: string;
  endImageBase64?: string;
  isGenerating?: boolean;
  error?: string;
}

interface AppState {
  artistName: string;
  trackTitle: string;
  lyrics: string;
  theme: string;
  numberOfFrames: number;
  aspectRatio: AspectRatio;
  artistContext: string | null;
  visualBible: string | null;
  characterReferenceImage: string | null;
  frames: FrameData[];
  isPlanning: boolean;
  isGeneratingImages: boolean;
  error: string | null;
  statusMessage: string | null;
}

export default function VidBoardApp() {
  const [state, setState] = useState<AppState>({
    artistName: "",
    trackTitle: "",
    lyrics: "",
    theme: "",
    numberOfFrames: 8,
    aspectRatio: "16:9",
    artistContext: null,
    visualBible: null,
    characterReferenceImage: null,
    frames: [],
    isPlanning: false,
    isGeneratingImages: false,
    error: null,
    statusMessage: null,
  });

  const [isClient, setIsClient] = useState(false);
  const [planningElapsed, setPlanningElapsed] = useState(0);
  const [planningStepIndex, setPlanningStepIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    if (mounted) {
      setIsClient(true);
      const saved = localStorage.getItem("vidboard_state");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setState((prev) => ({
            ...prev,
            artistName: parsed.artistName || "",
            trackTitle: parsed.trackTitle || "",
            lyrics: parsed.lyrics || "",
            theme: parsed.theme || "",
            numberOfFrames: parsed.numberOfFrames || 8,
            aspectRatio: parsed.aspectRatio || "16:9"
          }));
        } catch (e) {
          console.error("Failed to parse saved state", e);
        }
      }
    }
    return () => { mounted = false; };
  }, []);

  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<number, boolean>>({});

  const updateState = (updates: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  useEffect(() => {
    if (!state.isPlanning) {
      setPlanningElapsed(0);
      setPlanningStepIndex(0);
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setPlanningElapsed(elapsed);
      setPlanningStepIndex(Math.min(planningSteps.length - 1, Math.floor(elapsed / 25)));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [state.isPlanning]);

  useEffect(() => {
    if (!isClient) return;
    const stateToSave = {
      artistName: state.artistName,
      trackTitle: state.trackTitle,
      lyrics: state.lyrics,
      theme: state.theme,
      numberOfFrames: state.numberOfFrames,
      aspectRatio: state.aspectRatio,
      artistContext: state.artistContext,
      visualBible: state.visualBible,
      frames: state.frames.map(f => ({ ...f, startImageBase64: undefined, endImageBase64: undefined }))
    };
    try {
      localStorage.setItem("vidboard_state", JSON.stringify(stateToSave));
    } catch(e) {
      console.warn("Storage error", e);
    }
  }, [state.artistName, state.trackTitle, state.lyrics, state.theme, state.numberOfFrames, state.aspectRatio, isClient]);

  const toggleDescription = (idx: number) => {
    setExpandedDescriptions(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const handleGenerate = async () => {
    if (!state.artistName || !state.trackTitle || !state.lyrics) {
      updateState({ error: "Please fill in artist name, track title, and lyrics." });
      return;
    }

    updateState({
      isPlanning: true,
      isGeneratingImages: false,
      error: null,
      artistContext: null,
      visualBible: null,
      frames: [],
      statusMessage: "Planning blueprint...",
    });

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistName: state.artistName,
          trackTitle: state.trackTitle,
          lyrics: state.lyrics,
          theme: state.theme,
          numberOfFrames: state.numberOfFrames,
          aspectRatio: state.aspectRatio,
        }),
      });

      const planData = await response.json();
      if (!response.ok) {
        throw new Error(planData.error || "Failed to plan storyboard.");
      }

      const frames = planData.frames as FramePlan[];
      updateState({
        artistContext: planData.artistContext,
        visualBible: planData.visualBible,
        frames: frames.map((frame) => ({ ...frame, isGenerating: false })),
        isPlanning: false,
        isGeneratingImages: false,
        statusMessage: null,
      });
    } catch (err) {
      updateState({
        error: err instanceof Error ? err.message : "Failed to plan storyboard.",
        isPlanning: false,
        isGeneratingImages: false,
        statusMessage: null,
      });
    }
  };

  const handleRetryImages = async () => {
    updateState({
      error: "Local AI backend not yet connected. See issues #2, #3, #4.",
      isGeneratingImages: false,
      statusMessage: null,
    });
  };

  const downloadZip = async () => {
    if (!state.frames.length) return;
    const zip = new JSZip();
    state.frames.forEach((f, i) => {
      if (f.startImageBase64) {
        const base64Data = f.startImageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
        zip.file(`Frame_${String(i+1).padStart(2, '0')}_Start.png`, base64Data, { base64: true });
      }
      if (f.endImageBase64) {
        const base64Data = f.endImageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
        zip.file(`Frame_${String(i+1).padStart(2, '0')}_End.png`, base64Data, { base64: true });
      }
    });
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${state.artistName}_${state.trackTitle}_Storyboard.zip`.replace(/\s+/g, '_'));
  };

  const copyFlowPrompts = async () => {
    const prompts = state.frames.map((f, i) => `${i+1}. ${f.flow_prompt}`).join("\n\n");
    await navigator.clipboard.writeText(prompts);
    alert("Copied all Flow prompts to clipboard!");
  };

  const exportPDF = async () => {
    if (!state.frames.length) return;
    const pdf = new jsPDF("landscape", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;

    const writeWrapped = (
      text: string,
      x: number,
      y: number,
      width: number,
      lineHeight = 5
    ) => {
      const lines = pdf.splitTextToSize(text, width) as string[];
      pdf.text(lines, x, y);
      return y + lines.length * lineHeight;
    };

    const sectionLabel = (label: string, x: number, y: number) => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(160, 100, 0);
      pdf.text(label.toUpperCase(), x, y);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");
    };

    const stripVisualBible = (prompt: string) => {
      const visualBible = state.visualBible?.trim();
      const trimmed = prompt.trim();
      if (visualBible && trimmed.startsWith(visualBible)) {
        return trimmed.slice(visualBible.length).trim();
      }
      return trimmed;
    };

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(26);
    pdf.text(`${state.artistName} - ${state.trackTitle}`, margin, 24);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    pdf.text(`Theme/Mood: ${state.theme || "Not specified"}`, margin, 39);
    pdf.text(`Total Clips: ${state.frames.length}`, margin, 48);

    if (state.visualBible) {
      sectionLabel("Visual Bible", margin, 67);
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(11);
      writeWrapped(state.visualBible, margin, 76, contentWidth, 5);
      pdf.setFont("helvetica", "normal");
    }

    for (let i = 0; i < state.frames.length; i++) {
      const f = state.frames[i];
      pdf.addPage();

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(17);
      pdf.text(`Frame ${f.frame_number}: ${f.timestamp_hint} | Clip ${i + 1} of ${state.frames.length}`, margin, 18);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      let y = writeWrapped(`Lyric: "${f.lyric_line}"`, margin, 28, contentWidth, 5) + 3;

      const columnGap = 8;
      const columnWidth = (contentWidth - columnGap * 2) / 3;
      sectionLabel("Camera", margin, y);
      sectionLabel("Lighting", margin + columnWidth + columnGap, y);
      sectionLabel("Palette", margin + (columnWidth + columnGap) * 2, y);
      pdf.setFontSize(9);
      y += 7;
      const cameraY = writeWrapped(f.camera_angle, margin, y, columnWidth, 4.3);
      const lightingY = writeWrapped(f.lighting, margin + columnWidth + columnGap, y, columnWidth, 4.3);
      const paletteY = writeWrapped(f.colour_palette, margin + (columnWidth + columnGap) * 2, y, columnWidth, 4.3);
      y = Math.max(cameraY, lightingY, paletteY) + 5;

      sectionLabel("Scene", margin, y);
      pdf.setFontSize(10);
      y = writeWrapped(f.scene_description, margin, y + 7, contentWidth, 5) + 4;

      pdf.setFillColor(245, 238, 225);
      pdf.rect(margin, y, contentWidth, 15, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text("FLOW PROMPT", margin + 3, y + 6);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      writeWrapped(f.flow_prompt, margin + 35, y + 6, contentWidth - 40, 5);
      y += 23;

      sectionLabel("Generation Prompt Preview", margin, y);
      pdf.setFont("courier", "normal");
      pdf.setFontSize(8);
      const promptPreview = stripVisualBible(f.image_prompt);
      const previewLines = pdf.splitTextToSize(promptPreview, contentWidth) as string[];
      pdf.text(previewLines.slice(0, 8), margin, y + 7);
      pdf.setFont("helvetica");
      y += 45;

      const format = state.aspectRatio === "16:9" ? {w: 120, h: 67.5} : state.aspectRatio === "9:16" ? {w: 45, h: 80} : {w: 60, h: 60};
      const imgY = Math.min(y + 4, pageHeight - format.h - 16);
      
      if (f.startImageBase64) {
        pdf.setFontSize(9);
        pdf.text("Flow Start Frame", margin, imgY - 2);
        const dataUrl = f.startImageBase64.includes("data:image") ? f.startImageBase64 : `data:image/png;base64,${f.startImageBase64}`;
        pdf.addImage(dataUrl, 'PNG', margin, imgY, format.w, format.h);
      }
      
      if (f.endImageBase64) {
        pdf.setFontSize(9);
        pdf.text("Flow End Frame", margin + 135, imgY - 2);
        const dataUrl = f.endImageBase64.includes("data:image") ? f.endImageBase64 : `data:image/png;base64,${f.endImageBase64}`;
        pdf.addImage(dataUrl, 'PNG', margin + 135, imgY, format.w, format.h);
      }
    }

    pdf.addPage();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("Appendix: Full Generation Prompts", margin, 18);

    let appendixY = 31;
    state.frames.forEach((frame, idx) => {
      const prompt = frame.image_prompt.trim();
      const lines = pdf.splitTextToSize(prompt, contentWidth) as string[];
      const needed = 11 + lines.length * 3.6;

      if (appendixY + needed > pageHeight - margin) {
        pdf.addPage();
        appendixY = 18;
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text(`Frame ${frame.frame_number || idx + 1}: ${frame.timestamp_hint}`, margin, appendixY);
      appendixY += 6;

      pdf.setFont("courier", "normal");
      pdf.setFontSize(7);
      pdf.text(lines, margin, appendixY);
      appendixY += lines.length * 3.6 + 8;
    });
    
    pdf.save(`${state.artistName}_Storyboard.pdf`.replace(/\s+/g, '_'));
  };

  const calculateCanvasStyle = () => {
    if (state.aspectRatio === "16:9") return "aspect-video";
    if (state.aspectRatio === "9:16") return "aspect-[9/16]";
    return "aspect-square";
  };

  const mainAreaRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-[#050505] font-sans text-[#e5e5e5]">
      
      {/* Sidebar */}
      <div className="w-full md:w-[300px] flex-shrink-0 bg-[#0a0a0a] border-b md:border-b-0 md:border-r border-[#1a1a1a] flex flex-col z-10 transition-all md:h-full max-h-[50vh] md:max-h-full p-5 gap-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center font-bold text-black text-xs italic">VB</div>
          <h1 className="text-xl font-black tracking-tighter text-white uppercase">VidBoard</h1>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="input-label">Artist Name</label>
              <input 
                value={state.artistName}
                onChange={e => updateState({ artistName: e.target.value })}
                className="w-full bg-[#151515] border border-[#222] rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="e.g. The Weeknd"
              />
            </div>
            <div className="space-y-1">
              <label className="input-label">Track Title</label>
              <input
                value={state.trackTitle}
                onChange={e => updateState({ trackTitle: e.target.value })}
                className="w-full bg-[#151515] border border-[#222] rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="e.g. Blinding Lights"
              />
            </div>
            <div className="space-y-1">
              <label className="input-label">Paste Lyrics</label>
              <textarea 
                value={state.lyrics}
                onChange={e => updateState({ lyrics: e.target.value })}
                rows={8}
                className="w-full bg-[#151515] border border-[#222] rounded px-3 py-2 text-xs focus:outline-none focus:border-amber-500 transition-colors resize-none font-mono"
                placeholder="Paste song lyrics here..."
              />
            </div>
            <div className="space-y-1">
              <label className="input-label">Video Theme / Mood</label>
              <input 
                value={state.theme}
                onChange={e => updateState({ theme: e.target.value })}
                className="w-full bg-[#151515] border border-[#222] rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="e.g. dark and ethereal, euphoric"
              />
              <p className="text-[9px] text-gray-500 italic">e.g. dark and ethereal, euphoric</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1 space-y-1">
              <label className="input-label">Frames ({state.numberOfFrames})</label>
              <input 
                type="number" 
                min="4" max="16" step="1"
                value={state.numberOfFrames}
                onChange={e => updateState({ numberOfFrames: parseInt(e.target.value) })}
                className="w-full bg-[#151515] border border-[#222] rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="input-label">Ratio</label>
              <select 
                value={state.aspectRatio}
                onChange={e => updateState({ aspectRatio: e.target.value as AspectRatio })}
                className="w-full bg-[#151515] border border-[#222] rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="1:1">1:1</option>
              </select>
            </div>
          </div>

        </div>

        {state.isPlanning && (
          <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Planning
              </div>
              <span className="text-[10px] font-mono text-amber-200/80">{planningElapsed}s</span>
            </div>
            <div className="space-y-2">
              {planningSteps.map((step, idx) => (
                <div key={step} className="flex items-center gap-2 text-[10px]">
                  <span className={`h-1.5 w-1.5 rounded-full ${idx <= planningStepIndex ? "bg-amber-400" : "bg-neutral-700"}`}></span>
                  <span className={idx === planningStepIndex ? "text-amber-100" : idx < planningStepIndex ? "text-neutral-400" : "text-neutral-600"}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] leading-relaxed text-neutral-500">
              Local planning can take a minute or two while Ollama reads web results and writes structured JSON.
            </p>
          </div>
        )}

        <button 
          disabled={state.isPlanning || state.isGeneratingImages}
          onClick={handleGenerate}
          className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-md amber-glow uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {state.statusMessage ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {state.statusMessage}</>
            ) : (
              <><Activity className="w-4 h-4" /> Generate Blueprint</>
            )}
          </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto flex flex-col relative bg-[#050505]" ref={mainAreaRef}>
        
        {/* Top bar */}
        {state.frames.length > 0 && (
          <header className="sticky top-0 z-20 h-16 border-b border-[#1a1a1a] flex items-center justify-between px-8 bg-[#0a0a0a]/50 backdrop-blur-md">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-xs font-medium text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                Blueprint Ready
              </div>
              <span className="text-xs text-gray-500 hidden sm:block">{state.frames.length} Frames Generated</span>
            </div>
            <div className="flex items-center gap-3">
              {state.frames.some(f => f.error) && !state.isGeneratingImages && (
                <button onClick={handleRetryImages} className="text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20 px-4 py-2 rounded uppercase tracking-tighter transition-colors">
                  Retry Failed
                </button>
              )}
              <button onClick={exportPDF} className="text-[10px] font-bold border border-[#333] hover:border-amber-500 px-4 py-2 rounded uppercase tracking-tighter transition-colors">
                PDF Export
              </button>
              <button onClick={downloadZip} className="text-[10px] hidden sm:block font-bold border border-[#333] hover:border-amber-500 px-4 py-2 rounded uppercase tracking-tighter transition-colors">
                ZIP Frames
              </button>
              <button onClick={copyFlowPrompts} className="text-[10px] font-bold bg-[#eee] hover:bg-white text-black px-4 py-2 rounded uppercase tracking-tighter transition-colors">
                Copy Flow Prompts
              </button>
            </div>
          </header>
        )}

        <div className="p-8 max-w-7xl mx-auto w-full space-y-12 pb-24">
          
          {state.error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm">
              <span className="font-semibold block mb-1">Error Occurred</span>
              {state.error}
            </div>
          )}

          {/* Artist Context Display */}
          {state.artistContext && (
            <div className="glass rounded-xl p-4 flex flex-col md:flex-row gap-6 items-start shrink-0">
              <div className="flex-1">
                <h2 className="text-[10px] text-amber-500 uppercase font-black mb-2 tracking-[0.2em] flex items-center gap-2">
                   <Activity className="w-3 h-3" /> Artist Research (Ollama Web Search)
                </h2>
                <div className="text-sm text-gray-400 leading-relaxed italic border-l-2 border-amber-500/30 pl-4 whitespace-pre-wrap">
                  {state.artistContext}
                </div>
              </div>
            </div>
          )}

          {/* Visual Bible Display & Character Reference Upload */}
          {state.visualBible && (
            <div className="glass rounded-xl p-4 flex flex-col gap-4">
              <h2 className="text-[10px] text-amber-500 uppercase font-black tracking-[0.2em] flex items-center gap-2">
                 <Settings2 className="w-3 h-3" /> Visual Bible & Style Lock
              </h2>
              <div className="text-sm text-gray-300 leading-relaxed font-mono bg-black/50 p-4 rounded border border-amber-500/10 whitespace-pre-wrap">
                {state.visualBible}
              </div>
              <div className="flex items-center gap-4 mt-2">
                <label className="text-xs uppercase tracking-wider text-gray-400">Character Reference Image:</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (eve) => {
                        updateState({ characterReferenceImage: eve.target?.result as string });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="text-xs text-gray-300 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-amber-500/20 file:text-amber-500 hover:file:bg-amber-500/30 transition-colors"
                />
                {state.characterReferenceImage && (
                  <span className="text-xs text-green-400 font-medium">Uploaded ✓</span>
                )}
              </div>
            </div>
          )}

          {/* Empty State */}
          {state.frames.length === 0 && !state.isPlanning && !state.isGeneratingImages && !state.artistContext && (
            <div className="h-full flex flex-col items-center justify-center opacity-40 mt-32">
              <PlaySquare className="w-16 h-16 mb-4 text-neutral-500" />
              <h2 className="text-xl font-medium tracking-tight mb-2">No Storyboard Yet</h2>
              <p className="text-sm max-w-md text-center text-neutral-500">Fill in the track details on the left and hit &quot;Generate Blueprint&quot; to let AI plan your music video sequence.</p>
            </div>
          )}

          {/* Storyboard Grid */}
          <div className={`grid gap-6 flex-1 overflow-hidden ${state.aspectRatio === '9:16' ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
            {state.frames.map((frame, idx) => (
              <div key={idx} className="glass rounded-xl overflow-hidden flex flex-col group relative">
                
                  {/* Image Area */}
                  <div className="flex w-full overflow-hidden border-b border-[#222] relative">
                    {/* Start Frame */}
                    <div className={`relative flex-1 flex items-center justify-center bg-gradient-to-br from-indigo-900/40 to-black ${calculateCanvasStyle()}`}>
                      {frame.startImageBase64 ? (
                        <img 
                          src={frame.startImageBase64.includes("data:image") ? frame.startImageBase64 : `data:image/png;base64,${frame.startImageBase64}`} 
                          alt={`Start Frame ${frame.frame_number}`}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : frame.error ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-red-500/5 text-red-500 p-2 text-[10px]">Failed</div>
                      ) : frame.isGenerating ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/50">
                          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-900/50 text-neutral-500">
                          <ImageIcon className="w-5 h-5" />
                          <span className="text-[9px] uppercase font-bold tracking-widest">Image pending</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
                      <div className="absolute top-2 left-2 bg-black/60 text-white font-bold text-[9px] px-1.5 py-0.5 rounded uppercase">START</div>
                      <div className="absolute bottom-2 left-2 right-2"><p className="text-[10px] italic text-amber-200 line-clamp-1">&quot;{frame.lyric_line}&quot;</p></div>
                    </div>

                    {/* Divider Arrow */}
                    <div className="w-6 flex items-center justify-center bg-[#0a0a0a] z-10 border-l border-r border-[#222]">
                      <span className="text-amber-500 font-bold text-sm">→</span>
                    </div>

                    {/* End Frame */}
                    <div className={`relative flex-1 flex items-center justify-center bg-gradient-to-br from-indigo-900/40 to-black ${calculateCanvasStyle()}`}>
                      {frame.endImageBase64 ? (
                        <img 
                          src={frame.endImageBase64.includes("data:image") ? frame.endImageBase64 : `data:image/png;base64,${frame.endImageBase64}`} 
                          alt={`End Frame ${frame.frame_number}`}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : frame.error ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-red-500/5 text-red-500 p-2 text-[10px]">Failed</div>
                      ) : frame.isGenerating ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/50">
                          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-900/50 text-neutral-500">
                          <ImageIcon className="w-5 h-5" />
                          <span className="text-[9px] uppercase font-bold tracking-widest">Image pending</span>
                        </div>
                      )}
                      <div className="absolute top-2 left-2 bg-black/60 text-white font-bold text-[9px] px-1.5 py-0.5 rounded uppercase">END</div>
                    </div>

                    <div className="absolute top-2 right-2 bg-amber-500 text-black font-black text-[10px] px-2 py-1 rounded shadow-lg uppercase z-20">
                      FRAME {String(frame.frame_number).padStart(2, '0')} - {frame.timestamp_hint}
                    </div>
                  </div>

                  {/* Content Area */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex flex-wrap gap-1 items-center">
                          {frame.character_present && (
                            <span className="text-[9px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded border border-purple-500/30 font-semibold uppercase">
                              Character Present
                            </span>
                          )}
                          <span className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30 font-semibold uppercase">
                            {frame.camera_angle}
                          </span>
                          <span className="text-[9px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30 font-semibold uppercase">
                            {frame.lighting}
                          </span>
                        </div>
                        
                        <div className="flex gap-1 h-2 opacity-60 ml-2 shrink-0">
                          <div className="w-2 h-full bg-blue-600 rounded-full" title={frame.colour_palette}></div>
                          <div className="w-2 h-full bg-purple-700 rounded-full" title={frame.colour_palette}></div>
                          <div className="w-2 h-full bg-amber-500 rounded-full" title={frame.colour_palette}></div>
                        </div>
                      </div>
                      
                      <p className="text-[11px] text-gray-400 line-clamp-3 leading-relaxed mb-2">
                        {frame.scene_description}
                      </p>
                      
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(frame.flow_prompt);
                          alert("Flow prompt copied!");
                        }}
                        className="w-full text-left mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded cursor-pointer hover:bg-amber-500/20 transition-colors group/flow"
                      >
                        <div className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-1 flex items-center justify-between">
                          Flow Prompt <Copy className="w-3 h-3 opacity-0 group-hover/flow:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-[11px] text-gray-300 font-medium">
                          {frame.flow_prompt}
                        </div>
                      </button>
                    </div>

                    {/* Prompt Copy */}
                    <div className="mt-4 flex gap-2">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(frame.image_prompt);
                        alert("Image prompt copied!");
                      }}
                      className="flex-1 py-1.5 border border-[#333] hover:border-amber-500 text-[9px] font-bold uppercase rounded transition-colors"
                    >
                      Copy Prompt
                    </button>
                    <button 
                      className="p-1.5 border border-[#333] hover:border-amber-500 rounded transition-colors"
                      onClick={() => toggleDescription(idx)}
                      title="Toggle full details"
                    >
                      {expandedDescriptions[idx] ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
                    </button>
                  </div>
                  
                  {expandedDescriptions[idx] && (
                     <div className="mt-3 text-[10px] text-gray-400 bg-black/50 p-2 rounded border border-white/10 break-all font-mono">
                        {frame.image_prompt}
                     </div>
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>
        
        {/* Status Footer */}
        {state.frames.length > 0 && !state.isGeneratingImages && (
          <div className="mt-auto shrink-0 h-12 border-t border-[#1a1a1a] flex items-center justify-between px-6 opacity-50 bg-[#050505]">
            <p className="text-[10px] uppercase tracking-widest text-[#e5e5e5]">Status: All Frames Optimized for local video workflow</p>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-bold uppercase text-[#e5e5e5]">Local FLUX Engine Active</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
