export const TAGS: { slug: string; label: string; color: string; icon: string }[] = [
  { slug: 'arts',       label: 'Arts & culture', color: '#B45C8A', icon: 'color-palette-outline' },
  { slug: 'fitness',    label: 'Fitness',         color: '#1E9E8E', icon: 'barbell-outline'        },
  { slug: 'food_drink', label: 'Food & drink',    color: '#F4845F', icon: 'restaurant-outline'     },
  { slug: 'games',      label: 'Games',           color: '#4F46E5', icon: 'game-controller-outline'},
  { slug: 'learning',   label: 'Learning',        color: '#3B82F6', icon: 'book-outline'           },
  { slug: 'music',      label: 'Music',           color: '#7C3AED', icon: 'musical-notes-outline'  },
  { slug: 'nightlife',  label: 'Nightlife',       color: '#DB2777', icon: 'moon-outline'           },
  { slug: 'outdoors',   label: 'Outdoors',        color: '#2AAFA8', icon: 'leaf-outline'           },
  { slug: 'social',     label: 'Social',          color: '#D97706', icon: 'people-outline'         },
  { slug: 'sports',     label: 'Sports',          color: '#C2520A', icon: 'football-outline'       },
];

export const tagColor = (slug: string): string =>
  TAGS.find(t => t.slug === slug)?.color ?? '#7A6560';
