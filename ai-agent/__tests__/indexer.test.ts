import { DegovIndexer } from "../src/internal/graphql";

describe("Idnexer test", () => {
  const degovIndexer = new DegovIndexer();

  it(
    "Expired proposal",
    async () => {
      const result = await degovIndexer.queryVotingDistribution({
        endpoint: "https://indexer.degov.ai/ring-dao/graphql",
        proposalId:
          "0x56982c82afb5278f42ecc3553ca80a07eb3125d7f9b776e2e9b35640410651a6",
      });
      console.log(result);
    },
    1000 * 60
  );
});
