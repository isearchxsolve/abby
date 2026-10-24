import { expectTypeOf, test } from "vitest";
import { createAbby } from "../src";

const abby = createAbby({
  projectId: "type-check",
  currentEnvironment: "development",
  environments: ["development", "production"],
  tests: {
    pricing: {
      variants: ["control", "annual"] as const,
    },
  },
  flags: ["newNav"] as const,
  remoteConfig: {
    headline: "String",
    maxItems: "Number",
    visible: "Boolean",
  },
});

test("preserves variant, flag, and remote-config types", () => {
  const experiment = abby.useAbby("pricing");
  const mappedExperiment = abby.useAbby("pricing", {
    control: { title: "Monthly" },
    annual: { title: "Annual" },
  });

  const enabled = abby.useFeatureFlag("newNav");
  const headline = abby.useRemoteConfig("headline");
  const maxItems = abby.useRemoteConfig("maxItems");
  const visible = abby.useRemoteConfig("visible");

  expectTypeOf(experiment.variant.value).toEqualTypeOf<"control" | "annual">();
  expectTypeOf(mappedExperiment.variant.value).toEqualTypeOf<{
    title: string;
  }>();
  expectTypeOf(enabled.value).toEqualTypeOf<boolean>();
  expectTypeOf(headline.value).toEqualTypeOf<string>();
  expectTypeOf(maxItems.value).toEqualTypeOf<number>();
  expectTypeOf(visible.value).toEqualTypeOf<boolean>();
});
