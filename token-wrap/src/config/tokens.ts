export const TOKEN_ADDRESSES = {
  FROM_TOKEN: (process.env.NEXT_PUBLIC_FROM_TOKEN_ADDRESS ??
    '0x48C817eebE1fD79F946bd6b976EF579540517121') as `0x${string}`,
  TO_TOKEN: (process.env.NEXT_PUBLIC_TO_TOKEN_ADDRESS ??
    '0x0ef0827A9d5D329DFbaA14c7d5Aae364453A4D32') as `0x${string}`
} as const;

export const CONTRACT_ADDRESSES = {
  TIMELOCK: (process.env.NEXT_PUBLIC_TIMELOCK_ADDRESS ??
    '0xd1E2Cc9c1e9D7ccDEBB948382A917b4FFfCE7Ae1') as `0x${string}`,
  DGOVERNOR: (process.env.NEXT_PUBLIC_DGOVERNOR_ADDRESS ??
    '0x892eaD4A183067fD30aAB74947Eb57ddd17BfE53') as `0x${string}`
} as const;

export enum TokenStandard {
  ERC20 = 'ERC20',
  ERC721 = 'ERC721'
}

export const TOKEN_INFO = {
  FROM_TOKEN: {
    name: process.env.NEXT_PUBLIC_FROM_TOKEN_NAME ?? 'TK',
    symbol: process.env.NEXT_PUBLIC_FROM_TOKEN_SYMBOL ?? 'TK',
    standard: (process.env.NEXT_PUBLIC_FROM_TOKEN_STANDARD as TokenStandard) ?? TokenStandard.ERC20,
    decimals: process.env.NEXT_PUBLIC_FROM_TOKEN_DECIMALS
      ? parseInt(process.env.NEXT_PUBLIC_FROM_TOKEN_DECIMALS)
      : process.env.NEXT_PUBLIC_FROM_TOKEN_STANDARD === TokenStandard.ERC721
        ? 0
        : 18,
    address: TOKEN_ADDRESSES.FROM_TOKEN,
    icon: '/example/token1.svg'
  },
  TO_TOKEN: {
    name: process.env.NEXT_PUBLIC_TO_TOKEN_NAME ?? 'GTK',
    symbol: process.env.NEXT_PUBLIC_TO_TOKEN_SYMBOL ?? 'GTK',
    standard: (process.env.NEXT_PUBLIC_TO_TOKEN_STANDARD as TokenStandard) ?? TokenStandard.ERC20,
    decimals: process.env.NEXT_PUBLIC_TO_TOKEN_DECIMALS
      ? parseInt(process.env.NEXT_PUBLIC_TO_TOKEN_DECIMALS)
      : process.env.NEXT_PUBLIC_TO_TOKEN_STANDARD === TokenStandard.ERC721
        ? 0
        : 18,
    address: TOKEN_ADDRESSES.TO_TOKEN,
    icon: '/example/token2.svg'
  }
} as const;

export type TokenSymbol = keyof typeof TOKEN_INFO;
