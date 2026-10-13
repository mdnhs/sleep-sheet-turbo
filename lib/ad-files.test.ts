import { describe, expect, it } from "vitest";
import { composeAdCode, splitAdCode } from "@/features/promotions/ad-files";
import { SAMPLE_AD } from "@/features/promotions/sample-ad";

describe("ad files", () => {
  it("splits style and inline script out of the html", () => {
    const files = splitAdCode('<link rel="x">\n<style>\n.a{color:red}\n</style>\n<div class="a"></div>\n<script>\nrun()\n</script>');
    expect(files).toEqual({ html: '<link rel="x">\n\n<div class="a"></div>', css: ".a{color:red}", js: "run()" });
  });

  it("keeps external scripts in the html", () => {
    expect(splitAdCode('<script src="https://x/y.js"></script><p>a</p>').html).toContain("src=");
  });

  it("composes back into one document", () => {
    expect(composeAdCode({ html: "<p>a</p>", css: "p{}", js: "go()" })).toBe(
      "<style>\np{}\n</style>\n<p>a</p>\n<script>\ngo()\n</script>",
    );
    expect(composeAdCode({ html: "<p>a</p>", css: "", js: "" })).toBe("<p>a</p>");
  });

  it("round-trips the sample ad", () => {
    const files = splitAdCode(SAMPLE_AD);
    expect(files.css).not.toBe("");
    expect(files.js).not.toBe("");
    expect(splitAdCode(composeAdCode(files))).toEqual(files);
  });
});
