import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Components } from "@/lib/validation";

const BARS: { key: keyof Components; label: string }[] = [
  { key: "mouth_smile", label: "Mouth smile" },
  { key: "eye_crinkle", label: "Eye crinkle" },
  { key: "mouth_open", label: "Mouth open" },
];

export function BreakdownBars({ components }: { components: Components }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {BARS.map(({ key, label }) => {
          const percent = Math.round(components[key] * 100);
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-baseline justify-between text-sm">
                <span>{label}</span>
                <span className="tabular-nums text-muted-foreground">{percent}%</span>
              </div>
              <div
                role="meter"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
