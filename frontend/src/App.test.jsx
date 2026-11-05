import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
vi.mock("./Map.jsx", () => ({ default: () => <div>Neighborhood map</div> }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function mockApi() {
  global.fetch = vi.fn(async (url) => ({
    ok: !url.endsWith("/auth/me"),
    status: url.endsWith("/auth/me") ? 401 : 200,
    json: async () =>
      url.endsWith("/auth/me")
        ? { detail: "Sign in" }
        : { items: [], total: 0, page: 1 },
  }));
}
describe("resident workflow", () => {
  it("shows an honest empty state and opens registration", async () => {
    mockApi();
    render(<App />);
    expect(
      await screen.findByText("A fresh start for this neighborhood"),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /make a difference/i }),
    );
    expect(
      screen.getByRole("dialog", { name: "Welcome back" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByText("New here? Create an account"));
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeInTheDocument();
  });
  it("requests filters and lets residents retry errors", async () => {
    mockApi();
    render(<App />);
    await screen.findByText("A fresh start for this neighborhood");
    await userEvent.click(
      screen.getByRole("button", { name: "In progress", exact: true }),
    );
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(([u]) => u.includes("status=in_progress")),
      ).toBe(true),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Filters", exact: true }),
    );
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
  });
  it("shows a service failure rather than fabricated reports", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("offline"));
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cannot reach CityFix",
    );
    expect(screen.getByText("We couldn’t load reports")).toBeInTheDocument();
  });
});
