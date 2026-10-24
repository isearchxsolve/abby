import {
  Abby,
  AbbyEventType,
  HttpService,
  type ABConfig,
  type AbbyConfig,
  type RemoteConfigValueString,
  type RemoteConfigValueStringToType,
  type ValidatorType,
} from "@tryabby/core";
import type { AbbyDataResponse } from "@tryabby/core";
import {
  computed,
  defineComponent,
  getCurrentInstance,
  inject,
  onMounted,
  onUnmounted,
  provide,
  shallowRef,
  type App,
  type ComputedRef,
  type InjectionKey,
  type Plugin,
  type PropType,
  type Ref,
} from "vue";
import {
  FlagStorageService,
  RemoteConfigStorageService,
  TestStorageService,
} from "./StorageService";

export type ABTestReturnValue<Lookup, Variant> = Lookup extends undefined
  ? Variant
  : Variant extends keyof Lookup
    ? Lookup[Variant]
    : never;

type PluginOptions = {
  initialData?: AbbyDataResponse;
};

export function createAbby<
  const FlagName extends string,
  const TestName extends string,
  const Tests extends Record<TestName, ABConfig>,
  const RemoteConfigName extends string,
  const RemoteConfig extends Record<
    RemoteConfigName,
    RemoteConfigValueString
  >,
  const User extends Record<string, ValidatorType> = Record<
    string,
    ValidatorType
  >,
>(
  abbyConfig: AbbyConfig<
    FlagName,
    Tests,
    string[],
    RemoteConfigName,
    RemoteConfig,
    User
  >
) {
  const abby = new Abby<
    FlagName,
    TestName,
    Tests,
    RemoteConfig,
    RemoteConfigName,
    string[],
    User
  >(
    abbyConfig,
    {
      get: (key) => TestStorageService.get(abbyConfig.projectId, key),
      set: (key, value, options) => {
        if (!abbyConfig.cookies?.disableByDefault) {
          TestStorageService.set(abbyConfig.projectId, key, value, options);
        }
      },
    },
    {
      get: (key) => FlagStorageService.get(abbyConfig.projectId, key),
      set: (key, value, options) =>
        FlagStorageService.set(abbyConfig.projectId, key, value, options),
    },
    {
      get: (key) => RemoteConfigStorageService.get(abbyConfig.projectId, key),
      set: (key, value, options) =>
        RemoteConfigStorageService.set(
          abbyConfig.projectId,
          key,
          value,
          options
        ),
    }
  );

  type ProjectData = ReturnType<typeof abby.getProjectData>;

  type AbbyContext = {
    data: Ref<ProjectData>;
  };

  const AbbySymbol: InjectionKey<AbbyContext> = Symbol("tryabby-vue");
  const globalData = shallowRef<ProjectData>(abby.getProjectData());

  abby.subscribe((nextData) => {
    globalData.value = nextData;
  });

  function getData(): Ref<ProjectData> {
    if (!getCurrentInstance()) {
      return globalData;
    }

    return inject(AbbySymbol, globalData);
  }

  async function loadInto(target: Ref<ProjectData>): Promise<void> {
    try {
      const data = await abby.loadProjectData();

      if (data) {
        target.value = data;
      }
    } catch {
      // Core defaults remain available when the project endpoint is unavailable.
    }
  }

  const AbbyProvider = defineComponent({
    name: "AbbyProvider",
    props: {
      initialData: {
        type: Object as PropType<AbbyDataResponse>,
        required: false,
      },
    },
    setup(props, { slots }) {
      const data = shallowRef<ProjectData>(
        props.initialData ? abby.init(props.initialData) : abby.getProjectData()
      );

      let unsubscribe: (() => void) | undefined;

      provide(AbbySymbol, { data });

      onMounted(() => {
        unsubscribe = abby.subscribe((nextData) => {
          data.value = nextData;
        });

        if (!props.initialData) {
          void loadInto(data);
        }
      });

      onUnmounted(() => {
        unsubscribe?.();
      });

      return () => slots.default?.() ?? null;
    },
  });

  const AbbyPlugin: Plugin = {
    install(app: App, options?: PluginOptions) {
      const data = shallowRef<ProjectData>(
        options?.initialData
          ? abby.init(options.initialData)
          : abby.getProjectData()
      );

      abby.subscribe((nextData) => {
        data.value = nextData;
      });

      app.provide(AbbySymbol, { data });
      app.component("AbbyProvider", AbbyProvider);

      if (!options?.initialData && typeof window !== "undefined") {
        void loadInto(data);
      }
    },
  };

  function useAbby<
    K extends keyof Tests,
    Variant extends Tests[K]["variants"][number],
    LookupValue,
    const Lookup extends Record<Variant, LookupValue> | undefined = undefined,
  >(
    name: K,
    lookup?: Lookup
  ): {
    variant: ComputedRef<ABTestReturnValue<Lookup, Variant>>;
    onAct: () => void;
  } {
    const data = getData();

    const selectedVariant = computed<Variant>(() => {
      const current = data.value.tests[name as TestName]?.selectedVariant;

      return (current ?? abby.getTestVariant(name)) as Variant;
    });

    const sendEvent = (type: AbbyEventType): void => {
      const variant = selectedVariant.value;

      if (!variant) {
        return;
      }

      void HttpService.sendData({
        url: abbyConfig.apiUrl,
        type,
        data: {
          projectId: abbyConfig.projectId,
          testName: name as string,
          selectedVariant: variant,
        },
      });
    };

    if (getCurrentInstance()) {
      onMounted(() => sendEvent(AbbyEventType.PING));
    } else if (typeof window !== "undefined") {
      sendEvent(AbbyEventType.PING);
    }

    return {
      variant: computed(() => {
        if (lookup === undefined) {
          return selectedVariant.value as ABTestReturnValue<Lookup, Variant>;
        }

        return lookup[
          selectedVariant.value
        ] as ABTestReturnValue<Lookup, Variant>;
      }),
      onAct: () => sendEvent(AbbyEventType.ACT),
    };
  }

  function useFeatureFlag(name: FlagName): ComputedRef<boolean> {
    const data = getData();

    return computed(() => {
      void data.value;
      return abby.getFeatureFlag(name);
    });
  }

  function useRemoteConfig<
    K extends RemoteConfigName,
    Value extends RemoteConfig[K],
  >(name: K): ComputedRef<RemoteConfigValueStringToType<Value>> {
    const data = getData();

    return computed(() => {
      void data.value;
      return abby.getRemoteConfig(name);
    });
  }

  return {
    AbbyPlugin,
    AbbyProvider,
    useAbby,
    useFeatureFlag,
    useRemoteConfig,
    getABTestValue: <
      K extends keyof Tests,
      Variant extends Tests[K]["variants"][number],
      LookupValue,
      Lookup extends Record<Variant, LookupValue> | undefined = undefined,
    >(
      name: K,
      lookup?: Lookup
    ): ABTestReturnValue<Lookup, Variant> => {
      const variant = abby.getTestVariant(name) as Variant;

      return (lookup === undefined
        ? variant
        : lookup[variant]) as ABTestReturnValue<Lookup, Variant>;
    },
    getFeatureFlagValue: (name: FlagName) => abby.getFeatureFlag(name),
    getRemoteConfig: <
      K extends RemoteConfigName,
      Value extends RemoteConfig[K],
    >(
      name: K
    ): RemoteConfigValueStringToType<Value> => abby.getRemoteConfig(name),
    getVariants: <K extends keyof Tests>(name: K) => abby.getVariants(name),
    getABResetFunction: <K extends keyof Tests>(name: K) => () =>
      TestStorageService.remove(abbyConfig.projectId, name as string),
    updateUserProperties: (
      user: Parameters<typeof abby.updateUserProperties>[0]
    ) => abby.updateUserProperties(user),
    __abby__: abby,
  };
}
