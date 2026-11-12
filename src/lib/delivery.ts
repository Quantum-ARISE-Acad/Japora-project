import { majorToCents } from "./currency";

/**
 * Delivery configuration and fee calculation utilities.
 * Supports default base fees and zone-specific pricing.
 */

export interface DeliveryZone {
  name: string;
  feeCents: number;
}

/**
 * Parses a delivery zones string into structured zones.
 * Explicit prices are entered in major currency units (e.g. 1000 XOF).
 * Returned fees and defaultFeeCents use the app's internal hundredths.
 * Format examples:
 * - "Lomé Centre: 1000, Agoè: 1500, Baguida: 2000"
 * - "Lomé, Kpalimé, Kara" (uses defaultFeeCents)
 */
export function parseDeliveryZones(
  zonesStr: string,
  defaultFeeCents: number = 0
): DeliveryZone[] {
  if (!zonesStr || !zonesStr.trim()) return [];

  return zonesStr
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(.+?)(?::\s*(\d+(?:\.\d+)?))?$/);
      if (!match) return { name: item, feeCents: defaultFeeCents };

      const name = match[1].trim();
      const rawPrice = match[2];

      if (rawPrice !== undefined) {
        // Convert the entered amount once; the fallback is already in stored units.
        const parsed = parseFloat(rawPrice);
        return {
          name,
          feeCents: isNaN(parsed) ? defaultFeeCents : majorToCents(parsed),
        };
      }

      return { name, feeCents: defaultFeeCents };
    });
}

/**
 * Calculates delivery fee based on vendor settings and selected zone.
 */
export function calculateDeliveryFee(
  vendor: {
    deliveryEnabled?: boolean;
    deliveryFeeCents?: number;
    deliveryZones?: string;
  },
  selectedZoneName?: string
): number {
  if (!vendor.deliveryEnabled) return 0;

  const defaultFee = vendor.deliveryFeeCents || 0;
  if (!selectedZoneName || !vendor.deliveryZones) return defaultFee;

  const zones = parseDeliveryZones(vendor.deliveryZones, defaultFee);
  const found = zones.find(
    (z) => z.name.toLowerCase() === selectedZoneName.toLowerCase()
  );

  return found ? found.feeCents : defaultFee;
}
