/**
 * Japora Buyer Loyalty Program (Programme Fidélité Acheteur).
 *
 * Points are accumulated automatically on paid orders:
 *  - 1 currency unit spent = 1 loyalty point (spend in cents / 100).
 *
 * Tiers:
 *  - Bronze: 0 - 9,999 points (Default buyer)
 *  - Silver (Argent): 10,000 - 49,999 points (5% discount perk)
 *  - Gold (Or): 50,000+ points (10% discount perk + priority delivery)
 */

export type LoyaltyTier = "bronze" | "silver" | "gold";

export type LoyaltyInfo = {
  tier: LoyaltyTier;
  label: string;
  points: number;
  discountPct: number;
  badgeColor: string;
  perk: string;
  nextTier?: {
    name: string;
    pointsNeeded: number;
    progressPct: number;
  };
};

const SILVER_THRESHOLD = 10000;
const GOLD_THRESHOLD = 50000;

export function computeLoyalty(totalSpentCents: number): LoyaltyInfo {
  const points = Math.max(0, Math.floor(totalSpentCents / 100));

  if (points >= GOLD_THRESHOLD) {
    return {
      tier: "gold",
      label: "Membre Or (VIP)",
      points,
      discountPct: 10,
      badgeColor: "bg-amber-500 text-white border-amber-400",
      perk: "10% de réduction permanente & livraison offerte",
    };
  }

  if (points >= SILVER_THRESHOLD) {
    const needed = GOLD_THRESHOLD - points;
    const progressPct = Math.round(((points - SILVER_THRESHOLD) / (GOLD_THRESHOLD - SILVER_THRESHOLD)) * 100);
    return {
      tier: "silver",
      label: "Membre Argent",
      points,
      discountPct: 5,
      badgeColor: "bg-slate-300 text-slate-900 border-slate-400",
      perk: "5% de réduction sur vos commandes",
      nextTier: {
        name: "Or",
        pointsNeeded: needed,
        progressPct,
      },
    };
  }

  const needed = SILVER_THRESHOLD - points;
  const progressPct = Math.round((points / SILVER_THRESHOLD) * 100);
  return {
    tier: "bronze",
    label: "Membre Bronze",
    points,
    discountPct: 0,
    badgeColor: "bg-aurora-warning/85 text-white border-aurora-warning",
    perk: "Accumulez des points à chaque commande",
    nextTier: {
      name: "Argent",
      pointsNeeded: needed,
      progressPct,
    },
  };
}
