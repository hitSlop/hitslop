export type LuggageCategory = {
  id: string;
  name: string;
  tagCode: string;
  color: string;
};

export type PackingItem = {
  id: string;
  categoryId: string;
  text: string;
  quantity: number;
  packed: boolean;
  essential: boolean;
  note?: string;
};

export type PackingDoc = {
  tripTitle: string;
  destination: string;
  departureDate: string;
  traveler: string;
  bagTag: string;
  flag?: string;
  categories: LuggageCategory[];
  items: PackingItem[];
};
