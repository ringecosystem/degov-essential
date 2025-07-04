import { useQuery } from '@tanstack/react-query';
import { useEnsName } from 'wagmi';

import { formatShortAddress } from '@/utils/address';

import type { Address } from 'viem';

interface AddressResolverProps {
  address: Address;
  showShortAddress?: boolean;
  children: (value: string) => React.ReactNode;
}

export function AddressResolver({
  address,
  showShortAddress = false,
  children
}: AddressResolverProps) {
  const { data: ensName } = useEnsName({
    address,
    chainId: 1
  });

  const displayValue = ensName || (showShortAddress ? formatShortAddress(address) : address);

  return <>{children(displayValue)}</>;
}
