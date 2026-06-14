import { waitForServerPaid } from "@/features/paywall/waitForServerPaid";

const noSleep = () => Promise.resolve();

function ent(status: string) {
  return { entitlement_status: status } as never;
}

it("returns 'paid' as soon as the server reports paid", async () => {
  const refresh = jest
    .fn()
    .mockResolvedValueOnce(ent("expired"))
    .mockResolvedValueOnce(ent("paid"));
  const result = await waitForServerPaid(refresh, { attempts: 5, sleep: noSleep });
  expect(result).toBe("paid");
  expect(refresh).toHaveBeenCalledTimes(2);
});

it("treats 'active' as paid", async () => {
  const refresh = jest.fn().mockResolvedValue(ent("active"));
  expect(await waitForServerPaid(refresh, { sleep: noSleep })).toBe("paid");
});

it("does NOT treat an in-trial 'trial' (full access) as paid", async () => {
  // An active trial is accessMode 'full' but NOT paid — must keep polling.
  const refresh = jest.fn().mockResolvedValue(ent("trial"));
  expect(await waitForServerPaid(refresh, { attempts: 3, sleep: noSleep })).toBe(
    "timed_out",
  );
  expect(refresh).toHaveBeenCalledTimes(3);
});

it("returns 'timed_out' when the server is reachable but never reports paid", async () => {
  const refresh = jest.fn().mockResolvedValue(ent("expired"));
  expect(await waitForServerPaid(refresh, { attempts: 4, sleep: noSleep })).toBe(
    "timed_out",
  );
  expect(refresh).toHaveBeenCalledTimes(4);
});

it("returns 'failed' when every refresh fails to reach the server (null)", async () => {
  const refresh = jest.fn().mockResolvedValue(null);
  expect(await waitForServerPaid(refresh, { attempts: 3, sleep: noSleep })).toBe(
    "failed",
  );
});

it("returns 'paid' even if earlier attempts couldn't reach the server", async () => {
  const refresh = jest
    .fn()
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(ent("paid"));
  expect(await waitForServerPaid(refresh, { attempts: 5, sleep: noSleep })).toBe(
    "paid",
  );
});

it("stops polling early when isAborted() turns true (does not exhaust attempts)", async () => {
  // Simulate auth changing during the first sleep: the next loop iteration's
  // isAborted check must break instead of polling the new account again.
  const refresh = jest.fn().mockResolvedValue(ent("expired"));
  let aborted = false;
  const result = await waitForServerPaid(refresh, {
    attempts: 5,
    sleep: async () => {
      aborted = true;
    },
    isAborted: () => aborted,
  });
  // Only attempt 0 ran refresh; the budget of 5 was NOT exhausted.
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(result).toBe("timed_out");
});
