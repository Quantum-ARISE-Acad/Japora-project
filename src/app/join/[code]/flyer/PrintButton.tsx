"use client";

/** Bouton d’impression visible à l’écran et masqué sur la page imprimée. */
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="btn-primary no-print"
    >
      Imprimer le flyer
    </button>
  );
}
