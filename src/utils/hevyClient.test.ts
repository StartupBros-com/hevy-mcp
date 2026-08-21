import { describe, expect, it, vi } from "vitest";
import { createClient, requireHevyClient } from "./hevyClient";

// Mock the Kubb client
vi.mock("./hevyClientKubb.js", () => ({
	createClient: vi.fn().mockReturnValue({ mockedClient: true }),
}));

describe("hevyClient", () => {
	describe("createClient", () => {
		it("should create a client with the correct configuration", () => {
			// Arrange
			const apiKey = "test-api-key";
			const baseUrl = "https://api.hevy.com";

			// Reset mocks
			vi.clearAllMocks();

			// Act
			const client = createClient(apiKey, baseUrl);

			// Assert
			expect(client).toEqual({ mockedClient: true });
		});
	});

	describe("requireHevyClient", () => {
		it("returns the initialized client unchanged", () => {
			const client = { mockedClient: true };

			expect(requireHevyClient(client)).toBe(client);
		});

		it.each([null, undefined])(
			"throws the shared initialization error for %s",
			(client) => {
				expect(() => requireHevyClient(client)).toThrow(
					"API client not initialized. Please provide HEVY_API_KEY.",
				);
			},
		);
	});
});
