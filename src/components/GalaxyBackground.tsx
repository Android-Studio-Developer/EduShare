import Galaxy from "./Galaxy.jsx";

export default function GalaxyBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      <Galaxy
        density={0.9}
        hueShift={220}
        saturation={0.5}
        glowIntensity={0.35}
        twinkleIntensity={0.4}
        rotationSpeed={0.04}
        speed={0.6}
        mouseInteraction
        mouseRepulsion={false}
        transparent
      />
    </div>
  );
}
