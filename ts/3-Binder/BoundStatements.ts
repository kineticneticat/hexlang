import { Pattern } from "../4-Compiler/Hex/Hex";
import { HexType } from "../types/Types";
import { CodeRefrence } from "../Util";
import { BoundExpression } from "./BoundExpressions";

export interface BoundStatement {
    source: CodeRefrence
}

export class BoundBlock implements BoundStatement {
    constructor(
        public statements: BoundStatement[],
        public source: CodeRefrence
    ) {}
}

export class BoundExpressionStmt implements BoundStatement {
    constructor(
        public expression: BoundExpression,
        public source: CodeRefrence
    ) {}
}

export class BoundDeclaration implements BoundStatement {
    constructor(
        public name: string,
        public mutable: boolean,
        public value: BoundExpression,
        public type: HexType,
        public source: CodeRefrence
    ) {}
}

type elif = {condition: BoundExpression, block: BoundBlock}
export class BoundIf implements BoundStatement {
    constructor(
        public condition: BoundExpression,
        public ifblock: BoundBlock,
        public elifs: elif[],
        public source: CodeRefrence,
        public elseblock?: BoundBlock
    ) {}
}

export class BoundFor implements BoundStatement {
    constructor(
        public symbol: string,
        public iterable: BoundExpression,
        public body: BoundBlock,
        public source: CodeRefrence
    ) {}
}

export class BoundWhile implements BoundStatement {
    constructor(
        public condition: BoundExpression,
        public body: BoundBlock,
        public source: CodeRefrence
    ) {}
}

export class BoundFunction implements BoundStatement {
    constructor(
        public name: string,
        public args: number,
        public body: BoundBlock,
        public captures: string[],
        public source: CodeRefrence
    ) {}
}

export class BoundReturn implements BoundStatement {
    constructor(
        public source: CodeRefrence,
        public value?: BoundExpression
    ) {}
}

export class BoundNative implements BoundStatement {
    constructor(
        public name: string,
        public args: number,
        public body: Pattern[],
        public source: CodeRefrence
    ) {}
}

export class BoundClass implements BoundStatement {
    constructor(
        public source: CodeRefrence
    ) {}
}