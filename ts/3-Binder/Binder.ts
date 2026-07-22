import { SyntaxArray, SyntaxAssignment, SyntaxBinaryExpr, SyntaxBooleanLiteral, SyntaxCall, SyntaxExpression, SyntaxMember, SyntaxNumberLiteral, SyntaxStringLiteral, SyntaxSymbol, SyntaxUndefined } from "../2-Parser/SyntaxExpressions";
import { SyntaxStatement } from "../2-Parser/SyntaxStatements";
import { Builtins, getBuiltin } from "../types/Builtins";
import { HexType } from "../types/Types";
import { CodeError, CodeRefrence } from "../Util";
import { BoundSymbol } from "./BoundExpressions";
import { BoundStatement } from "./BoundStatements";

class Cleanup {}
class LastUse extends Cleanup {
    constructor(public symbol: BoundSymbol) {super()}
}
export class DontDelete extends Cleanup {}

export class BinderVariable {
    constructor(
        public name: string,
        public type: HexType,
        public mutable: boolean,
        public onStack: boolean,
        public lastUse?: Cleanup
    ) {}
}

class BinderFrame {
    constructor(
        public variables: BinderVariable[] = [],
        public caller: {name: string, returnType: HexType|null}
    ) {}
}

export class Binder {
    frames: BinderFrame[]
    exports: BinderVariable[]
    constructor() {
        this.frames = [new BinderFrame([], {name:"Global", returnType:null})]
        this.exports = []
    }
    static bind(syntaxTree: SyntaxStatement): [BoundStatement, Binder] {
        let binder = new Binder() 
        let boundTree = syntaxTree.bind(binder)
        binder.popFrame()
        return [boundTree, binder]
    }

    get variables() {return this.frames.map(x => x.variables).flat()}
    get currentFrame() {return this.frames[this.frames.length-1]}
    pushFrame(name:string, returnType: HexType) {this.frames.push(new BinderFrame([], {name:name, returnType:returnType}))}
    popFrame() {
        for(let variable of this.currentFrame.variables) {
            if (variable.lastUse && variable.lastUse instanceof LastUse) variable.lastUse.symbol.lastUse = true
        }
        return this.frames.pop()
    }
    getVarType(name: string) {
        let variable: BinderVariable | undefined
        if ((variable = this.variables.find(x => x.name == name)) != undefined) {
            return variable.type
        }
        return getBuiltin(name)?.type
    }
    varExists(name: string) { return this.getVarType(name) != undefined}
    define(name: string, type: HexType, mutable: boolean, onStack: boolean) {
        this.currentFrame.variables.push(new BinderVariable(name, type, mutable, onStack))
    }
    noteUse(name: string, symbol: BoundSymbol) {
        let a = this.variables.find(x=>x.name==name)
        if (a == undefined || !a.onStack || a.lastUse instanceof DontDelete) return
        a.lastUse = new LastUse(symbol)
    }
    export(name: string) {
        this.exports.push(this.variables.find(x => x.name == name) as BinderVariable)
    }
}

