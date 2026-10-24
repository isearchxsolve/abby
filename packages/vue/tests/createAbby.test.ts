import { mount } from "@vue/test-utils";
import { AbbyEventType, HttpService } from "@tryabby/core";
import { defineComponent, nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAbby } from "../src";

describe("@tryabby/vue", () => {
  beforeEach(() => {
    document.cookie = "";
    vi.restoreAllMocks();
  });

  it("returns the selected variant and dispatches ACT", async () => {
    const sendData = vi.spyOn(HttpService, "sendData").mockResolvedValue();

    const sdk = createAbby({
      projectId: "vue-test-project",
      currentEnvironment: "test",
      environments: ["test"],
      cookies: { disableByDefault: true },
      tests: {
        checkout: { variants: ["control", "streamlined"] },
      },
    });

    sdk.__abby__.updateLocalVariant("checkout", "streamlined");

    const Component = defineComponent({
      setup() {
        return sdk.useAbby("checkout");
      },
      template: `<button @click="onAct">{{ variant }}</button>`,
    });

    const wrapper = mount(Component, {
      global: {
        plugins: [sdk.AbbyPlugin],
      },
    });

    expect(wrapper.text()).toBe("streamlined");

    await wrapper.trigger("click");

    expect(sendData).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AbbyEventType.ACT,
        data: expect.objectContaining({
          projectId: "vue-test-project",
          testName: "checkout",
          selectedVariant: "streamlined",
        }),
      })
    );
  });

  it("reacts when a feature flag changes in core", async () => {
    const sdk = createAbby({
      projectId: "vue-flags",
      currentEnvironment: "test",
      environments: ["test"],
      flags: ["newCheckout"],
    });

    const Component = defineComponent({
      setup() {
        return { enabled: sdk.useFeatureFlag("newCheckout") };
      },
      template: `<span>{{ enabled }}</span>`,
    });

    const wrapper = mount(Component, {
      global: { plugins: [sdk.AbbyPlugin] },
    });

    expect(wrapper.text()).toBe("false");

    sdk.__abby__.updateFlag("newCheckout", true);
    await nextTick();

    expect(wrapper.text()).toBe("true");
  });

  it("reacts when remote configuration changes in core", async () => {
    const sdk = createAbby({
      projectId: "vue-config",
      currentEnvironment: "test",
      environments: ["test"],
      remoteConfig: {
        headline: "String",
      },
    });

    const Component = defineComponent({
      setup() {
        return { headline: sdk.useRemoteConfig("headline") };
      },
      template: `<span>{{ headline }}</span>`,
    });

    const wrapper = mount(Component, {
      global: { plugins: [sdk.AbbyPlugin] },
    });

    sdk.__abby__.updateRemoteConfig("headline", "Ship faster");
    await nextTick();

    expect(wrapper.text()).toBe("Ship faster");
  });

  it("maps variants through a lookup object", () => {
    const sdk = createAbby({
      projectId: "vue-lookup",
      currentEnvironment: "test",
      environments: ["test"],
      cookies: { disableByDefault: true },
      tests: {
        button: { variants: ["small", "large"] },
      },
    });

    sdk.__abby__.updateLocalVariant("button", "large");

    const Component = defineComponent({
      setup() {
        return sdk.useAbby("button", {
          small: "Small CTA",
          large: "Large CTA",
        });
      },
      template: `<span>{{ variant }}</span>`,
    });

    const wrapper = mount(Component, {
      global: { plugins: [sdk.AbbyPlugin] },
    });

    expect(wrapper.text()).toBe("Large CTA");
  });
});
