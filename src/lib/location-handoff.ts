export type PickedLocation = {
  latitude: number;
  longitude: number;
  label: string;
};

let _picked: PickedLocation | null = null;

export const setPickedLocation  = (loc: PickedLocation) => { _picked = loc; };
export const takePickedLocation = (): PickedLocation | null => { const l = _picked; _picked = null; return l; };
