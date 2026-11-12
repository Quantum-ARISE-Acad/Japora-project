import type { NextRequest } from "next/server";

/**
 * Adresse à mettre dans les liens et redirections envoyés au navigateur.
 *
 * Derrière un reverse proxy, `next start -H 0.0.0.0` donne `https://0.0.0.0:5174`
 * comme origine de la requête : le client recevrait un lien inutilisable. En
 * production on prend donc l'adresse publique configurée. En développement on
 * garde celle de la requête, pour que les tests depuis un téléphone restent possibles.
 */
export function publicOrigin(req: NextRequest): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (process.env.NODE_ENV === "production" && configured) return configured;
  return req.nextUrl.origin || configured || "http://localhost:5174";
}
