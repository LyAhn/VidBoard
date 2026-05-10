import { jsPDF } from "jspdf";
import type { AspectRatio, FrameData } from "@/lib/vidboard-types";

interface ExportPdfOptions {
  artistName: string;
  trackTitle: string;
  theme: string;
  aspectRatio: AspectRatio;
  visualBible: string | null;
  frames: FrameData[];
}

export const exportStoryboardPdf = ({
  artistName,
  trackTitle,
  theme,
  aspectRatio,
  visualBible,
  frames,
}: ExportPdfOptions) => {
  if (!frames.length) return;

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
    const trimmedVisualBible = visualBible?.trim();
    const trimmed = prompt.trim();
    if (trimmedVisualBible && trimmed.startsWith(trimmedVisualBible)) {
      return trimmed.slice(trimmedVisualBible.length).trim();
    }
    return trimmed;
  };

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(26);
  pdf.text(`${artistName} - ${trackTitle}`, margin, 24);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  pdf.text(`Theme/Mood: ${theme || "Not specified"}`, margin, 39);
  pdf.text(`Total Clips: ${frames.length}`, margin, 48);

  if (visualBible) {
    sectionLabel("Visual Bible", margin, 67);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(11);
    writeWrapped(visualBible, margin, 76, contentWidth, 5);
    pdf.setFont("helvetica", "normal");
  }

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    pdf.addPage();

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);
    pdf.text(
      `Frame ${frame.frame_number}: ${frame.timestamp_hint} | Clip ${i + 1} of ${frames.length}`,
      margin,
      18
    );

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    let y = writeWrapped(`Lyric: "${frame.lyric_line}"`, margin, 28, contentWidth, 5) + 3;

    const columnGap = 8;
    const columnWidth = (contentWidth - columnGap * 2) / 3;
    sectionLabel("Camera", margin, y);
    sectionLabel("Lighting", margin + columnWidth + columnGap, y);
    sectionLabel("Palette", margin + (columnWidth + columnGap) * 2, y);
    pdf.setFontSize(9);
    y += 7;
    const cameraY = writeWrapped(frame.camera_angle, margin, y, columnWidth, 4.3);
    const lightingY = writeWrapped(
      frame.lighting,
      margin + columnWidth + columnGap,
      y,
      columnWidth,
      4.3
    );
    const paletteY = writeWrapped(
      frame.colour_palette,
      margin + (columnWidth + columnGap) * 2,
      y,
      columnWidth,
      4.3
    );
    y = Math.max(cameraY, lightingY, paletteY) + 5;

    sectionLabel("Scene", margin, y);
    pdf.setFontSize(10);
    y = writeWrapped(frame.scene_description, margin, y + 7, contentWidth, 5) + 4;

    pdf.setFillColor(245, 238, 225);
    pdf.rect(margin, y, contentWidth, 15, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("FLOW PROMPT", margin + 3, y + 6);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    writeWrapped(frame.flow_prompt, margin + 35, y + 6, contentWidth - 40, 5);
    y += 23;

    sectionLabel("Generation Prompt Preview", margin, y);
    pdf.setFont("courier", "normal");
    pdf.setFontSize(8);
    const previewLines = pdf.splitTextToSize(stripVisualBible(frame.image_prompt), contentWidth) as string[];
    pdf.text(previewLines.slice(0, 8), margin, y + 7);
    pdf.setFont("helvetica");
    y += 45;

    const format =
      aspectRatio === "16:9"
        ? { w: 120, h: 67.5 }
        : aspectRatio === "9:16"
          ? { w: 45, h: 80 }
          : { w: 60, h: 60 };
    const imgY = Math.min(y + 4, pageHeight - format.h - 16);

    if (frame.startImageBase64) {
      pdf.setFontSize(9);
      pdf.text("Flow Start Frame", margin, imgY - 2);
      const dataUrl = frame.startImageBase64.includes("data:image")
        ? frame.startImageBase64
        : `data:image/png;base64,${frame.startImageBase64}`;
      pdf.addImage(dataUrl, "PNG", margin, imgY, format.w, format.h);
    }

    if (frame.endImageBase64) {
      pdf.setFontSize(9);
      pdf.text("Flow End Frame", margin + 135, imgY - 2);
      const dataUrl = frame.endImageBase64.includes("data:image")
        ? frame.endImageBase64
        : `data:image/png;base64,${frame.endImageBase64}`;
      pdf.addImage(dataUrl, "PNG", margin + 135, imgY, format.w, format.h);
    }
  }

  pdf.addPage();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Appendix: Full Generation Prompts", margin, 18);

  let appendixY = 31;
  frames.forEach((frame, idx) => {
    const lines = pdf.splitTextToSize(frame.image_prompt.trim(), contentWidth) as string[];
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

  pdf.save(`${artistName}_Storyboard.pdf`.replace(/\s+/g, "_"));
};
