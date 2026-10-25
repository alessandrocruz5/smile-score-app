import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

type HistoryItem = { id: string; smileScore: number; createdAt: Date };

export function HistoryGrid({ items }: { items: HistoryItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No smiles yet. Upload a photo above.</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={`/results/${item.id}`} className="block">
            <Card size="sm">
              {/* Plain <img>: next/image's optimizer fetches without the user's cookies, so it would 404 or cache a private image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/uploads/${item.id}/image`}
                alt={`Smile scoring ${item.smileScore}`}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
              <CardContent>
                <p className="text-lg font-semibold">{item.smileScore}</p>
                <p className="text-xs text-muted-foreground">
                  {item.createdAt.toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
