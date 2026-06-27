export const TAGS: { slug: string; label: string; color: string }[] = [
  { slug: 'arts',       label: 'Arts & culture', color: '#B45C8A' },
  { slug: 'fitness',    label: 'Fitness',         color: '#1E9E8E' },
  { slug: 'food_drink', label: 'Food & drink',    color: '#F4845F' },
  { slug: 'games',      label: 'Games',           color: '#4F46E5' },
  { slug: 'learning',   label: 'Learning',        color: '#3B82F6' },
  { slug: 'music',      label: 'Music',           color: '#7C3AED' },
  { slug: 'nightlife',  label: 'Nightlife',       color: '#DB2777' },
  { slug: 'outdoors',   label: 'Outdoors',        color: '#2AAFA8' },
  { slug: 'social',     label: 'Social',          color: '#D97706' },
  { slug: 'sports',     label: 'Sports',          color: '#C2520A' },
];

export const tagColor = (slug: string): string =>
  TAGS.find(t => t.slug === slug)?.color ?? '#7A6560';
