import { describe, expect, it } from "vitest";
import { capitalizeWords } from "./capitalize-words";

describe("capitalizeWords", () => {
  it("capitalizes each English word", () => {
    expect(capitalizeWords("nazmul hasan sourab")).toBe("Nazmul Hasan Sourab");
  });

  it("leaves the rest of each word as typed", () => {
    expect(capitalizeWords("mcDonald ABDUL")).toBe("McDonald ABDUL");
  });

  it("starts words after address punctuation", () => {
    expect(capitalizeWords("house 12, road-5/a (near mosque).dhaka")).toBe("House 12, Road-5/A (Near Mosque).Dhaka");
  });

  it("keeps whitespace, digits and Bangla unchanged", () => {
    expect(capitalizeWords("  বাড়ি ১২, রোড ৫  ")).toBe("  বাড়ি ১২, রোড ৫  ");
    expect(capitalizeWords("mirpur 10, ঢাকা")).toBe("Mirpur 10, ঢাকা");
    expect(capitalizeWords("")).toBe("");
  });
});
