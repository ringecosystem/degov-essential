import { DegovContract } from "../src/internal/contracts";
import { DegovHelpers } from "../src/helpers";

describe("X Tweet Preview Test", () => {
  const contract = new DegovContract();

  it(
    "Check quorum erc20 - ens - blocknumber",
    async () => {
      const result = await contract.quorum({
        chainId: 1,
        endpoint: "https://eth-mainnet.public.blastapi.io",
        contractAddress: "0x323A76393544d5ecca80cd6ef2A560C6a395b7E3",

        // standard: "ERC20",
        // governorTokenAddress: "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72",
      });
      console.log(DegovHelpers.safeJsonStringify(result));
      expect(result).toEqual({
        quorum: 1000000000000000000000000n,
      });
    },
    1000 * 60
  );

  it(
    "Check quorum erc20 - ringdao - timestamp",
    async () => {
      const result = await contract.quorum({
        chainId: 1,
        endpoint: "https://rpc.darwinia.network",
        contractAddress: "0x52cDD25f7C83c335236Ce209fA1ec8e197E96533",

        standard: "ERC20",
        governorTokenAddress: "0xdafa555e2785DC8834F4Ea9D1ED88B6049142999",
        includeDecimals: true,
      });
      console.log(DegovHelpers.safeJsonStringify(result));
      expect(result).toEqual({
        quorum: 40000000000000000000000000n,
        decimals: 18n,
      });
    },
    1000 * 60
  );


  it(
    "Check quorum erc20 - unlockdao - timestamp",
    async () => {
      const result = await contract.quorum({
        chainId: 8453,
        endpoint: "https://base-rpc.publicnode.com",
        contractAddress: "0x65bA0624403Fc5Ca2b20479e9F626eD4D78E0aD9",

        standard: "ERC20",
        governorTokenAddress: "0xaC27fa800955849d6D17cC8952Ba9dD6EAA66187",
        includeDecimals: true,
      });
      console.log(DegovHelpers.safeJsonStringify(result));
      // expect(result).toEqual({
      //   quorum: 40000000000000000000000000n,
      //   decimals: 18n,
      // });
    },
    1000 * 60
  );
});
