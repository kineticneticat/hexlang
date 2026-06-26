import { Compiler } from "../4-Compiler/Compiler";
import { Pattern } from "../4-Compiler/Hex/Hex";
import { HexBoolean, HexNumber, HexString, HexType, HexUndefined } from "../types/Types";
import { CodeRefrence } from "../Util";

export interface BoundExpression {
    type: HexType,
    source: CodeRefrence
}

export class HardcodedExpr implements BoundExpression {
    source = new CodeRefrence(0,0)
    constructor(
        public type: HexType,
        public hex: Pattern[],
        public wssdelta: number = 0
    ) {}
    compile(compiler: Compiler): Pattern[] {
        compiler.workingStackSize += this.wssdelta
        return this.hex
    }
}

export class BoundNumberLiteral implements BoundExpression {
    type = HexNumber
    constructor(
        public value: number,
        public source: CodeRefrence
    ) {}
}

export class BoundStringLiteral implements BoundExpression {
    type = HexString
    constructor(
        public value: string,
        public source: CodeRefrence
    ) {}
}

export class BoundBooleanLiteral implements BoundExpression {
    type = HexBoolean
    constructor(
        public value: boolean,
        public source: CodeRefrence
    ) {}
}

export class BoundUndefined implements BoundExpression {
    type = HexUndefined
    constructor(public source: CodeRefrence) {}
}

export class BoundSymbol implements BoundExpression {
    constructor(
        public name: string,
        public type: HexType,
        public source: CodeRefrence
    ) {}
}

export type BoundOperator = {accessor: (compiler: Compiler) => Pattern[], type: HexType}
export class BoundBinaryExpr implements BoundExpression {
    constructor(
        public operator: BoundOperator,
        public left: BoundExpression,
        public right: BoundExpression,
        public source: CodeRefrence
    ){}
    get type() {return this.operator.type}
}

export class BoundAssignment implements BoundExpression {
    type: HexType
    constructor(
        public assignee: BoundExpression,
        public value: BoundExpression,
        public source: CodeRefrence
    ) {
        this.type = value.type
    }
}

export class BoundMember implements BoundExpression {
    type: HexType
    constructor(
        public parent: BoundExpression,
        public prop: string,
        public source: CodeRefrence
    ) {
        this.type = this.parent.type.getStaticType(this.prop)
    }
}

export class BoundCallClosure implements BoundExpression {
    constructor(
        public method: BoundExpression,
        public args: BoundExpression[],
        public type: HexType,
        public source: CodeRefrence
    ) {}
}
export class BoundCallNative implements BoundExpression {
    constructor(
        public method: BoundExpression,
        public args: BoundExpression[],
        public type: HexType,
        public source: CodeRefrence
    ) {}
}

export class BoundArray implements BoundExpression {
    constructor(
        public contents: BoundExpression[],
        public type: HexType,
        public source: CodeRefrence
    ) {}
}
