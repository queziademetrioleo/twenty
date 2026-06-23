import { useQuery } from '@apollo/client/react';
import { useMemo } from 'react';
import { ConnectedAccountProvider } from 'twenty-shared/types';

import { GET_MY_CONNECTED_ACCOUNTS } from '@/settings/accounts/graphql/queries/getMyConnectedAccounts';

type CoreConnectedAccount = {
  id: string;
  handle: string;
  provider: ConnectedAccountProvider;
};

export const useGetWhatsAppConnectedAccounts = () => {
  const { data, loading } = useQuery<{
    myConnectedAccounts: CoreConnectedAccount[];
  }>(GET_MY_CONNECTED_ACCOUNTS);

  const accounts = useMemo(() => {
    if (!data?.myConnectedAccounts) {
      return [];
    }

    return data.myConnectedAccounts
      .filter(
        (account) => account.provider === ConnectedAccountProvider.WHATSAPP,
      )
      .map((account) => ({
        id: account.id,
        handle: account.handle,
      }));
  }, [data]);

  return { accounts, loading };
};
