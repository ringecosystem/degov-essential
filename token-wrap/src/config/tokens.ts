export const TOKEN_ADDRESSES = {
  FROM_TOKEN: (process.env.NEXT_PUBLIC_FROM_TOKEN_ADDRESS ??
    '0x48C817eebE1fD79F946bd6b976EF579540517121') as `0x${string}`,
  TO_TOKEN: (process.env.NEXT_PUBLIC_TO_TOKEN_ADDRESS ??
    '0x0ef0827A9d5D329DFbaA14c7d5Aae364453A4D32') as `0x${string}`
} as const;

export const TOKEN_INFO = {
  FROM_TOKEN: {
    name: process.env.NEXT_PUBLIC_FROM_TOKEN_NAME ?? 'TK',
    symbol: process.env.NEXT_PUBLIC_FROM_TOKEN_SYMBOL ?? 'TK',
    decimals: process.env.NEXT_PUBLIC_FROM_TOKEN_DECIMALS
      ? parseInt(process.env.NEXT_PUBLIC_FROM_TOKEN_DECIMALS)
      : 18,
    address: TOKEN_ADDRESSES.FROM_TOKEN,
    icon: '/example/token.svg'
  },
  TO_TOKEN: {
    name: process.env.NEXT_PUBLIC_TO_TOKEN_NAME ?? 'GTK',
    symbol: process.env.NEXT_PUBLIC_TO_TOKEN_SYMBOL ?? 'GTK',
    decimals: process.env.NEXT_PUBLIC_TO_TOKEN_DECIMALS
      ? parseInt(process.env.NEXT_PUBLIC_TO_TOKEN_DECIMALS)
      : 18,
    address: TOKEN_ADDRESSES.TO_TOKEN,
    icon: '/example/token.svg'
  }
} as const;

export type TokenSymbol = keyof typeof TOKEN_INFO;
