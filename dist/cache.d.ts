import { Container } from "@azure/cosmos";
import { KeyValueCache } from "apollo-server-caching";
import DataLoader from "dataloader";
import { CosmosDataSourceOptions } from "./datasource";
export interface createCatchingMethodArgs {
    container: Container;
    cache: KeyValueCache;
    options: CosmosDataSourceOptions;
}
export interface FindArgs {
    ttl?: number;
}
export interface CachedMethods<DType> {
    findOneById: (id: string, args?: FindArgs) => Promise<DType | undefined>;
    findManyByIds: (ids: string[], args?: FindArgs) => Promise<(DType | undefined)[]>;
    deleteFromCacheById: (id: string) => Promise<void>;
    dataLoader?: DataLoader<string, DType, string>;
    primeLoader: (item: DType | DType[], ttl?: number) => void;
}
export declare const createCachingMethods: <DType extends {
    id: string;
}>({ container, cache, options, }: createCatchingMethodArgs) => CachedMethods<DType>;
