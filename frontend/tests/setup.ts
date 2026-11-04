import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { clearReadCache } from "../src/lib/readCache";

beforeEach(() => clearReadCache());

afterEach(() => {
  cleanup();
});
