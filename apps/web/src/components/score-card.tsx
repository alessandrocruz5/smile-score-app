import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { scoreLabel } from "@/lib/score-label";

export function ScoreCard({ score, date }: { score: number; date: Date }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Smile score</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-6xl font-semibold tabular-nums">{score}</p>
        <p className="text-lg font-medium">{scoreLabel(score)}</p>
        <p className="text-xs text-muted-foreground">{date.toLocaleDateString()}</p>
      </CardContent>
    </Card>
  );
}
