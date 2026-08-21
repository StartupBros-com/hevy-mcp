// Import the Kubb-based client
import { createClient as createKubbClient } from "./hevyClientKubb.js";

export function createClient(apiKey: string, baseUrl: string) {
	return createKubbClient(apiKey, baseUrl);
}

// Export the HevyClient type for use in other modules
export type HevyClient = ReturnType<typeof createClient>;

/**
 * Return an initialized Hevy client or fail with the shared tool-facing error.
 */
export function requireHevyClient<T>(client: T | null | undefined): T {
	if (!client) {
		throw new Error(
			"API client not initialized. Please provide HEVY_API_KEY.",
		);
	}

	return client;
}
