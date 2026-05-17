/**
 * Tests for the auth gate in front of exportAndShare.
 *
 * useExportData is intentionally a thin useMutation wrapper around
 * exportForUser. Testing exportForUser directly covers the no_user branch
 * without pulling React Query into the test surface, which keeps this suite
 * from leaking notifyManager timers into other suites in the same Jest
 * worker.
 */
import { ExportError, exportForUser } from "@/features/settings/api";

describe("exportForUser (auth gate)", () => {
  let mockShare: jest.Mock<Promise<void>, [string]>;

  beforeEach(() => {
    mockShare = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
  });

  it("calls share(user.id) once when a user is signed in", async () => {
    await exportForUser({ id: "user-1" }, mockShare);

    expect(mockShare).toHaveBeenCalledTimes(1);
    expect(mockShare).toHaveBeenCalledWith("user-1");
  });

  it("rejects with ExportError(no_user) and does not call share when user is null", async () => {
    await expect(exportForUser(null, mockShare)).rejects.toMatchObject({
      name: "ExportError",
      code: "no_user",
    });
    expect(mockShare).not.toHaveBeenCalled();
  });

  it("rejects with ExportError(no_user) when user is undefined", async () => {
    await expect(exportForUser(undefined, mockShare)).rejects.toMatchObject({
      name: "ExportError",
      code: "no_user",
    });
    expect(mockShare).not.toHaveBeenCalled();
  });

  it("rejects with ExportError(no_user) when user.id is an empty string", async () => {
    await expect(
      exportForUser({ id: "" } as { id: string }, mockShare),
    ).rejects.toMatchObject({
      name: "ExportError",
      code: "no_user",
    });
    expect(mockShare).not.toHaveBeenCalled();
  });

  it("the rejected error is an ExportError instance", async () => {
    let caught: unknown;
    try {
      await exportForUser(null, mockShare);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ExportError);
    expect((caught as ExportError).code).toBe("no_user");
  });
});
