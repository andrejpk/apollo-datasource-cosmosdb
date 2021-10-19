"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCosmosDbContainer = void 0;
const isCosmosDbContainer = (
// eslint-disable-next-line @typescript-eslint/no-explicit-any
maybeContainer) => {
    // does the duck quack?
    return (maybeContainer.url &&
        maybeContainer.items &&
        maybeContainer.database &&
        maybeContainer.getPartitionKeyDefinition);
};
exports.isCosmosDbContainer = isCosmosDbContainer;
//# sourceMappingURL=helpers.js.map