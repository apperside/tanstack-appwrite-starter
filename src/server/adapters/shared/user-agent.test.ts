import { describe, expect, it } from "vitest";
import { describeUserAgent } from "./user-agent";

describe("describeUserAgent", () => {
	it("names the browser, OS and device", () => {
		expect(
			describeUserAgent(
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/140.0",
			),
		).toEqual({ clientName: "Firefox", osName: "Mac", deviceName: "desktop" });
	});

	it("leaves everything empty when unknown", () => {
		expect(describeUserAgent(undefined)).toEqual({
			clientName: "",
			osName: "",
			deviceName: "",
		});
	});
});
