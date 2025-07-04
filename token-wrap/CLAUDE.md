# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start development server**: `pnpm dev` (uses Next.js with Turbopack for faster builds)
- **Build production**: `pnpm build`
- **Start production server**: `pnpm start`
- **Lint code**: `pnpm lint` (uses ESLint with Next.js config)

## Project Overview

This is a token wrapping dapp for RING tokens, allowing users to wrap RING tokens to xRING and unwrap xRING back to RING tokens. The project is built with Next.js 15, React 19, and uses Wagmi for Web3 interactions.

## Architecture

### Core Functionality
- **Token Wrapping**: Uses `useTokenWrap` hook in `src/hooks/useTokenWrap.ts` which handles:
  - Reading RING/xRING balances via contract calls
  - Approval workflow for RING tokens before wrapping
  - Wrapping RING to xRING using `depositFor` function
  - Unwrapping xRING to RING using `withdrawTo` function

### Key Configuration Files
- **Token Configuration**: `src/config/tokens.ts` - Defines RING and xRING token addresses and metadata
- **Wagmi Configuration**: `src/config/wagmi.ts` - Web3 wallet and chain configuration (Ethereum mainnet only)
- **ABI Definitions**: `src/config/abi/wrap.ts` - Contract ABI for token operations

### Component Structure
- **Main UI**: `src/components/token-swap.tsx` - Primary swap interface with mode toggle
- **Wallet Connection**: `src/components/connect-button/` - RainbowKit wallet connection
- **UI Components**: `src/components/ui/` - Reusable components built with Radix UI and Tailwind

### Web3 Integration
- Uses Wagmi v2 with RainbowKit for wallet connections
- Supports multiple wallets including MetaMask, WalletConnect, Coinbase Wallet, and others
- Ethereum mainnet only - displays error for wrong networks
- Contract interactions use viem for parsing/formatting units

### State Management
- React hooks for local state management
- React Query for server state and caching
- Form handling with react-hook-form and Zod validation

## Development Notes

- Project uses pnpm as package manager
- TypeScript configuration in `tsconfig.json`
- Tailwind CSS for styling with custom theme configuration
- Next.js 15 with App Router architecture
- All contract interactions require wallet connection and Ethereum mainnet