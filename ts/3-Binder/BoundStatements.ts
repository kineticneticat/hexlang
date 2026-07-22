import { IDeclares } from "../2-Parser/SyntaxStatements";
import { Compiler, Frame, ImmutableVariable } from "../4-Compiler/Compiler";
import { Pattern } from "../Hex/Hex";
import { Patterns } from "../Hex/Patterns";
import { Class, ClosureFunction, HexType, HexVoid, NativeFunction, StaticFunction } from "../types/Types";
import { CodeRefrence } from "../Util";
import { BoundExpression } from "./BoundExpressions";
import { HardcodedExpr } from "../types/Types";
import { BinderVariable } from "./Binder";

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
        return [
            this.expression.compile(compiler),
            Patterns.Bookkeepers("v".repeat(compiler.workingStackSize))
        ].flat()
    }
}

export class BoundMutableDec implements BoundStatement, IDeclares {
    constructor(
        public name: string,
        public value: BoundExpression,
        public type: HexType,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        let val = this.value.compile(compiler)
        return compiler.declareVariable(this.name, this.type, val)
    }
}
export class BoundConstantDec implements BoundStatement, IDeclares {
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

export class BoundClosureFunction implements BoundStatement, IDeclares {
    constructor(
        public name: string,
        public args: ImmutableVariable[],
        public body: BoundBlock,
        public captures: ImmutableVariable[],
        public returnType: HexType,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        let type = new ClosureFunction(this.captures, this.args.map(x=>x.type), this.returnType)
        compiler.pushFrame(
            this.captures,
            this.args
        )
        let body = this.body.compile(compiler)
        let frame = compiler.popFrame() as Frame
        return compiler.declareVariable(this.name, type, [
            this.captures.map( x => compiler.getVariable(x.name)).flat(),
            Patterns.Open,
            Patterns.Integer(-(this.captures.length + this.args.length)),
            Patterns.PushFromStack,
            body,
            type.returnType == HexVoid ? Patterns.Bookkeepers("v".repeat(frame.size+1)) : Patterns.Bookkeepers("v".repeat(frame.size) + "-"),
            Patterns.Close,
            (() => { compiler.workingStackSize++; return []})(),
            this.captures.length == 0 ? Patterns.SingleList : [Patterns.Integer(1+this.captures.length), Patterns.MakeList],
            (() => {compiler.workingStackSize -= this.captures.length; return []})()
        ].flat())
    }
}

export class BoundStaticFunction implements BoundStatement, IDeclares {
    constructor(
        public name: string,
        public args: ImmutableVariable[],
        public body: BoundBlock,
        public returnType: HexType,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        let type = new StaticFunction(this.args.map(x=>x.type), this.returnType)
        compiler.pushFrame(
            [],
            this.args
        )
        let body = this.body.compile(compiler)
        compiler.popFrame()
        return compiler.declareConstant(this.name, type, new HardcodedExpr(type, body))
    }
}

export class BoundReturn implements BoundStatement {
    earlyReturn = true // assume its early unless binder says otherwise
    constructor(
        public source: CodeRefrence,
        public value?: BoundExpression
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return [
            this.value != undefined ? this.value.compile(compiler) : [],
            this.earlyReturn ? [Patterns.Integer(compiler.currentFrame.size),
            Patterns.CopyFromStack,
            Patterns.Execute] : []
        ].flat()
    }
}

export class BoundNative implements BoundStatement, IDeclares {
    constructor(
        public name: string,
        public args: ImmutableVariable[],
        public body: Pattern[],
        public returnType: HexType,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return compiler.declareConstant(this.name, new NativeFunction(this.args.map(x=>x.type), this.returnType), new HardcodedExpr(this.returnType, this.body))
    }
}

export class BoundClass implements BoundStatement, IDeclares {
    constructor(
        public name: string,
        public type: Class,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return compiler.declareConstant(this.name, this.type, new HardcodedExpr(this.type, []))
    }
}


export class BoundImport implements BoundStatement {
    constructor(
        public variables: BinderVariable[],
        public boundTree: BoundStatement,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        let [otherHex, otherCompiler] = Compiler.compile(this.boundTree)
        this.variables = this.variables.filter(x => otherCompiler.localVariables.find(y=>x.name == y.name))
        return [
            otherHex,
            otherCompiler.totalStackSize != 1 ? Patterns.Bookkeepers(otherCompiler.frameStack.map(x=> x.stack).flat().map(x=>this.variables.find(y=>y.name==x.name)?"-":"v").join("")) : [],
            compiler.wss(this.variables.length),
            this.variables.map(x => {
                if (!x.onStack && !x.mutable) return compiler.declareConstant(x.name, x.type, otherCompiler.constantVariables.find(y => x.name == y.name)!.value)
                else return [
                    otherCompiler.getVariable(x.name, true),
                    compiler.declareVariable(x.name, x.type, [])
                ].flat()
            }).flat(),
        ].flat()
    }
}

export class BoundExport implements BoundStatement {
    constructor(
        public declaration: BoundStatement & IDeclares,
        public source: CodeRefrence
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return this.declaration.compile(compiler)
    }
}