export interface Destination {
  id: string;
  osmId: string | null;
  name: string;
  address: string;
  lat: number;
  lng: number;
  notes: string;
  sortOrder: number;
}

export interface Trip {
  id: string;
  title: string;
  description: string | null;
  shareSlug: string | null;
  isPublic: boolean;
  userId: string;
  destinations: Destination[];
  createdAt: Date;
  updatedAt: Date;
}
