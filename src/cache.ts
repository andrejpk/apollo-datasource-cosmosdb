import { Container, Operation } from "@azure/cosmos";
import { KeyValueCache } from "apollo-server-caching";
import DataLoader from "dataloader";
import { EJSON } from "bson";

// https://github.com/graphql/dataloader#batch-function
const orderDocs = <V>(ids: readonly string[]) => (
  docs: (V | undefined)[],
  keyFn?: (source: V) => string
) => {
  const keyFnDef =
    keyFn ||
    ((source: V & { id?: string }) => {
      if (source.id) return source.id;
      throw new Error(
        "Could not find ID for object; if using an alternate key, pass in a key function"
      );
    });

  const checkNotUndefined = (input: V | undefined): input is V => {
    return Boolean(input);
  };

  const idMap: Record<string, V> = docs
    .filter(checkNotUndefined)
    .reduce((prev: Record<string, V>, cur: V) => {
      prev[keyFnDef(cur)] = cur;
      return prev;
    }, {});
  return ids.map((id) => idMap[id]);
};

export interface createCatchingMethodArgs {
  container: Container;
  cache: KeyValueCache;
}

export interface FindArgs {
  ttl?: number;
}

export interface CachedMethods<DType> {
  findOneById: (id: string, args: FindArgs) => Promise<DType | undefined>;
  findManyByIds: (
    ids: string[],
    args: FindArgs
  ) => Promise<(DType | undefined)[]>;
  deleteFromCacheById: (id: string) => Promise<void>;
}

export const createCachingMethods = <DType>({
  container,
  cache,
}: createCatchingMethodArgs): CachedMethods<DType> => {
  const loader = new DataLoader<string, DType>(async (ids) => {
    const operations = ids.map<Operation>((id) => ({
      operationType: "Read",
      id,
    }));
    const response = await container.items.bulk(operations);
    const responseDocs = response.map((r) =>
      r.resourceBody ? ((r.resourceBody as unknown) as DType) : undefined
    );
    return orderDocs<DType>(ids)(responseDocs);
  });

  const cachePrefix = `cosmos-${container.url}-`;

  const methods: CachedMethods<DType> = {
    findOneById: async (id, { ttl } = {}) => {
      const key = cachePrefix + id;

      const cacheDoc = await cache.get(key);
      if (cacheDoc) {
        return EJSON.parse(cacheDoc) as DType;
      }

      const doc = await loader.load(id);

      if (Number.isInteger(ttl)) {
        cache.set(key, EJSON.stringify(doc), { ttl });
      }

      return doc;
    },

    findManyByIds: (ids, args = {}) =>
      Promise.all(ids.map((id) => methods.findOneById(id, args))),

    deleteFromCacheById: async (id) => {
      loader.clear(id);
      await cache.delete(cachePrefix + id);
    },
  };

  return methods;
};
