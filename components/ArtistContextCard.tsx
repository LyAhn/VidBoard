import { Activity } from "lucide-react";

interface ArtistContextCardProps {
  artistContext: string;
}

export function ArtistContextCard({ artistContext }: ArtistContextCardProps) {
  return (
    <div className="glass rounded-xl p-4 flex flex-col md:flex-row gap-6 items-start shrink-0">
      <div className="flex-1">
        <h2 className="text-[10px] text-amber-500 uppercase font-black mb-2 tracking-[0.2em] flex items-center gap-2">
          <Activity className="w-3 h-3" /> Artist Research (Ollama Web Search)
        </h2>
        <div className="text-sm text-gray-400 leading-relaxed italic border-l-2 border-amber-500/30 pl-4 whitespace-pre-wrap">
          {artistContext}
        </div>
      </div>
    </div>
  );
}
