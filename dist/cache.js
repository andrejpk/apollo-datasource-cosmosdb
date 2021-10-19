"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCachingMethods = void 0;
const dataloader_1 = __importDefault(require("dataloader"));
const bson_1 = require("bson");
// https://github.com/graphql/dataloader#batch-function
const orderDocs = (ids) => (docs, keyFn) => {
    const keyFnDef = keyFn ||
        ((source) => {
            if (source.id)
                return source.id;
            throw new Error("Could not find ID for object; if using an alternate key, pass in a key function");
        });
    const checkNotUndefined = (input) => {
        return Boolean(input);
    };
    const idMap = docs
        .filter(checkNotUndefined)
        .reduce((prev, cur) => {
        prev[keyFnDef(cur)] = cur;
        return prev;
    }, {});
    return ids.map((id) => idMap[id]);
};
const createCachingMethods = ({ container, cache, options, }) => {
    const loader = new dataloader_1.default((ids) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        (_a = options === null || options === void 0 ? void 0 : options.logger) === null || _a === void 0 ? void 0 : _a.debug(`CosmosDataSource/DataLoader: loading for IDs: ${ids}`);
        const querySpec = {
            query: "select * from c where ARRAY_CONTAINS(@ids, c.id)",
            parameters: [{ name: "@ids", value: ids }],
        };
        const response = yield container.items.query(querySpec).fetchAll();
        (_b = options === null || options === void 0 ? void 0 : options.logger) === null || _b === void 0 ? void 0 : _b.debug(`CosmosDataSource/DataLoader: response count: ${response.resources.length}`);
        return orderDocs(ids)(response.resources);
    }));
    const cachePrefix = `cosmos-${container.url}-`;
    const methods = {
        findOneById: (id, { ttl } = {}) => __awaiter(void 0, void 0, void 0, function* () {
            var _c;
            (_c = options === null || options === void 0 ? void 0 : options.logger) === null || _c === void 0 ? void 0 : _c.debug(`CosmosDataSource: Running query for ID ${id}`);
            const key = cachePrefix + id;
            const cacheDoc = yield cache.get(key);
            if (cacheDoc) {
                return bson_1.EJSON.parse(cacheDoc);
            }
            const doc = yield loader.load(id);
            if (Number.isInteger(ttl)) {
                cache.set(key, bson_1.EJSON.stringify(doc), { ttl });
            }
            return doc;
        }),
        findManyByIds: (ids, args = {}) => {
            var _a;
            (_a = options === null || options === void 0 ? void 0 : options.logger) === null || _a === void 0 ? void 0 : _a.debug(`CosmosDataSource: Running query for IDs ${ids}`);
            return Promise.all(ids.map((id) => methods.findOneById(id, args)));
        },
        deleteFromCacheById: (id) => __awaiter(void 0, void 0, void 0, function* () {
            loader.clear(id);
            yield cache.delete(cachePrefix + id);
        }),
        /**
         * Loads an item or items into DataLoader and optionally the cache (if TTL is specified)
         * Use this when running a query outside of the findOneById/findManyByIds methos
         * that automatically and transparently do this
         */
        primeLoader: (docs, ttl) => __awaiter(void 0, void 0, void 0, function* () {
            docs = Array.isArray(docs) ? docs : [docs];
            for (const doc of docs) {
                loader.prime(doc.id, doc);
                const key = cachePrefix + doc.id;
                if (ttl || (yield cache.get(key))) {
                    cache.set(key, bson_1.EJSON.stringify(doc), { ttl });
                }
            }
        }),
        dataLoader: loader,
    };
    return methods;
};
exports.createCachingMethods = createCachingMethods;
//# sourceMappingURL=cache.js.map