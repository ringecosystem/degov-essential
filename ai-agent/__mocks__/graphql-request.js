// Mock for graphql-request
module.exports = {
  gql: (query) => query,
  request: jest.fn().mockResolvedValue({
    voteCasts: [] // Empty array to simulate no votes found
  }),
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: jest.fn().mockResolvedValue({
      voteCasts: []
    })
  }))
};
