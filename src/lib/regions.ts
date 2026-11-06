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
  { slug: "sokode", label: "Sokodé", country: "Togo" },
  { slug: "kara", label: "Kara", country: "Togo" },
  // Francophone West Africa (XOF zone) — expansion
  { slug: "cotonou", label: "Cotonou", country: "Bénin" },
  { slug: "abomey-calavi", label: "Abomey-Calavi", country: "Bénin" },
  { slug: "ouidah", label: "Ouidah", country: "Bénin" },
  { slug: "abidjan", label: "Abidjan", country: "Côte d'Ivoire" },
  { slug: "dakar", label: "Dakar", country: "Senegal" },
  { slug: "ouagadougou", label: "Ouagadougou", country: "Burkina Faso" },
  { slug: "bamako", label: "Bamako", country: "Mali" },
  { slug: "niamey", label: "Niamey", country: "Niger" },
  // Anglophone West Africa
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

export function findRegion(slug: string): Region | undefined {
  return REGIONS.find((r) => r.slug === slug);
}

export function findCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
