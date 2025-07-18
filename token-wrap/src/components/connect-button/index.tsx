'use client';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

import { Button } from '../ui/button';
import { Connected } from './connected';
import { useAppConfig } from '@/hooks/useAppConfig';

export const ConnectButton = () => {
  const { openConnectModal } = useConnectModal();
  const { chainId, address, isConnected, isConnecting, isReconnecting } = useAccount();
  const { config } = useAppConfig();
  if (isConnecting || isReconnecting) {
    return null;
  }

  if (!isConnected && openConnectModal) {
    return (
      <Button onClick={openConnectModal} className="rounded-[100px]">
        Connect Wallet
      </Button>
    );
  }

  if (Number(chainId) !== Number(config?.app.chainId)) {
    return (
      <Button variant="destructive" className="cursor-auto rounded-[100px]">
        Error Chain
      </Button>
    );
  }

  if (address) {
    return <Connected address={address} />;
  }

  return null;
};
