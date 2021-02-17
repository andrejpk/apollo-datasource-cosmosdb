import { Container } from "@azure/cosmos";

export const isCosmosDbContainer = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  maybeContainer: any
): maybeContainer is Container => {
  // does the duck quack?
  return (
    maybeContainer.url &&
    maybeContainer.items &&
    maybeContainer.database &&
    maybeContainer.getPartitionKeyDefinition
  );
};

export type Logger = {
  // Ordered from least-severe to most-severe.
  debug(message?: string): void;
  info(message?: string): void;
  warn(message?: string): void;
  error(message?: string): void;
};
