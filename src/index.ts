import { defineExtension } from "@blinko-cloud/cli/sdk";

defineExtension({
  activate: async () => { /* The signed Custom View owns the visible lifecycle. */ },
});
