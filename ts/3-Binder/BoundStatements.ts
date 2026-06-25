import { Pattern } from "../4-Compiler/Hex/Hex";
import { HexType } from "../types/Types";
import { BoundExpression } from "./BoundExpressions";

interface BoundStatement {}

export class BlockBStatement implements BoundStatement {
    constructor(
        public statements: BoundStatement[]
    ) {}
}

export class ExpressionBStmt implements BoundStatement {
    constructor(
        public expression: BoundExpression
    ) {}
}

export class DeclarationBStmt implements BoundStatement {
    constructor(
        public name: string,
        public mutable: boolean,
        public value: BoundExpression,
        public type: HexType
    ) {}
}

type elif = {condition: null, block: BlockBStatement}
export class IfBStatement implements BoundStatement {
    constructor(
        public condition: BoundExpression,
        public ifblock: BlockBStatement,
        public elifs: elif[],
        public elseblock?: BlockBStatement,
    ) {}
}

export class ForBStatement implements BoundStatement {
    constructor(
        public symbol: string,
        public iterable: BoundExpression,
        public body: BlockBStatement
    ) {}
}

export class WhileBStatement implements BoundStatement {
    constructor(
        condition: BoundExpression,
        body: BlockBStatement
    ) {}
}

export class FunctionBStmt implements BoundStatement {
    constructor(
        name: string,
        args: number,
        body: BlockBStatement,
        captures: string[]
    ) {}
}

export class ReturnBStatement implements BoundStatement {
    constructor(
        value?: BoundExpression
    ) {}
}

export class NativeBStmt implements BoundStatement {
    constructor(
        args: number,
        body: Pattern[]
    ) {}
}

export class ClassBStatement implements BoundStatement {}