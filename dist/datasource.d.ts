import { DataSource } from "apollo-datasource";
import { KeyValueCache } from "apollo-server-caching";
import { Container, SqlQuerySpec, FeedOptions } from "@azure/cosmos";
import { Logger } from "./helpers";
import { CachedMethods, FindArgs } from "./cache";
export interface CosmosDataSourceOptions {
    logger?: Logger;
}
export interface CosmosQueryDbArgs {
    /** Maps to CosmosDB feed/request options for parameters like maxItemCount
     * See https://docs.microsoft.com/en-us/javascript/api/%40azure/cosmos/feedoptions?view=azure-node-latest
     */
    requestOptions?: FeedOptions;
}
export declare type QueryFindArgs = FindArgs & CosmosQueryDbArgs;
export declare class CosmosDataSource<TData extends {
    id: string;
}, TContext> extends DataSource<TContext> implements CachedMethods<TData> {
    container: Container;
    context?: TContext;
    options: CosmosDataSourceOptions;
    findOneById: CachedMethods<TData>["findOneById"];
    findManyByIds: CachedMethods<TData>["findManyByIds"];
    deleteFromCacheById: CachedMethods<TData>["deleteFromCacheById"];
    dataLoader: CachedMethods<TData>["dataLoader"];
    primeLoader: CachedMethods<TData>["primeLoader"];
    /**
     *
     * @param query
     * @param param1
     */
    findManyByQuery(query: string | SqlQuerySpec, { ttl, requestOptions }?: QueryFindArgs): Promise<import("@azure/cosmos").FeedResponse<TData>>;
    createOne(newDoc: TData, options?: QueryFindArgs): Promise<import("@azure/cosmos").ItemResponse<TData>>;
    deleteOne(id: string): Promise<import("@azure/cosmos").ItemResponse<TData>>;
    updateOne(updDoc: TData): Promise<import("@azure/cosmos").ItemResponse<TData>>;
    updateOnePartial(id: string, contents: Partial<TData>): Promise<import("@azure/cosmos").ItemResponse<TData>>;
    constructor(container: Container, options?: CosmosDataSourceOptions);
    initialize({ context, cache, }?: {
        context?: TContext;
        cache?: KeyValueCache;
    }): void;
}
