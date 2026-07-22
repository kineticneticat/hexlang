import assert from "assert";
import { Compiler, ImmutableVariable } from "../4-Compiler/Compiler";
import { Pattern } from "../Hex/Hex";
import { Patterns } from "../Hex/Patterns";
import { Class, ClosureFunction, HexBoolean, HexNumber, HexString, HexType, HexUndefined, HexVoid, NativeFunction } from "../types/Types";
import { CodeError, CodeRefrence } from "../Util";
import { BoundBlock, BoundStatement } from "./BoundStatements";
import { compose } from "stream";

export interface BoundExpression {
    type: HexType,
    source: CodeRefrence,
    compile(compiler: Compiler): Pattern[]
}

export class BoundNumberLiteral implements BoundExpression {
    type = HexNumber
    constructor(
        public value: number,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        compiler.workingStackSize++
        return [Patterns.Integer(this.value)]
    }
}

export class BoundStringLiteral implements BoundExpression {
    type = HexString
    constructor(
        public value: string,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        compiler.workingStackSize++
        return [Patterns.NYI("string")]
    }
}

export class BoundBooleanLiteral implements BoundExpression {
    type = HexBoolean
    constructor(
        public value: boolean,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        compiler.workingStackSize++
        return [this.value ? Patterns.True : Patterns.False]
    }
}

export class BoundUndefined implements BoundExpression {
    type = HexUndefined
    constructor(public source: CodeRefrence) {}
    compile(compiler: Compiler): Pattern[] {
        compiler.workingStackSize++
        return [Patterns.Null]
    }
}

export class BoundSymbol implements BoundExpression {
    lastUse = false
    constructor(
        public name: string,
        public type: HexType,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        // return compiler.getVariable(this.name, compiler, this.lastUse)
        return this.type.getAccessHex(compiler, this.name, this.lastUse)
    }
}

export class BoundBinaryExpr implements BoundExpression {
    constructor(
        public operator: [HexType, Pattern[]],
        public left: BoundExpression,
        public right: BoundExpression,
        public source: CodeRefrence
    ){}
    get type() {return this.operator[0]}
    compile(compiler: Compiler): Pattern[] {
        return [
            this.left.compile(compiler),
            this.right.compile(compiler),
            this.operator[1],
            (() => {compiler.workingStackSize--; return []})()
        ].flat()
    }
}

export class BoundVariableAssignment implements BoundExpression {
    type: HexType
    constructor(
        public assignee: BoundSymbol,
        public value: BoundExpression,
        public source: CodeRefrence
    ) {
        this.type = value.type
    }
    compile(compiler: Compiler): Pattern[] {
        return compiler.setVariable(this.assignee.name, this.value.type, this.value.compile(compiler))
    }
}
export class BoundMemberAssignment implements BoundExpression {
    type: HexType
    constructor(
        public assignee: BoundMember,
        public value: BoundExpression,
        public source: CodeRefrence
    ) {
        this.type = value.type
    }
    compile(compiler: Compiler): Pattern[] {
        compiler.workingStackSize--
        return this.assignee.parent.type.setStaticHex(compiler, this.assignee.parent, this.assignee.prop, this.value.compile(compiler))
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
    compile(compiler: Compiler): Pattern[] {
        return this.parent.type.getStaticHex(compiler, this.parent, this.prop)
    }
}

export class BoundCallClosure implements BoundExpression {
    constructor(
        public method: BoundExpression,
        public args: BoundExpression[],
        public type: HexType,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        assert(this.method.type instanceof ClosureFunction)
        // if (this.method.type.leftovers == undefined) throw this.source.Error("Tried to call a closure with no defined leftovers")
        return [
            this.args.map(x => x.compile(compiler)).flat(),
            this.method.compile(compiler), // results in a list of [...captures, body] on the stack
            Patterns.Splat, // results in a stack like [...args, ...captures, body]
            Patterns.ExecuteCont, // body is modified to clean up after itself, should just have the return iota left unless void
            (() => {compiler.workingStackSize-= (this.method.type.returnType == HexVoid ? 1 : 0)+this.args.length ; return []})()
        ].flat()
    }
}
export class BoundCallStatic implements BoundExpression {
    constructor(
        public method: BoundExpression,
        public args: BoundExpression[],
        public type: HexType,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return [
            this.args.map(x=>x.compile(compiler)).flat(),
            this.method.compile(compiler),
            (() => {compiler.workingStackSize -= this.args.length; return []})()
        ].flat()
    }
}
export class BoundCallNative implements BoundExpression {
    constructor(
        public method: BoundExpression,
        public args: BoundExpression[],
        public type: HexType,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return [
                this.args.map(x => x.compile(compiler)).flat(),
                this.method.compile(compiler)
            ].flat()
    }
}

export class BoundCallClass implements BoundExpression {
    constructor(
        public method: BoundExpression,
        public args: BoundExpression[],
        public type: HexType,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        if ((<Class>this.method.type).fields.size != 0) {
            let constructor = (<Class>this.method.type).getConstructor()
            if (!constructor) throw new CodeError(`Class ${this.method.type.name} has no constructor`)
            return [
                this.args.map(x => x.compile(compiler)).flat(),
                constructor.compile(compiler)
            ].flat()
        } else {
            return []
        }
    }
}

export class BoundArray implements BoundExpression {
    constructor(
        public contents: BoundExpression[],
        public type: HexType,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return [
            this.contents.map(x => x.compile(compiler)).flat(),
            Patterns.Number(this.contents.length),
            Patterns.MakeList
        ].flat()
    }
}

export class BoundClosureFunctionValue implements BoundExpression {
    constructor(
        public args: ImmutableVariable[],
        public captures: ImmutableVariable[],
        public type: HexType,
        public body: BoundBlock,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        compiler.pushFrame(this.captures, this.args)
        let body = this.body.compile(compiler)
        compiler.popFrame()
        return body
    }
}

export class BoundStaticFunctionValue implements BoundExpression {
    constructor(
        public args: ImmutableVariable[],
        public type: HexType,
        public body: BoundBlock,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        compiler.pushFrame([], this.args)
        let body = this.body.compile(compiler)
        compiler.popFrame()
        return body
    }
}

export class BoundNativeValue implements BoundExpression {
    constructor(
        public args: ImmutableVariable[],
        public type: HexType,
        public body: Pattern[],
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        compiler.wss(-this.args.length)
        compiler.wss(1)
        return this.body
    }
}