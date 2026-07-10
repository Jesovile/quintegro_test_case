import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

const httpLink = createHttpLink({
  uri: import.meta.env.VITE_GRAPHQL_URI || 'http://localhost:3000/graphql',
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('auth_token');
  
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  }
});

// `client.ts` has no React Router context (it's constructed outside any
// component tree), so an expired/invalid JWT is handled with a hard
// `window.location` redirect rather than `history.push`. This intentionally
// keeps the module framework-agnostic; it fires for BOTH query and mutation
// errors since both live behind the same errorLink (tech-design §4.1 — a
// `currentCart` query failing on an expired token needs the same treatment
// as a failing mutation, not just mutation-specific handling).
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) =>
      console.log(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      )
    );

    const hasAuthError = graphQLErrors.some(
      ({ message }) => message === 'Authentication required'
    );

    if (hasAuthError) {
      localStorage.removeItem('auth_token');
      window.location.href = '/runtime/login';
    }
  }
  if (networkError) console.log(`[Network error]: ${networkError}`);
});

export const client = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
    },
    query: {
      errorPolicy: 'all',
    },
  },
});
