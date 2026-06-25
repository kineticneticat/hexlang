import { Pattern } from "../4-Compiler/Hex/Hex";
import { HexType } from "../types/Types";
import { BoundExpression } from "./BoundExpressions";

export interface BoundStatement {}

export class BoundBlock implements BoundStatement {
    constructor(
        public statements: BoundStatement[]
    ) {}
}

export class BoundExpressionStmt implements BoundStatement {
    constructor(
        public expression: BoundExpression
    ) {}
}

export class BoundDeclaration implements BoundStatement {
    constructor(
        public name: string,
        public mutable: boolean,
        public value: BoundExpression,
        public type: HexType
    ) {}
}

type elif = {condition: BoundExpression, block: BoundBlock}
export class BoundIf implements BoundStatement {
    constructor(
        public condition: BoundExpression,
        public ifblock: BoundBlock,
        public elifs: elif[],
        public elseblock?: BoundBlock,
    ) {}
}

export class BoundFor implements BoundStatement {
    constructor(
        public symbol: string,
        public iterable: BoundExpression,
        public body: BoundBlock
    ) {}
}

export class BoundWhile implements BoundStatement {
    constructor(
        condition: BoundExpression,
        body: BoundBlock
    ) {}
}

export class BoundFunction implements BoundStatement {
    constructor(
        name: string,
        args: number,
        body: BoundBlock,
        captures: string[]
    ) {}
}

export class BoundReturn implements BoundStatement {
    constructor(
        value?: BoundExpression
    ) {}
}

export class BoundNative implements BoundStatement {
    constructor(
        name: string,
        args: number,
        body: Pattern[]
    ) {}
}

export class BoundClass implements BoundStatement {}