import type {
  DefaultOptions} from '@apollo/client';
import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  split
} from '@apollo/client';
import { WebSocketLink } from '@apollo/client/link/ws';
import { getMainDefinition } from '@apollo/client/utilities';

//Apollo client that uses the Hasura-Admin-Secret
//runs only server-side so secret is not exposed to client
//used for unauthenticated calls that are found in API routes

const globalHttpLink = new HttpLink({
  uri: process.env.HASURA_URL,
  headers: {
    'content-type': 'application/json',
    'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET || '',
  },
});

const globalWsLink = new WebSocketLink({
  uri:
    process.env.HASURA_WEBSOCKET_URL || 'wss://matter-p32-test.hasura.app/v1/graphql',
  options: {
    reconnect: true,
    connectionParams: {
      headers: {
        'content-type': 'application/json',
        'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET,
      },
    },
  },
});

const globalSplitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
  },
  globalWsLink,
  globalHttpLink,
);

const globalDefaultOptions: DefaultOptions = {
  watchQuery: {
    fetchPolicy: 'no-cache',
  },
  query: {
    fetchPolicy: 'no-cache',
  },
};

const globalClient = new ApolloClient({
  link: globalSplitLink,
  cache: new InMemoryCache(),
  defaultOptions: globalDefaultOptions,
});

export { globalClient };
