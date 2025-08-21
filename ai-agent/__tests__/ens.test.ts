import { EnsClient } from "../src/internal/ens";

describe("ENS test", () => {
  it(
    "fetch and check ens profile",
    async () => {
      const ensClient = new EnsClient();
      const address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
      const expectedPreview = {
        ensname: "vitalik.eth",
        username: "VitalikButerin",
        code: 0,
      };

      const result = await ensClient.findTwitterUsername(address);
      expect(result).toEqual(expectedPreview);
    },
    1000 * 60
  );
});
