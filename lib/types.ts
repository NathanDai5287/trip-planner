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

export interface BudgetData {
  gas: { mpg: number; pricePerGallon: number };
  food: { perDayPerPerson: number; people: number };
  lodging: { perNight: number; nights: number };
  parking: { total: number };
  attractions: { total: number };
  activities: { total: number };
  shopping: { total: number };
  laundry: { perLoad: number; loads: number };
  tolls: { total: number };
  misc: { total: number };
}

export const DEFAULT_BUDGET: BudgetData = {
  gas:        { mpg: 28, pricePerGallon: 3.80 },
  food:       { perDayPerPerson: 30, people: 1 },
  lodging:    { perNight: 0, nights: 0 },
  parking:    { total: 0 },
  attractions:{ total: 0 },
  activities: { total: 0 },
  shopping:   { total: 0 },
  laundry:    { perLoad: 4, loads: 0 },
  tolls:      { total: 0 },
  misc:       { total: 0 },
};

export interface PackingItem {
  id: string;
  text: string;
  checked: boolean;
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
  budget: BudgetData | null;
  packingList: PackingItem[];
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
