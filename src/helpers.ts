import { Container } from "@azure/cosmos";

export const isCosmosDbContainer = (
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
  debug(message?: any): void;
  info(message?: any): void;
  warn(message?: any): void;
  error(message?: any): void;
}