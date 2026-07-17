import { Compiler, Frame, LockedVariable } from "../4-Compiler/Compiler";
import { Pattern } from "../Hex/Hex";
import { Patterns } from "../Hex/Patterns";
import { Closure, HexType, HexVoid, Native } from "../types/Types";
import { CodeRefrence } from "../Util";
import { BoundExpression, HardcodedExpr } from "./BoundExpressions";

export interface BoundStatement {
    source: CodeRefrence
    compile(compiler: Compiler): Pattern[]
}

export class BoundBlock implements BoundStatement {
    constructor(
        public statements: BoundStatement[],
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return this.statements.map(x => x.compile(compiler)).flat()
    }
}

export class BoundExpressionStmt implements BoundStatement {
    constructor(
        public expression: BoundExpression,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return this.expression.compile(compiler)
    }
}

export class BoundMutableDec implements BoundStatement {
    constructor(
        public name: string,
        public value: BoundExpression,
        public type: HexType,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        let val = this.value.compile(compiler)
        compiler.workingStackSize++
        return compiler.declareVariable(this.name, this.type, val)
    }
}
export class BoundConstantDec implements BoundStatement {
    constructor(
        public name: string,
        public value: BoundExpression,
        public type: HexType,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return compiler.declareConstant(this.name, this.type, this.value)
    }
}

type elif = {condition: BoundExpression, block: BoundBlock}
function constructElif(compiler: Compiler, remaining: elif[], elseblock: BoundBlock): Pattern[] {
    if (remaining.length == 0) {
        return [
            Patterns.Open,
            elseblock.compile(compiler),
            Patterns.Close
        ].flat()
    } else {
        let elif = remaining.splice(0,1)[0]
        return [
            Patterns.Open,
            elif.condition.compile(compiler),
            Patterns.Open,
            elif.block.compile(compiler),
            Patterns.Close,
            constructElif(compiler, remaining, elseblock),
            Patterns.Switch,
            Patterns.Execute,
            Patterns.Close
        ].flat()
    }
}
export class BoundIf implements BoundStatement {
    constructor(
        public condition: BoundExpression,
        public ifblock: BoundBlock,
        public elifs: elif[],
        public source: CodeRefrence,
        public elseblock?: BoundBlock
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return [
            this.condition.compile(compiler),
            (() => {compiler.workingStackSize--; return []})(),
            Patterns.Open,
            this.ifblock.compile(compiler),
            Patterns.Close,
            (() => {
                if (this.elifs.length == 0 && this.elseblock == undefined) return [Patterns.EmptyList]
                else if (this.elifs.length == 0) return this.elseblock?.compile(compiler) as Pattern[]
                else return constructElif(compiler, this.elifs, this.elseblock as BoundBlock)
            })(),
            Patterns.Switch,
            Patterns.Execute
        ].flat()
    }
}

export class BoundFor implements BoundStatement {
    constructor(
        public symbol: string,
        public iterable: BoundExpression,
        public body: BoundBlock,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return [Patterns.NYI("for")]
    }
}

export class BoundWhile implements BoundStatement {
    constructor(
        public condition: BoundExpression,
        public body: BoundBlock,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return [Patterns.NYI("while")]
    }
}

export class BoundFunction implements BoundStatement {
    constructor(
        public name: string,
        public args: LockedVariable[],
        public body: BoundBlock,
        public captures: LockedVariable[],
        public returnType: HexType,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        let type = new Closure(this.args.map(x=>x.type), this.returnType)
        compiler.pushFrame(
            this.captures,
            this.args
        )
        let body = this.body.compile(compiler)
        let frame = compiler.popFrame() as Frame
        let hex = [
            compiler.declareVariable(this.name, type, [
                this.captures.map( x => compiler.getVariable(x.name, compiler)).flat(),
                Patterns.Open,
                Patterns.Number(-(this.captures.length + this.args.length)),
                Patterns.PushFromStack,
                body,
                type.returnType == HexVoid ? Patterns.Bookkeepers("v".repeat(frame.totalVariableStackSize+1)) : Patterns.Bookkeepers("v".repeat(frame.totalVariableStackSize) + "-"),
                Patterns.Close,
                (() => { compiler.workingStackSize++; return []})(),
                Patterns.Number(1+this.captures.length),
                Patterns.MakeList,
                (() => {compiler.workingStackSize -= 1+this.captures.length; return []})()
            ].flat()),
        ].flat()
        return hex
    }
}

export class BoundReturn implements BoundStatement {
    constructor(
        public source: CodeRefrence,
        public value?: BoundExpression
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return [
            this.value != undefined ? this.value.compile(compiler) : [],
            Patterns.Number(compiler.currentFrame.totalVariableStackSize),
            Patterns.CopyFromStack,
            Patterns.Execute
        ].flat()
    }
}

export class BoundNative implements BoundStatement {
    constructor(
        public name: string,
        public args: LockedVariable[],
        public body: Pattern[],
        public returnType: HexType,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return compiler.declareConstant(this.name, new Native(this.args.map(x=>x.type), this.returnType), new HardcodedExpr(this.returnType, this.body))
    }
}

export class BoundClass implements BoundStatement {
    constructor(
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return [Patterns.NYI("class")]
    }
}