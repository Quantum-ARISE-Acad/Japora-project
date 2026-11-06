"use client";

/** Screen-only print trigger — hidden on the printed page itself. */
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="btn-primary no-print"
    >
      Print this flyer
    </button>
  );
}
