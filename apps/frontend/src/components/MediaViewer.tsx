"use client";

import { useEffect, useCallback } from "react";
import Image, { resolve } from "./Image";
import Video from "./Video";

type MediaViewerProps = {
  url: string;
  type: "image" | "video";
  onClose: () => void;
};

const MediaViewer = ({ url, type, onClose }: MediaViewerProps) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    // Prevent scrolling when modal is open
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "auto";
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors z-[110]"
        aria-label="Close"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div
        className="relative max-w-[95vw] max-h-[95vh] flex items-center justify-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {type === "video" ? (
          <Video
            path={url}
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
          />
        ) : (
          <div className="relative group">
             {/* Using standard img for full control over sizing in viewer */}
             <img
                src={resolve(url)}
                alt="media"
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              />
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaViewer;
