/** Public catalogue shape shared by the existing map and admin forms. */
export type PlotRecord = {
  id: string | number;
  name: string;
  area?: string | number | null;
  building_area_m2?: string | number | null;
  buildingAreaM2?: string | number | null;
  property_type?: string;
  propertyType?: string;
  industry?: string;
  status?: string;
  ownership_type?: string;
  ownershipType?: string;
  infrastructure?: Record<string, string | number | boolean | null>;
  image?: string | null;
  image_url?: string;
  photo_url?: string;
  auksionUrl?: string;
  auksion_url?: string;
  auction_url?: string;
  polygonCoordinates?: [number, number][];
  polygon_coords?: [number, number][];
  lat?: string | number;
  lng?: string | number;
  [key: string]: unknown;
};

export type MapViewport = { center: [number, number]; zoom: number };
