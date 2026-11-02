import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { clearToken, getToken, notifyUnauthenticated } from '@/lib/auth';

const httpLink = createHttpLink({
  uri: import.meta.env.VITE_GRAPHQL_URI || 'http://localhost:3000/graphql',
});

const authLink = setContext((_, { headers }) => {
  const token = getToken();
  
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  }
});

const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  // An expired or invalid session; a failed login attempt is handled by the login form itself
  const sessionRejected = graphQLErrors?.some(({ extensions }) => extensions?.code === 'UNAUTHENTICATED');
  if (sessionRejected && operation.operationName !== 'Login') {
    clearToken();
    notifyUnauthenticated();
  }

  // Messages may echo input values (personal data), so only the code and path are logged
  if (graphQLErrors)
    graphQLErrors.forEach(({ extensions, path }) =>
      console.log(`[GraphQL error]: Code: ${extensions?.code}, Path: ${path}`)
    );
  if (networkError) console.log(`[Network error]: ${networkError}`);
});

export const client = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Order: { keyFields: ['orderId'] },
    },
  }),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
    },
    query: {
      errorPolicy: 'all',
    },
  },
});
