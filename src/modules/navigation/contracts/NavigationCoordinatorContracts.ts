import type {
    Direction,
} from './interfaces';
import type {
    NavigationFourWayDirection,
    NavigationVerticalDirection,
} from './NavigationFeaturePorts';

type IsExactType<Actual, Expected> =
    [Actual] extends [Expected]
        ? ([Expected] extends [Actual] ? true : false)
        : false;

type AssertTrue<T extends true> = T;

export type NavigationDirectionContractCheck = AssertTrue<
    IsExactType<Direction, NavigationFourWayDirection>
>;
export type NavigationVerticalDirectionContractCheck = AssertTrue<
    IsExactType<NavigationVerticalDirection, Extract<Direction, 'up' | 'down'>>
>;
