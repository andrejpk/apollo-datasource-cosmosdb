import { Container } from "@azure/cosmos";
export declare const isCosmosDbContainer: (maybeContainer: any) => maybeContainer is Container;
export declare type Logger = {
    debug(message?: string): void;
    info(message?: string): void;
    warn(message?: string): void;
    error(message?: string): void;
};
