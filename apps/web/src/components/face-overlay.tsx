import type { Overlay } from "@/lib/validation";

type Segment = Overlay["lips"][number];

const toPath = (segments: Segment[]) =>
  segments.map(([x1, y1, x2, y2]) => `M ${x1} ${y1} L ${x2} ${y2}`).join(" ");

export function FaceOverlay({ id, overlay }: { id: string; overlay: Overlay }) {
  const [x, y, width, height] = overlay.bbox;
  // Coordinates are normalized 0-1, so the viewBox is 1x1 stretched over the image. Strokes must be
  // non-scaling, otherwise strokeWidth is in viewBox units and fills the whole image.
  const stroke = { fill: "none", strokeWidth: 2, vectorEffect: "non-scaling-stroke" } as const;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Plain <img>: next/image's optimizer fetches without the user's cookies, so it would 404 or cache a private image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/uploads/${id}/image`}
        alt="Your photo with face landmarks"
        className="block w-full h-auto"
      />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        aria-hidden
      >
        <rect x={x} y={y} width={width} height={height} stroke="#facc15" {...stroke} />
        <path d={toPath(overlay.face_oval)} stroke="#38bdf8" {...stroke} />
        <path d={toPath(overlay.lips)} stroke="#f472b6" {...stroke} />
        <path d={toPath(overlay.left_eye)} stroke="#4ade80" {...stroke} />
        <path d={toPath(overlay.right_eye)} stroke="#a78bfa" {...stroke} />
      </svg>
    </div>
  );
}
