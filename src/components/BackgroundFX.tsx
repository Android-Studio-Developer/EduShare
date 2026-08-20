import DotField from "./DotField";

export default function BackgroundFX() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      <DotField
        dotRadius={1.4}
        dotSpacing={17}
        cursorRadius={240}
        bulgeOnly
        bulgeStrength={55}
        glowRadius={220}
        gradientFrom="rgba(65, 105, 225, 0.28)"
        gradientTo="rgba(148, 163, 184, 0.10)"
        glowColor="#6690ff"
      />
      <div className="absolute -top-28 -left-20 h-96 w-96 rounded-full bg-blue-500/[.07] blur-3xl" />
      <div className="absolute top-20 -right-28 h-[30rem] w-[30rem] rounded-full bg-lime-400/[.035] blur-3xl" />
    </div>
  );
}
