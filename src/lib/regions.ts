export type Region = {
  slug: string;
  label: string;
  country: string;
};

export type Category = {
  slug: string;
  label: string;
  icon: string;
};

// Ordered Togo-first → Francophone West Africa → the rest. The launch market
// leads the list so it's the default eye-line in every region picker.
export const REGIONS: Region[] = [
  // Togo — launch market
  { slug: "lome", label: "Lomé", country: "Togo" },
  { slug: "foire-lome-cetef", label: "Foire de Lomé (CETEF)", country: "Togo" },
  { slug: "aneho", label: "Aného", country: "Togo" },
  { slug: "atakpame", label: "Atakpamé", country: "Togo" },
  { slug: "bassar", label: "Bassar", country: "Togo" },
  { slug: "dapaong", label: "Dapaong", country: "Togo" },
  { slug: "kpalime", label: "Kpalimé", country: "Togo" },
  { slug: "kara", label: "Kara", country: "Togo" },
  { slug: "sokode", label: "Sokodé", country: "Togo" },
  { slug: "tsevie", label: "Tsévié", country: "Togo" },
  // Other West African country capitals and commercial centres.
  { slug: "cotonou", label: "Cotonou", country: "Bénin" },
  { slug: "porto-novo", label: "Porto-Novo", country: "Bénin" },
  { slug: "abomey-calavi", label: "Abomey-Calavi", country: "Bénin" },
  { slug: "ouidah", label: "Ouidah", country: "Bénin" },
  { slug: "abidjan", label: "Abidjan", country: "Côte d'Ivoire" },
  { slug: "yamoussoukro", label: "Yamoussoukro", country: "Côte d'Ivoire" },
  { slug: "dakar", label: "Dakar", country: "Sénégal" },
  { slug: "ouagadougou", label: "Ouagadougou", country: "Burkina Faso" },
  { slug: "bamako", label: "Bamako", country: "Mali" },
  { slug: "niamey", label: "Niamey", country: "Niger" },
  { slug: "praia", label: "Praia", country: "Cap-Vert" },
  { slug: "banjul", label: "Banjul", country: "Gambie" },
  { slug: "conakry", label: "Conakry", country: "Guinée" },
  { slug: "bissau", label: "Bissau", country: "Guinée-Bissau" },
  { slug: "monrovia", label: "Monrovia", country: "Liberia" },
  { slug: "nouakchott", label: "Nouakchott", country: "Mauritanie" },
  { slug: "freetown", label: "Freetown", country: "Sierra Leone" },
  { slug: "accra", label: "Accra", country: "Ghana" },
  { slug: "kumasi", label: "Kumasi", country: "Ghana" },
  { slug: "lagos-mainland", label: "Lagos Mainland", country: "Nigeria" },
  { slug: "lagos-island", label: "Lagos Island", country: "Nigeria" },
  { slug: "abuja", label: "Abuja", country: "Nigeria" },
  { slug: "port-harcourt", label: "Port Harcourt", country: "Nigeria" },
  // East & Southern Africa
  { slug: "nairobi", label: "Nairobi", country: "Kenya" },
  { slug: "mombasa", label: "Mombasa", country: "Kenya" },
  { slug: "kampala", label: "Kampala", country: "Uganda" },
  { slug: "kigali", label: "Kigali", country: "Rwanda" },
  { slug: "dar-es-salaam", label: "Dar es Salaam", country: "Tanzania" },
  { slug: "johannesburg", label: "Johannesburg", country: "South Africa" },
];

export const CATEGORIES: Category[] = [
  { slug: "fashion", label: "Fashion", icon: "👗" },
  { slug: "food", label: "Food", icon: "🍲" },
  { slug: "beauty", label: "Beauty", icon: "💄" },
  { slug: "electronics", label: "Electronics", icon: "📱" },
  { slug: "home", label: "Home", icon: "🏠" },
  { slug: "groceries", label: "Groceries", icon: "🛒" },
  { slug: "services", label: "Services", icon: "🛠️" },
  { slug: "other", label: "Other", icon: "✨" },
];

/** French names of the categories, shown in the marketplace and used by search. */
export const CATEGORY_LABEL_FR: Record<string, string> = {
  fashion: "Mode & Wax",
  food: "Alimentation",
  beauty: "Beauté & Soins",
  electronics: "Électronique",
  home: "Maison & Déco",
  groceries: "Épicerie",
  services: "Services",
  other: "Autres",
};

/** Popular West African market names offered as starting points; custom names remain accepted. */
export const COOPERATIVE_NAME_SUGGESTIONS = [
  "Grand Marché de Lomé (Assigamé)",
  "Marché de Hanoukopé (Lomé)",
  "Marché de Tsévié",
  "Marché de Kpalimé",
  "Marché de Sokodé",
  "Marché Dantokpa (Cotonou)",
  "Marché Sandaga (Dakar)",
  "Marché Makola (Accra)",
  "Marché Madina (Conakry)",
  "Grand Marché de Ouagadougou",
  "Grand Marché de Bamako",
  "Marché de Banjul",
  "Association des commerçants de ma ville",
] as const;

export function findRegion(slug: string): Region | undefined {
  return REGIONS.find((r) => r.slug === slug);
}

export function regionLabel(value: string): string {
  return findRegion(value)?.label ?? value;
}

export function findCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

/** Country names as [français, English], for tr(...countryName(c)). */
const COUNTRY_NAMES: Record<string, [string, string]> = {
  "Bénin": ["Bénin", "Benin"],
  "Burkina Faso": ["Burkina Faso", "Burkina Faso"],
  "Cap-Vert": ["Cap-Vert", "Cape Verde"],
  "Côte d'Ivoire": ["Côte d'Ivoire", "Côte d'Ivoire"],
  "Gambie": ["Gambie", "Gambia"],
  "Ghana": ["Ghana", "Ghana"],
  "Guinée": ["Guinée", "Guinea"],
  "Guinée-Bissau": ["Guinée-Bissau", "Guinea-Bissau"],
  "Kenya": ["Kenya", "Kenya"],
  "Liberia": ["Liberia", "Liberia"],
  "Mali": ["Mali", "Mali"],
  "Mauritanie": ["Mauritanie", "Mauritania"],
  "Niger": ["Niger", "Niger"],
  "Nigeria": ["Nigeria", "Nigeria"],
  "Rwanda": ["Rwanda", "Rwanda"],
  "Sénégal": ["Sénégal", "Senegal"],
  "Sierra Leone": ["Sierra Leone", "Sierra Leone"],
  "South Africa": ["Afrique du Sud", "South Africa"],
  "Tanzania": ["Tanzanie", "Tanzania"],
  "Togo": ["Togo", "Togo"],
  "Uganda": ["Ouganda", "Uganda"],
};

export function countryName(country: string): [string, string] {
  return COUNTRY_NAMES[country] ?? [country, country];
}

/** Category name as [français, English], for tr(...categoryName(c)). */
export function categoryName(c: { slug: string; label: string }): [string, string] {
  return [CATEGORY_LABEL_FR[c.slug] ?? c.label, c.label];
}
