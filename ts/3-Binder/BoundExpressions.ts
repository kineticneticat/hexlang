import { Compiler } from "../4-Compiler/Compiler";
import { Pattern } from "../4-Compiler/Hex/Hex";
import { HexBoolean, HexNumber, HexString, HexType, HexUndefined } from "../types/Types";

export interface BoundExpression {
    type: HexType
}

export class BoundNumberLiteral implements BoundExpression {
    type = HexNumber
    constructor(
        public value: number
    ) {}
}

export class BoundStringLiteral implements BoundExpression {
    type = HexString
    constructor(
        public value: string
    ) {}
}

export class BoundBooleanLiteral implements BoundExpression {
    type = HexBoolean
    constructor(
        public value: boolean
    ) {}
}

export class BoundUndefined implements BoundExpression {type = HexUndefined}

export class BoundSymbol implements BoundExpression {
    constructor(
        public name: string,
        public type: HexType
    ) {}
}

type BoundOperator = {accessor: (compiler: Compiler) => Pattern[], type: HexType}
export class BoundBinaryExpr implements BoundExpression {
    constructor(
        public operator: BoundOperator,
        public left: BoundExpression,
        public right: BoundExpression,
    ){}
    get type() {return this.operator.type}
}

export class BoundAssignment implements BoundExpression {
    type: HexType
    constructor(
        assignee: BoundExpression,
        value: BoundExpression,
    ) {
        this.type = value.type
    }
}

export class BoundMember implements BoundExpression {
    type: HexType
    constructor(
        public parent: BoundExpression,
        public prop: string
    ) {
        this.type = this.parent.type.getStaticType(this.prop)
    }
}

export class BoundCall implements BoundExpression {
    constructor(
        public method: BoundExpression,
        public args: BoundExpression[],
        public type: HexType
    ) {}
}

export class BoundArray implements BoundExpression {
    constructor(
        public contents: BoundExpression[],
        public type: HexType
    ) {}
}
