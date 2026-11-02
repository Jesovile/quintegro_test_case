import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { DomainError } from '../errors/domainError';

// Maps errors to API errors. Messages of unexpected errors and input values never reach the logs or the client
export const formatGraphQLError = (error: GraphQLError): GraphQLFormattedError => {
  const { originalError, path } = error;
  const code = error.extensions?.code;

  if (originalError instanceof DomainError) {
    const { code: domainCode, fields } = originalError;
    return { message: originalError.message, path, extensions: fields ? { code: domainCode, fields } : { code: domainCode } };
  }

  // Query and input validation errors are assigned their own code by Apollo
  if (code && code !== 'INTERNAL_SERVER_ERROR') {
    return { message: error.message, path, extensions: { code } };
  }

  console.error('GraphQL Error:', originalError?.name, path);
  return { message: 'Internal server error', path, extensions: { code: 'INTERNAL' } };
};
