import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { errorMessage } from "../src/lib/errors";

describe("Messages d’erreur des services externes", () => {
  test("conserve le message d’une erreur standard", () => {
    assert.equal(errorMessage(new Error("Service indisponible"), "Réessayez"), "Service indisponible");
  });

  test("préfère le message détaillé renvoyé par Clerk", () => {
    assert.equal(errorMessage({ message: "Erreur", errors: [{ message: "Code expiré" }] }, "Réessayez"), "Code expiré");
  });

  test("utilise le message général quand le détail est absent ou invalide", () => {
    for (const errors of [[], [null], [12], [{ message: false }]]) {
      assert.equal(errorMessage({ message: "Erreur du service", errors }, "Réessayez"), "Erreur du service");
    }
  });

  test("revient au texte prévu pour les réponses inconnues", () => {
    for (const error of [null, undefined, "Erreur", 42, {}, { message: 42 }, { errors: [null] }]) {
      assert.equal(errorMessage(error, "Réessayez"), "Réessayez");
    }
  });
});
