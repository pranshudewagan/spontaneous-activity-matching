const METERS_PER_MILE = 1609.344;

export const metersToMiles = (meters: number): number => meters / METERS_PER_MILE;
export const milesToMeters = (miles: number): number => miles * METERS_PER_MILE;

/** Format a distance in meters as a human-readable miles string, e.g. "0.3 mi" or "2.1 mi" */
export const formatDistanceMi = (meters: number): string => {
  const miles = metersToMiles(meters);
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
};
