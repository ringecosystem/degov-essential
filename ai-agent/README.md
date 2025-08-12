# DeGov AI Agent

🤖 An autonomous governance agent that analyzes blockchain proposals using multi-source intelligence and makes informed voting decisions.

## Features

- **Multi-Source Analysis**: Combines on-chain votes, Twitter polls, and sentiment analysis
- **AI-Powered Decisions**: Leverages advanced AI to provide governance recommendations
- **Real-time Monitoring**: Tracks proposal lifecycle across multiple DAOs
- **Social Integration**: Integrates with Twitter for community sentiment analysis

## OpenZeppelin Governance Lifecycle

DeGov Agent supports the standard OpenZeppelin governance proposal states:

```typescript
enum ProposalState {
  Pending, // Proposal created, voting not yet started
  Active, // Voting is currently active
  Canceled, // Proposal was canceled
  Defeated, // Proposal failed to meet quorum/majority
  Succeeded, // Proposal passed voting requirements
  Queued, // Proposal queued in timelock (if applicable)
  Expired, // Queued proposal expired before execution
  Executed, // Proposal successfully executed
}
```

### State Transition Flow

```text
              ┌─────────────┐
              │   Pending   │ <- Proposal created
              └──────┬──────┘
                     │ votingDeplay reached
                     ▼
              ┌─────────────┐
              │   Active    │ <- Voting period
              └──────┬──────┘
                     │
        ┌────────────┼────────────────┐
        │            │                │
        ▼            ▼                ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│   Canceled  │ │   Defeated  │ │  Succeeded  │
└─────────────┘ └─────────────┘ └──────┬──────┘
                                       │
                                       ▼
                                ┌─────────────┐
                                │    Queued   │ <- Timelock delay
                                └──────┬──────┘
                                       │
                            ┌──────────┴───────────┐
                            │                      │
                            ▼                      ▼
                    ┌─────────────┐         ┌─────────────┐
                    │   Executed  │         │   Expired   │
                    └─────────────┘         └─────────────┘
```

## API Reference

### 🏛️ DAO Management

#### `GET /degov/daos`

**Description**: Retrieve list of all supported DAOs and their configurations

**Response**:

```json
{
  "code": 0,
  "data": [
    {
      "name": "DeGov Development Test DAO",
      "code": "degov-test-dao",
      "xprofile": "default",
      "links": {
        "website": "https://demo.degov.ai",
        "config": "https://demo.degov.ai/degov.yml",
        "indexer": "https://degov-indexer.vercel.app/graphql"
      },
      "config": {
        "name": "DeGov Development Test DAO",
        "logo": "/example/logo.svg",
        ...
      },
      "lastProcessedBlock": 7193027
    }
  ]
}
```

#### `GET /degov/bot-address`

**Description**: Get the DeGov Agent's wallet address

**Response**:

```json
{
  "code": 0,
  "data": {
    "address": "0x22C7F83418Cc6868651e8a46eF9000d9bE8866E5"
  }
}
```

### 📋 Proposal Analysis

#### `POST /degov/proposal/summary`

**Description**: Generate AI-powered proposal summary and analysis

**Response**:

```json
{
  "code": 0,
  "data": "**Executive Summary:** The article outlines ..."
}
```

**Example**:

```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  https://agent.degov.ai/degov/proposal/summary \
  -d '{
    "chain": 46,
    "indexer": "https://degov-indexer.vercel.app/graphql",
    "id": "0x474ec4da8ae93a02f63445e646682dbc06a4b55286e86c750bcd7916385b3907"
  }'
```

#### `GET /degov/vote/:chain/:id?format=[json|html]`

**Description**: Get comprehensive voting analysis report from DeGov Agent

**Parameters**:

- `chain` (path): Blockchain network ID
- `id` (path): Proposal ID
- `format` (query): Response format - `json` for API consumption, `html` for web display

**Examples**:

```bash
# Get JSON analysis
curl https://agent.degov.ai/degov/vote/1/0x1234567?format=json

# Get HTML report (default)
curl https://agent.degov.ai/degov/vote/1/0x1234567
```

### 🐦 Twitter Integration

#### `GET /twitter/account`

**Description**: Initiate Twitter account authorization flow for DAO agent integration

**Response**: Redirects to Twitter OAuth flow

#### `POST /twitter/authorize`

**Description**: Complete Twitter account authorization

**Request Body**:

```json
{
  "method": "API",
  "message": "...",
  "oauthUrl": "..."
}
```

#### `GET /twitter/authorized`

**Description**: Confirmation page after successful Twitter authorization

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Twitter API credentials (for social analysis)

### Installation

```bash
# Clone the repository
git clone https://github.com/darwinia-network/degov-essential
cd degov-essential/ai-agent

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env

# Run prisma generate
pnpm prisma generate

# Start the development server
pnpm dev
```

### Environment Variables

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/degov
X_API_KEY=your_x_api_key
X_API_SECRET_KEY=your_x_api_secret_key
X_CALLBACK_HOST=your_callback_host
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE.md) file for details.

## Support

- 📚 [Documentation](https://docs.degov.ai)
- 🐛 [Report Issues](https://github.com/darwinia-network/degov-essential/issues)
- 🌐 [Website](https://degov.ai)
