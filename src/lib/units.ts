const METERS_PER_MILE = 1609.344;

export const metersToMiles = (meters: number): number => meters / METERS_PER_MILE;
export const milesToMeters = (miles: number): number => miles * METERS_PER_MILE;

/** Format a distance in meters as a human-readable miles string, e.g. "Nearby" or "3 mi" */
export const formatDistanceMi = (meters: number): string => {
  const miles = metersToMiles(meters);
  return miles < 1 ? 'Nearby' : `${Math.round(miles)} mi`;
};
