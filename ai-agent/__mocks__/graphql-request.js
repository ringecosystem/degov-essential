// Mock for graphql-request that actually makes HTTP requests
const axios = require('axios');

const gql = (query) => query;

const request = async (endpoint, query, variables) => {
  try {
    console.log('GraphQL Request:', {
      endpoint,
      query: query.substring(0, 200) + '...',
      variables
    });

    const response = await axios.post(endpoint, {
      query: typeof query === 'string' ? query : query.toString(),
      variables
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    console.log('GraphQL Response Status:', response.status);
    return response.data.data;
  } catch (error) {
    console.error('GraphQL request failed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
};

const GraphQLClient = function(endpoint) {
  this.request = (query, variables) => request(endpoint, query, variables);
};

module.exports = {
  gql,
  request,
  GraphQLClient
};
