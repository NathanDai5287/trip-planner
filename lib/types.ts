export interface Destination {
  id: string;
  osmId: string | null;
  name: string;
  address: string;
  lat: number;
  lng: number;
  notes: string;
  sortOrder: number;
  dayIndex: number;
}

export interface Trip {
  id: string;
  title: string;
  description: string | null;
  shareSlug: string | null;
  isPublic: boolean;
  userId: string;
  destinations: Destination[];
  totalDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PointOfInterest {
  id: string;
  name: string;
  type: "gym" | "library";
  lat: number;
  lng: number;
  tags: Record<string, string>;
}

export type POIType = PointOfInterest["type"];
