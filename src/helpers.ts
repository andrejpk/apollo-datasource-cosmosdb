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
