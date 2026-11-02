Chart comparison screenshots for perses/shared#427, perses/plugins#913 and perses/perses#4698.

PNG columns: before, after, exact RGBA pixel differences highlighted in pink. Captured with fixed UTC data, animations disabled, 500 x 300 chart size and the application border-box sizing. Shared sheets isolate the dependency upgrade; plugin-fixes sheets hold shared/ECharts6 constant; plugin-overall shows the combined version upgrade; Perses sheets provide combined-upgrade context only because its PR changes Immer rather than chart rendering.

Source heads: shared 5964afc0f8c7c7b0a5e7a60512e8584fe3aa7d8f; plugins 9384bdb923fb4669d0799311569bbf4c38fcc07e; perses 723463263494932667a97d30d8430fe3e08cfc83.
