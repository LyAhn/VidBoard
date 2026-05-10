import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { FrameData } from "@/lib/vidboard-types";

interface ExportZipOptions {
  artistName: string;
  trackTitle: string;
  frames: FrameData[];
}

export const exportStoryboardZip = async ({
  artistName,
  trackTitle,
  frames,
}: ExportZipOptions) => {
  if (!frames.length) return;

  const zip = new JSZip();
  frames.forEach((frame, index) => {
    if (frame.startImageBase64) {
      const base64Data = frame.startImageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
      zip.file(`Frame_${String(index + 1).padStart(2, "0")}_Start.png`, base64Data, {
        base64: true,
      });
    }

    if (frame.endImageBase64) {
      const base64Data = frame.endImageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
      zip.file(`Frame_${String(index + 1).padStart(2, "0")}_End.png`, base64Data, {
        base64: true,
      });
    }
  });

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${artistName}_${trackTitle}_Storyboard.zip`.replace(/\s+/g, "_"));
};
