// The one function of topojson-client this site uses (the package ships no types).
declare module 'topojson-client' {
  type Ring = [number, number][];
  type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };
  type Feature = { type: 'Feature'; geometry: Geometry };
  export function feature(topology: object, object: object): Feature | { type: 'FeatureCollection'; features: Feature[] };
}
