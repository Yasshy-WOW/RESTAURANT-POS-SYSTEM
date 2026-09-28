import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  // 実際のAzure MySQLへ都度往復するため、ローカルDB前提のデフォルト(5秒)では
  // 一覧が増えるほど間に合わなくなる。余裕を持たせる
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    screenshot: "only-on-failure",
  },
});
