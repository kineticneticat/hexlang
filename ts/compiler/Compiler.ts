import { SyntaxStatement } from "../parser/SyntaxStatements";
import { CodeError } from "../Util";
import { Pattern } from "./Hex/Hex";
import { Patterns } from "./Hex/Patterns";
// import { Builtins } from "./types/Builtins";
import { HexType } from "./types/Types";

interface Variable {
    name: string
    type: HexType
    mutable: boolean
}
class MutableVariable implements Variable {
    mutable = true
    constructor(
        public name: string,
        public type: HexType
    ) {}
}
class ConstantVariable implements Variable {
    mutable = false
    constructor(
        public name: string,
        public type: HexType,
        public getter: Pattern[]
    ) {}
}
export class LockedVariable implements Variable {
    mutable = false
    constructor(
        public name: string,
        public type: HexType
    ) {}
}

export class Frame {
    localVariables: Variable[]
    workingStackSize: number
    constructor(
        public capturedVariables: LockedVariable[] = [],
        public argumentVariables: LockedVariable[] = [],
    ) {
        this.localVariables = []
        this.workingStackSize = 0
    }
    get totalVariableSize() {return this.workingStackSize + this.localVariables.length + this.capturedVariables.length + this.argumentVariables.length}
}

export class Compiler {
    static compile(ast: SyntaxStatement) {
        let compiler = new Compiler()
        // return {hex: ast.compile(compiler), compiler: compiler}
    }
    frameStack: Frame[]
    constructor() {
        this.frameStack = [new Frame()]
    }
    get currentFrame() { return this.frameStack[this.frameStack.length-1]}
    get workingStackSize() { return this.currentFrame.workingStackSize}
    set workingStackSize(wss: number) { this.frameStack[this.frameStack.length-1].workingStackSize = wss}
    get localVariables() {return this.currentFrame.localVariables}
    get argumentVariables() {return this.currentFrame.argumentVariables}
    get capturedVariables() {return this.currentFrame.capturedVariables}

    pushFrame(
        capturedVariables: LockedVariable[] = [],
        argumentVariables: LockedVariable[] = [],
    ) { this.frameStack.push(new Frame(capturedVariables, argumentVariables))}
    popFrame() { return this.frameStack.pop()}

    getVariable(name: string): Pattern[] {
        let hex = [] as Pattern[]
        let variable: Variable | undefined
        if ((variable = this.localVariables.find(x => x.name == name))) {
            if (variable instanceof ConstantVariable) {
                this.workingStackSize++
                return variable.getter
            }
            if (this.localVariables[this.localVariables.length-1]?.name == name && this.workingStackSize == 0) {
                hex =  [Patterns.Duplicate]
            } else if (this.localVariables[this.localVariables.length-1]?.name == name && this.workingStackSize == 1) {
                hex =  [Patterns.CopyUnder]
            } else if (this.localVariables[this.localVariables.length-2]?.name == name && this.workingStackSize == 0) {
                hex =  [Patterns.CopyUnder]
            } else  {
                hex = [
                    Patterns.Number(this.localVariables.length - this.localVariables.findIndex(x => x.name == name) + this.workingStackSize -1),
                    Patterns.CopyFromStack
                ]
            }
        } else if (this.capturedVariables.find(x => x.name == name)) {
            if (this.capturedVariables[this.capturedVariables.length-1]?.name == name && this.workingStackSize + this.localVariables.length == 0) {
                hex = [Patterns.Duplicate]
            } else if (this.capturedVariables[this.capturedVariables.length-1]?.name == name && this.workingStackSize + this.localVariables.length == 1) {
                hex = [Patterns.CopyUnder]
            } else if (this.capturedVariables[this.capturedVariables.length-2]?.name == name && this.workingStackSize + this.localVariables.length == 0) {
                hex = [Patterns.CopyUnder]
            } else {
                hex = [
                    Patterns.Number(this.capturedVariables.length - this.capturedVariables.findIndex(x => x.name == name) + this.localVariables.length + this.workingStackSize -1),
                    Patterns.CopyFromStack
                ]
            }
        } else if (this.argumentVariables.find(x => x.name == name)) {
            if (this.argumentVariables[this.argumentVariables.length-1]?.name == name && this.workingStackSize + this.localVariables.length + this.capturedVariables.length  == 0) {
                hex = [Patterns.Duplicate]
            } else if (this.argumentVariables[this.argumentVariables.length-1]?.name == name && this.workingStackSize + this.localVariables.length + this.capturedVariables.length  == 1) {
                hex = [Patterns.CopyUnder]
            } else if (this.argumentVariables[this.argumentVariables.length-2]?.name == name && this.workingStackSize + this.localVariables.length + this.capturedVariables.length  == 0) {
                hex = [Patterns.CopyUnder]
            } else {
                hex = [
                    Patterns.Number(this.argumentVariables.length - this.argumentVariables.findIndex(x => x.name == name) + this.capturedVariables.length + this.localVariables.length + this.workingStackSize -1),
                    Patterns.CopyFromStack
                ]
            }
        }
        this.workingStackSize++
        return hex
    }
    declareVariable(name: string, type: HexType, mutable: boolean, getter: Pattern[]) {
        if (this.localVariables.find(x=>x.name==name) != undefined || this.argumentVariables.find(x=>x.name==name) != undefined || this.capturedVariables.find(x=>x.name==name) != undefined) throw new CodeError(`Can't redeclare variable ${name}`)
        if (mutable) {
            this.frameStack[this.frameStack.length-1].localVariables.push(new MutableVariable(name, type))
            this.workingStackSize-- // iota moved from working stack to variable stack
            return getter
        } else {
            this.frameStack[this.frameStack.length-1].localVariables.push(new ConstantVariable(name, type, getter))
            return [] // uhhhh this will break if you use any local variable accesses lmao
        }
    }
    setVariable(name: string, type: HexType, getter: Pattern[]) {
        if (this.argumentVariables.find(x=>x.name==name) != undefined || this.capturedVariables.find(x=>x.name==name) != undefined) throw new CodeError(`Can't modify non-local variable ${name}`)
        let idx = this.localVariables.findIndex(x=>x.name==name)
        let variable = this.frameStack[this.frameStack.length-1].localVariables.splice(idx, 1)[0]
        if (variable == undefined) throw new CodeError(`Cant assign to undeclared variable ${name}`)
        if (!variable.mutable) throw new CodeError(`Cant assign to constant ${name}`)
        if (!variable.type.canCastFrom(type)) throw new CodeError(`Cast assign type ${type} to ${name} of type ${variable.type}`)
        this.frameStack[this.frameStack.length-1].localVariables.push(variable)
        return [
            getter,
            Patterns.DeleteNIotasUnder(this.localVariables.length - idx + this.workingStackSize)
        ].flat()
    }
    deleteVariable(name: string): Pattern[] {
        if (this.argumentVariables.find(x=>x.name==name) || this.capturedVariables.find(x=>x.name==name)) throw new CodeError(`Can't delete non-local variable ${name}`)
        let idx = this.localVariables.findIndex(x => x.name == name)
        this.frameStack[this.frameStack.length-1].localVariables.splice(idx, 1)
        let hex = [Patterns.DeleteNIotasUnder(this.localVariables.length - idx + this.workingStackSize -1)]
        return hex
    }
}