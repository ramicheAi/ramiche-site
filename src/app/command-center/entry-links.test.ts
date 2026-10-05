/**
 * P06 M5C: no first-party cockpit link, redirect or navigation may point at the site root "/", which is the public
 * marketing homepage on every non-cockpit host. Cockpit "home" is /command-center.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const ROOTS = ["src/app/command-center", "src/app/command-login", "src/components/command-center"];
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
const ROOT_TARGET = /(?:href=\{?\s*|(?:push|replace|assign|redirect)\(\s*|location(?:\.href)?\s*=\s*)["'`]\/["'`]/;

it("no cockpit link or navigation targets the public root", () => {
  const offenders = ROOTS.flatMap((r) => files(join(process.cwd(), r)))
    .flatMap((f) => readFileSync(f, "utf8").split("\n").map((line, i) => ({ f, i: i + 1, line })))
    .filter(({ line }) => ROOT_TARGET.test(line))
    .map(({ f, i, line }) => `${f.replace(process.cwd() + "/", "")}:${i}: ${line.trim()}`);
  expect(offenders).toEqual([]);
});

it("the pattern catches the shapes it guards against", () => {
  for (const bad of [`href="/"`, `href={'/'}`, `router.push("/")`, `router.replace('/')`, "location.assign(`/`)", `window.location.href = "/"`, `redirect("/")`])
    expect(ROOT_TARGET.test(bad), bad).toBe(true);
  for (const ok of [`href="/command-center"`, `router.push("/command-center/chat")`, `href="/command-center/"`]) expect(ROOT_TARGET.test(ok), ok).toBe(false);
});
