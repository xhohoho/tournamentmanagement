'use client';

interface Props {
  url: string;
  onClose: () => void;
}

export function PosterLightbox({ url, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center">
        <img
          src={url}
          alt="Poster"
          className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
          onClick={e => e.stopPropagation()}
        />
        <button
          onClick={onClose}
          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 border border-white/20 text-white/80 hover:bg-black/90 hover:text-white font-bold text-sm transition-all cursor-pointer"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
