"use client";
import { usePublicLang } from "@/components/PublicLanguageProvider";

/** Bouton d’impression visible à l’écran et masqué sur la page imprimée. */
export default function PrintButton() {
  const { tr } = usePublicLang();
  return (
    <button
      onClick={() => window.print()}
      className="btn-primary no-print"
    >
      {tr("Imprimer le flyer", "Print the flyer")}
    </button>
  );
}
