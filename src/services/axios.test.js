jest.mock("axios", () => ({
  create: jest.fn(() => ({
    defaults: { headers: {} },
    interceptors: { response: { use: jest.fn() } },
  })),
}));

describe("frontend API base URL", () => {
  const originalApiBaseURL = process.env.REACT_APP_API_BASE_URL;

  afterEach(() => {
    jest.resetModules();
    process.env.REACT_APP_API_BASE_URL = originalApiBaseURL;
  });

  it("uses the same-origin /api path by default so local development goes through setupProxy", () => {
    delete process.env.REACT_APP_API_BASE_URL;

    // eslint-disable-next-line global-require
    const { apiBaseURL, resolveApiBaseURL } = require("./axios");

    expect(apiBaseURL).toBe("/api");
    expect(resolveApiBaseURL()).toBe("/api");
  });

  it("lets REACT_APP_API_BASE_URL override the default when explicitly configured", () => {
    process.env.REACT_APP_API_BASE_URL = "http://localhost:3006/api/";

    // eslint-disable-next-line global-require
    const { apiBaseURL, resolveApiBaseURL } = require("./axios");

    expect(apiBaseURL).toBe("http://localhost:3006/api");
    expect(resolveApiBaseURL("http://localhost:3001/api/")).toBe("http://localhost:3001/api");
  });
});
