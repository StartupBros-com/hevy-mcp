import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Workout } from "../generated/client/types/index.js";
import { formatWorkout } from "../utils/formatters.js";
import type { HevyClient } from "../utils/hevyClient.js";
import { registerWorkoutTools } from "./workouts.js";

function createMockServer() {
	const tool = vi.fn();
	const server = { tool } as unknown as McpServer;
	return { server, tool };
}

function getToolRegistration(toolSpy: ReturnType<typeof vi.fn>, name: string) {
	const match = toolSpy.mock.calls.find(([toolName]) => toolName === name);
	if (!match) {
		throw new Error(`Tool ${name} was not registered`);
	}
	const [, , schema, handler] = match as [
		string,
		string,
		z.ZodRawShape,
		(args: Record<string, unknown>) => Promise<{
			content: Array<{ type: string; text: string }>;
			isError?: boolean;
		}>,
	];
	return { handler, schema };
}

describe("registerWorkoutTools", () => {
	it("returns error responses when Hevy client is not initialized", async () => {
		const { server, tool } = createMockServer();
		registerWorkoutTools(server, null);

		const toolNames = [
			"get-workouts",
			"get-workout",
			"get-workout-count",
			"get-workout-events",
			"create-workout",
			"update-workout",
		];

		for (const name of toolNames) {
			const { handler } = getToolRegistration(tool, name);
			const response = await handler({});
			expect(response).toMatchObject({
				isError: true,
				content: [
					{
						type: "text",
						text: expect.stringContaining(
							"API client not initialized. Please provide HEVY_API_KEY.",
						),
					},
				],
			});
		}
	});

	it("get-workouts returns formatted workouts from the client", async () => {
		const { server, tool } = createMockServer();
		const workout: Workout = {
			id: "w1",
			title: "Morning Workout",
			description: "Great session",
			start_time: "2025-03-27T07:00:00Z",
			end_time: "2025-03-27T08:00:00Z",
			created_at: "2025-03-27T07:00:00Z",
			updated_at: "2025-03-27T07:10:00Z",
			exercises: [],
		};
		const hevyClient = {
			getWorkouts: vi.fn().mockResolvedValue({ workouts: [workout] }),
		} as unknown as HevyClient;

		registerWorkoutTools(server, hevyClient);
		const { handler } = getToolRegistration(tool, "get-workouts");

		const response = await handler({ page: 1, pageSize: 5 });

		expect(hevyClient.getWorkouts).toHaveBeenCalledWith({
			page: 1,
			pageSize: 5,
		});

		const parsed = JSON.parse(response.content[0].text) as unknown[];
		expect(parsed).toEqual([formatWorkout(workout)]);
	});

	it("get-workout returns an empty response when workout is not found", async () => {
		const { server, tool } = createMockServer();
		const hevyClient = {
			getWorkout: vi.fn().mockResolvedValue(null),
		} as unknown as HevyClient;

		registerWorkoutTools(server, hevyClient);
		const { handler } = getToolRegistration(tool, "get-workout");

		const response = await handler({ workoutId: "missing-id" });
		expect(hevyClient.getWorkout).toHaveBeenCalledWith("missing-id");
		expect(response.content[0]?.text).toBe(
			"Workout with ID missing-id not found",
		);
	});

	it("get-workout-count returns the numeric count from the client", async () => {
		const { server, tool } = createMockServer();
		const hevyClient = {
			getWorkoutCount: vi.fn().mockResolvedValue({ workoutCount: 42 }),
		} as unknown as HevyClient;

		registerWorkoutTools(server, hevyClient);
		const { handler } = getToolRegistration(tool, "get-workout-count");

		const response = await handler({});
		expect(hevyClient.getWorkoutCount).toHaveBeenCalledTimes(1);

		const parsed = JSON.parse(response.content[0].text) as unknown;
		expect(parsed).toEqual({ count: 42 });
	});

	it("create-workout maps arguments to the request body and formats the response", async () => {
		const { server, tool } = createMockServer();
		const createResult: Workout = {
			id: "created-id",
			title: "New Workout",
			description: "New workout description",
			start_time: "2025-03-27T07:00:00Z",
			end_time: "2025-03-27T08:00:00Z",
			created_at: "2025-03-27T07:00:00Z",
			updated_at: "2025-03-27T07:00:00Z",
			exercises: [],
		};
		const hevyClient = {
			createWorkout: vi.fn().mockResolvedValue(createResult),
		} as unknown as HevyClient;

		registerWorkoutTools(server, hevyClient);
		const { handler } = getToolRegistration(tool, "create-workout");

		const args = {
			title: "New Workout",
			description: null,
			startTime: "2025-03-27T07:00:00Z",
			endTime: "2025-03-27T08:00:00Z",
			routineId: null,
			isPrivate: false,
			exercises: [
				{
					exerciseTemplateId: "template-id",
					supersetId: 1,
					notes: "Some notes",
					sets: [
						{
							type: "normal" as const,
							weight: 80,
							reps: 8,
							distance: null,
							duration: null,
							rpe: 7,
							customMetric: null,
						},
					],
				},
			],
		};

		const response = await handler(args as Record<string, unknown>);

		expect(hevyClient.createWorkout).toHaveBeenCalledWith({
			workout: {
				title: "New Workout",
				description: null,
				start_time: "2025-03-27T07:00:00Z",
				end_time: "2025-03-27T08:00:00Z",
				is_private: false,
				exercises: [
					{
						exercise_template_id: "template-id",
						superset_id: 1,
						notes: "Some notes",
						sets: [
							{
								type: "normal",
								weight_kg: 80,
								reps: 8,
								distance_meters: null,
								duration_seconds: null,
								rpe: 7,
								custom_metric: null,
							},
						],
					},
				],
			},
		});

		const parsed = JSON.parse(response.content[0].text) as unknown;
		expect(parsed).toEqual(formatWorkout(createResult));
	});

	it("create-workout ignores unsupported routineId and maps weightKg", async () => {
		const { server, tool } = createMockServer();
		const createResult: Workout = {
			id: "created-id",
			title: "Programmed Workout",
			description: undefined,
			start_time: "2025-03-27T07:00:00Z",
			end_time: "2025-03-27T08:00:00Z",
			created_at: "2025-03-27T07:00:00Z",
			updated_at: "2025-03-27T07:00:00Z",
			exercises: [],
		};
		const hevyClient = {
			createWorkout: vi.fn().mockResolvedValue(createResult),
		} as unknown as HevyClient;

		registerWorkoutTools(server, hevyClient);
		const { handler } = getToolRegistration(tool, "create-workout");

		const args = {
			title: "Programmed Workout",
			description: null,
			startTime: "2025-03-27T07:00:00Z",
			endTime: "2025-03-27T08:00:00Z",
			routineId: "routine-123",
			isPrivate: false,
			exercises: [
				{
					exerciseTemplateId: "template-id",
					supersetId: null,
					notes: null,
					sets: [
						{
							type: "normal" as const,
							weightKg: 50,
							reps: 10,
						},
					],
				},
			],
		};

		await handler(args as Record<string, unknown>);

		expect(hevyClient.createWorkout).toHaveBeenCalledWith({
			workout: {
				title: "Programmed Workout",
				description: null,
				start_time: "2025-03-27T07:00:00Z",
				end_time: "2025-03-27T08:00:00Z",
				is_private: false,
				exercises: [
					{
						exercise_template_id: "template-id",
						superset_id: null,
						notes: null,
						sets: [
							{
								type: "normal",
								weight_kg: 50,
								reps: 10,
								distance_meters: null,
								duration_seconds: null,
								rpe: null,
								custom_metric: null,
							},
						],
					},
				],
			},
		});
	});
	describe.each([
		["create-workout", "createWorkout"],
		["update-workout", "updateWorkout"],
	] as const)("%s request mapping", (toolName, method) => {
		function setup() {
			const { server, tool } = createMockServer();
			const request = vi.fn().mockResolvedValue(null);
			registerWorkoutTools(server, {
				[method]: request,
			} as unknown as HevyClient);
			const { handler, schema } = getToolRegistration(tool, toolName);
			const input = {
				workoutId: "workout-to-update",
				title: "Workout",
				startTime: "2025-03-27T07:00:00Z",
				endTime: "2025-03-27T08:00:00Z",
				exercises: [{ exerciseTemplateId: "template", sets: [{}] }],
			};
			return { request, handler, schema: z.object(schema), input };
		}

		it("preserves defaults, omitted values, and the update ID without adding routine_id", async () => {
			const { request, handler, schema, input } = setup();
			const args = schema.parse({ ...input, routineId: "ignored-routine" });
			await handler(args);
			const body = {
				workout: {
					title: input.title,
					description: null,
					start_time: input.startTime,
					end_time: input.endTime,
					is_private: false,
					exercises: [
						{
							exercise_template_id: "template",
							superset_id: null,
							notes: null,
							sets: [
								{
									type: "normal",
									weight_kg: null,
									reps: null,
									distance_meters: null,
									duration_seconds: null,
									rpe: null,
									custom_metric: null,
								},
							],
						},
					],
				},
			};
			expect(request.mock.calls).toEqual([
				method === "updateWorkout" ? [input.workoutId, body] : [body],
			]);
			expect(args).not.toHaveProperty("routineId");
		});

		it("preserves alias precedence, zero, null, and independent nested objects", async () => {
			const { request, handler, schema, input } = setup();
			const args = schema.parse({
				...input,
				description: "",
				isPrivate: true,
				exercises: [
					{
						exerciseTemplateId: "template",
						supersetId: 0,
						notes: "",
						sets: [
							{
								type: "warmup",
								weight: 0,
								weightKg: 7,
								distance: 0,
								distanceMeters: 8,
								duration: 0,
								durationSeconds: 9,
								reps: 0,
								rpe: 0,
								customMetric: 0,
							},
							{
								type: "failure",
								weight: null,
								weightKg: "12",
								distance: null,
								distanceMeters: "13",
								duration: null,
								durationSeconds: "14",
								reps: null,
								rpe: null,
								customMetric: null,
							},
							{
								type: "dropset",
								weightKg: null,
								distanceMeters: null,
								durationSeconds: null,
							},
						],
					},
					{
						exerciseTemplateId: "second-template",
						supersetId: null,
						notes: null,
						sets: [],
					},
				],
			});
			const before = structuredClone(args);
			await handler(args);
			await handler(args);
			const first = request.mock.calls[0].at(-1);
			const second = request.mock.calls[1].at(-1);
			expect(first.workout).toEqual({
				title: input.title,
				description: null,
				start_time: input.startTime,
				end_time: input.endTime,
				is_private: true,
				exercises: [
					{
						exercise_template_id: "template",
						superset_id: 0,
						notes: "",
						sets: [
							{
								type: "warmup",
								weight_kg: 0,
								distance_meters: 0,
								duration_seconds: 0,
								reps: 0,
								rpe: 0,
								custom_metric: 0,
							},
							{
								type: "failure",
								weight_kg: 12,
								distance_meters: 13,
								duration_seconds: 14,
								reps: null,
								rpe: null,
								custom_metric: null,
							},
							{
								type: "dropset",
								weight_kg: null,
								distance_meters: null,
								duration_seconds: null,
								reps: null,
								rpe: null,
								custom_metric: null,
							},
						],
					},
					{
						exercise_template_id: "second-template",
						superset_id: null,
						notes: null,
						sets: [],
					},
				],
			});
			expect(args).toEqual(before);
			expect(first).toEqual(second);
			expect(first).not.toBe(second);
			expect(first.workout).not.toBe(second.workout);
			expect(first.workout.exercises).not.toBe(second.workout.exercises);
			expect(first.workout.exercises[0]).not.toBe(second.workout.exercises[0]);
			expect(first.workout.exercises[0].sets).not.toBe(
				second.workout.exercises[0].sets,
			);
			expect(first.workout.exercises[0].sets[0]).not.toBe(
				second.workout.exercises[0].sets[0],
			);
			expect(first.workout.exercises).not.toBe(args.exercises);
		});

		it("preserves formatted successful responses", async () => {
			const { request, handler, schema, input } = setup();
			const result: Workout = {
				id: "returned-id",
				title: "Returned workout",
				description: "Details",
				start_time: input.startTime,
				end_time: input.endTime,
				created_at: input.startTime,
				updated_at: input.endTime,
				exercises: [],
			};
			request.mockResolvedValueOnce(result);
			expect(await handler(schema.parse(input))).toEqual({
				content: [
					{
						type: "text",
						text: JSON.stringify(formatWorkout(result), null, 2),
					},
				],
			});
		});

		it("retains field validation and only requires an ID for updates", () => {
			const { schema, input } = setup();
			expect(schema.safeParse({ ...input, title: "" }).success).toBe(false);
			expect(schema.safeParse({ ...input, startTime: "invalid" }).success).toBe(
				false,
			);
			expect(schema.safeParse({ ...input, workoutId: undefined }).success).toBe(
				method === "createWorkout",
			);
			expect(
				schema.safeParse({
					...input,
					exercises: [{ exerciseTemplateId: "", sets: [] }],
				}).success,
			).toBe(false);
			expect(
				schema.safeParse({
					...input,
					exercises: [
						{ exerciseTemplateId: "template", sets: [{ type: "invalid" }] },
					],
				}).success,
			).toBe(false);
		});

		it("keeps operation-specific empty and error responses", async () => {
			const { request, handler, schema, input } = setup();
			const args = schema.parse(input);
			expect((await handler(args)).content[0].text).toBe(
				method === "createWorkout"
					? "Failed to create workout: Server returned no data"
					: `Failed to update workout with ID ${input.workoutId}`,
			);
			request.mockRejectedValueOnce(new Error("request failed"));
			expect(await handler(args)).toEqual({
				isError: true,
				content: [
					{
						type: "text",
						text: `[${method === "createWorkout" ? "create-workout" : "update-workout-operation"}] Error: request failed`,
					},
				],
			});
		});
	});
});
