import { SyntaxStatement } from "../2-Parser/SyntaxStatements";
import { CodeError } from "../Util";
import { Pattern } from "../Hex/Hex";
import { Patterns } from "../Hex/Patterns";
// import { Builtins } from "./types/Builtins";
import { ClosureFunction, HexType } from "../types/Types";
import { BoundStatement } from "../3-Binder/BoundStatements";
import { BoundExpression } from "../3-Binder/BoundExpressions";

interface Variable {
    name: string
    type: HexType
    mutable: boolean
    onStack: boolean
}
/** Represents a mutable variable on the stack */
export class MutableVariable implements Variable {
    mutable = true
    onStack = true
    constructor(
        public name: string,
        public type: HexType
    ) {}
}
/** Represents an immutable variable on the stack*/
export class ImmutableVariable implements Variable {
    mutable = false
    onStack = true
    constructor(
        public name: string,
        public type: HexType
    ) {}
}
/** Represents an immutable variable that is not kept on the stack, and whos value is recreated every access */
export class ConstantVariable implements Variable {
    mutable = false
    onStack = false
    constructor(
        public name: string,
        public type: HexType,
        public value: BoundExpression
    ) {}
}

export class Frame {
    stack: Variable[]
    constantVariables: ConstantVariable[]
    workingStackSize: number
    constructor(
        capturedVariables: ImmutableVariable[] = [],
        argumentVariables: ImmutableVariable[] = [],
    ) {
        this.stack = [capturedVariables, argumentVariables].flat()
        this.constantVariables = []
        this.workingStackSize = 0
    }
    get size() {return this.workingStackSize + this.stack.length}
}

export class Compiler {
    static compile(ast: BoundStatement): [Pattern[], Compiler] {
        let compiler = new Compiler()
        return [ast.compile(compiler), compiler]
    }
    frameStack: Frame[]
    constructor() {
        this.frameStack = [new Frame()]
    }
    get currentFrame() { return this.frameStack[this.frameStack.length-1]}
    get workingStackSize() { return this.currentFrame.workingStackSize}
    set workingStackSize(wss: number) { this.currentFrame.workingStackSize = wss}
    wss(delta: number) {this.workingStackSize += delta; return []}
    get localVariables() {return this.currentFrame.stack}
    get topmost(): Variable | undefined {return this.localVariables[this.localVariables.length-1]}
    get secondtop(): Variable | undefined {return this.localVariables[this.localVariables.length-2]}
    get constantVariables() {return this.currentFrame.constantVariables}

    get totalStackSize() {return this.frameStack.map(x=>x.stack).length + this.workingStackSize}

    pushFrame(
        capturedVariables: ImmutableVariable[] = [],
        argumentVariables: ImmutableVariable[] = [],
    ) { this.frameStack.push(new Frame(capturedVariables, argumentVariables))}
    popFrame() {
        let ret = this.frameStack.pop()
        if (this.frameStack.length == 0) throw new CodeError(`Tried to pop the Global frame.`)
        else return ret
    }

    getVariable(name: string, finalUse: boolean = false): Pattern[] {
        let hex = [] as Pattern[]
        let variable: ConstantVariable | undefined
        if ((variable = this.constantVariables.find(x => x.name == name))) {
            hex = variable.value.compile(this)
        } else if (this.localVariables.find(x => x.name == name)) {
            if (this.topmost?.name == name && this.workingStackSize == 0) {
                if (!finalUse) hex = [Patterns.Duplicate]
                else {
                    hex = []
                    this.localVariables.splice(this.localVariables.length-1, 1)
                }
            } else if (this.topmost?.name == name && this.workingStackSize == 1) {
                if (!finalUse) hex = [Patterns.CopyUnder]
                else {
                    hex = [Patterns.Swap]
                    this.localVariables.splice(this.localVariables.length-1, 1)
                }
            } else if (this.secondtop?.name == name && this.workingStackSize == 0) {
                if (!finalUse) hex = [Patterns.CopyUnder]
                else {
                    hex = [Patterns.Swap]
                    this.localVariables.splice(this.localVariables.length-2, 1)
                }
            } else  {
                hex = [Patterns.Integer(this.localVariables.length - this.localVariables.findIndex(x => x.name == name) + this.workingStackSize -1)]
                if (finalUse) hex.push(Patterns.PushFromStack)
                    else hex.push(Patterns.CopyFromStack)
            }
        }
        this.workingStackSize++
        return hex
    }
    declareVariable(name: string, type: HexType, getter: Pattern[]) {
        if (this.localVariables.find(x=>x.name==name) != undefined || this.constantVariables.find(x=>x.name==name)) throw new CodeError(`Can't redeclare variable ${name}`)
        this.currentFrame.stack.push(new MutableVariable(name, type))
        if (this.workingStackSize > 1) getter.concat(Patterns.Number(this.workingStackSize), Patterns.PushFromStack)
        this.workingStackSize-- // iota moved from working stack to variable stack
        return getter
    }
    declareConstant(name:string, type: HexType, value: BoundExpression) {
        this.currentFrame.constantVariables.push(new ConstantVariable(name, type, value))
        return [] as Pattern[]
    }
    setVariable(name: string, type: HexType, getter: Pattern[]) {
        if (this.constantVariables.find(x => x.name==name) != undefined) throw new CodeError("Tried to set constant, but got to compiler somehow?")
        let idx = this.localVariables.findIndex(x=>x.name==name)
        let variable = this.currentFrame.stack.splice(idx, 1)[0]
        if (variable == undefined) throw new CodeError(`Cant assign to undeclared variable ${name}`)
        if (!variable.mutable) throw new CodeError(`Cant assign to immutable ${name}`)
        if (!variable.type.canCastFrom(type)) throw new CodeError(`Cast assign type ${type} to ${name} of type ${variable.type}`)
        this.currentFrame.stack.push(variable)
        return [
            getter,
            Patterns.DeleteNIotasUnder(this.localVariables.length - idx + this.workingStackSize)
        ].flat()
    }
    deleteVariable(name: string): Pattern[] {
        let idx: number | undefined
        if (idx = this.localVariables.findIndex(x => x.name == name)) {
            this.currentFrame.stack.splice(idx, 1)
            return [Patterns.DeleteNIotasUnder(this.localVariables.length - idx + this.workingStackSize -1)]
        } else if (idx = this.constantVariables.findIndex(x => x.name == name)) {
            this.currentFrame.stack.splice(idx, 1)
            return []
        } else throw new CodeError("Somehow tried to delete nonexistant variable")
    }
}