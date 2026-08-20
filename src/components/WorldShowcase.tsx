import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";

export default function WorldShowcase({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % images.length), 5500);
    return () => window.clearInterval(timer);
  }, [images.length]);

  if (images.length === 0) return null;
  const move = (step: number) => setActive((current) => (current + step + images.length) % images.length);

  return (
    <div className="relative overflow-hidden bg-black/20">
      <div className="relative aspect-[21/9] overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.img
            key={images[active]}
            src={images[active]}
            alt={`${name} world showcase ${active + 1}`}
            initial={{ opacity: 0, scale: 1.06, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </AnimatePresence>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
        {images.length > 1 && <>
          <button type="button" onClick={() => move(-1)} aria-label="Previous image" className="cursor-target absolute top-1/2 left-3 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur hover:bg-black/70"><ChevronLeft size={18} /></button>
          <button type="button" onClick={() => move(1)} aria-label="Next image" className="cursor-target absolute top-1/2 right-3 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur hover:bg-black/70"><ChevronRight size={18} /></button>
          <span className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] text-white/75 backdrop-blur"><Images size={11} /> {active + 1}/{images.length}</span>
        </>}
      </div>
      {images.length > 1 && <div className="flex gap-2 overflow-x-auto border-t border-border p-3">
        {images.map((image, index) => <button type="button" key={`${image.slice(-20)}-${index}`} onClick={() => setActive(index)} className={`cursor-target h-12 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${index === active ? "border-brand-400 opacity-100" : "border-transparent opacity-45 hover:opacity-80"}`}><img src={image} alt={`Show image ${index + 1}`} className="h-full w-full object-cover" /></button>)}
      </div>}
    </div>
  );
}
