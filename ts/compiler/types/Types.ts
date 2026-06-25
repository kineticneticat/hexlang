import { SyntaxExpression } from "../../parser/SyntaxExpressions";
import { CodeError } from "../../Util";
import { Compiler } from "../Compiler";
import { Pattern } from "../Hex/Hex";
import { Patterns } from "../Hex/Patterns";
// import { Builtin } from "./Builtins";

// export class HardcodedExpr implements Expression {
//     constructor(
//         public type: HexType,
//         public hex: Pattern[],
//         public wssdelta: number = 0
//     ) {}
//     compile(compiler: Compiler): Pattern[] {
//         compiler.workingStackSize += this.wssdelta
//         return this.hex
//     }
// }


export abstract class HexType {
    abstract name: string
    // symbols = new Map<string, Expression>([])
    // getSymbolHex(compiler: Compiler, property: string): Pattern[] | undefined {
    //     if (!this.symbols.has(property)) return undefined
    //     let prop = this.symbols.get(property) as Expression
    //     let doer = prop.compile(compiler)as Pattern[]
    //     return [doer].flat()
    // }
    // getSymbolType(property: string): HexType | undefined {
    //     if (!this.symbols.has(property)) return undefined
    //     return (this.symbols.get(property) as Expression).type as HexType
    // }
    // setSymbolHex(compiler: Compiler, property: string, value: Pattern[]): Pattern[] {
    //     throw new CodeError(`Cant set Symbols on type ${this.name}`)
    // }

    // fields = new Map<string, Expression>([])
    // getFieldHex(compiler: Compiler, getter: Pattern[], property: string): Pattern[] | undefined {
    //     if (!this.fields.has(property)) return undefined
    //     let prop = this.fields.get(property) as Expression
    //     let doer = prop.compile(compiler)as Pattern[]
    //     return [getter, doer].flat()
    // }
    // getFieldType(property: string): HexType | undefined {
    //     if (!this.fields.has(property)) return undefined
    //     return (this.fields.get(property) as Expression).type as HexType
    // }
    // setFieldHex(compiler: Compiler, getter: Pattern[], property: string, value: Pattern[]): Pattern[] {
    //     throw new CodeError(`Cant set Fields on type ${this.name}`)
    // }

    // getIndexHex(compiler: Compiler, getter: Pattern[], property: Pattern[]): Pattern[] {
    //     throw new CodeError(`Cant access Indices on type ${this.name}`)
    // }
    // getIndexType(property: Pattern[]): HexType | null {
    //     return null
    //     // throw new CodeError(`Cant access Indices on type ${this.name}`)
    // }
    // setIndexHex(compiler: Compiler, getter: Pattern[], property: Pattern[], value: Pattern[]): Pattern[] {
    //     throw new CodeError(`Cant set Indices on type ${this.name}`)
    // }

    getAccessHex(compiler: Compiler, name: string): Pattern[] {
        return compiler.getVariable(name)
    }

    // getStaticType(property: string) {
    //     let type: HexType | undefined
    //     if (( type = this.getSymbolType(property))) {
    //         return type
    //     } else if (( type = this.getFieldType(property))) {
    //         return type
    //     } else throw new CodeError(`Tried to type ${property} on ${this.name}, but couldn't find the prop.`)
    // }
    // getStaticHex(compiler: Compiler, parent: Expression, propery: string): Pattern[] {
    //     if (this.getSymbolType(propery)) {
    //         return this.getSymbolHex(compiler, propery) as Pattern[]
    //     } else if (this.getFieldType(propery)) {
    //         return this.getFieldHex(compiler, parent.compile(compiler), propery) as Pattern[]
    //     }
    //     throw new CodeError(`Tried to access ${propery} on ${this.name}, but couldn't find the prop.`)
    // }

    // true if `that` can be cast to `this`, false otherwise
    // i.e number can cast to any, but any cant cast to number
    abstract canCastFrom(that: HexType): boolean
    static ErrorNonequal(A: HexType, B: HexType) {
        throw new Error(`Type ${B.name} cannot be cast to ${A.name}`)
    }
}

export abstract class Executable extends HexType {
    abstract paramTypes: HexType[]
    abstract returnType: HexType
}

export class Native extends Executable {
    constructor(
        public paramTypes: HexType[],
        public returnType: HexType,
    ) {super()}
    get name() {
        return `<${this.paramTypes.map(x=>x?.name).join(", ")}> => ${this.returnType.name}`
    }
    canCastFrom(type: HexType): boolean {
        if (!(type instanceof Closure)) return false
        return this.name == type.name
    }
}

export class Closure extends Executable {
    constructor(
        public paramTypes: HexType[],
        public returnType: HexType,
        public leftovers?: number
    ) {super()}
    get name() {
        return `(${this.paramTypes.map(x=>x?.name).join(", ")}) => ${this.returnType.name}`
    }
    canCastFrom(type: HexType): boolean {
        if (!(type instanceof Closure)) return false
        return this.name == type.name
    }
}

// export class 

export abstract class Primitive extends HexType {
}
class _HexNumber extends Primitive {
    name = "number"
    canCastFrom(that: HexType): boolean {
        return that == HexNumber
    }
}
export const HexNumber = new _HexNumber()
class _HexString extends Primitive {
    name = "string"
    canCastFrom(that: HexType): boolean {
        return that == HexString
    }
}
export const HexString = new _HexString()

class _Undefined extends Primitive {
    name = "undefined"
    canCastFrom(that: HexType): boolean {
        return that == HexUndefined
    }
}
export const HexUndefined = new _Undefined
class _HexAny extends Primitive {
    name = "any"
    canCastFrom(that: HexType): boolean {
        return true
    }
}
export const HexAny = new _HexAny
class _HexVoid extends Primitive {
    name = "void"
    canCastFrom(that: HexType): boolean {
        return false
    }
}
export const HexVoid = new _HexVoid
class _HexVector extends Primitive {
    name = "vector"
    // fields = new Map<string, Expression>([
    //     ["x", new HardcodedExpr(HexNumber, [Patterns.SplitVector, Patterns.Bookkeepers("-vv")])],
    //     ["y", new HardcodedExpr(HexNumber, [Patterns.SplitVector, Patterns.Bookkeepers("v-v")])],
    //     ["z", new HardcodedExpr(HexNumber, [Patterns.SplitVector, Patterns.Bookkeepers("vv-")])],
    // ])
    canCastFrom(that: HexType): boolean {
        return that == HexVector
    }
}
export const HexVector = new _HexVector
class _HexEntity extends Primitive {
    name = "Entity"
    // fields: Map<string, HardcodedExpr> = new Map([
    //     ["eyepos", new HardcodedExpr(HexVector, [Patterns.EyePos])],
    //     ["lookdir", new HardcodedExpr(HexVector, [Patterns.LookDir])],
    // ])
    canCastFrom(that: HexType): boolean {
        return that == HexEntity
    }
    
}
export const HexEntity = new _HexEntity()
class _HexBoolean extends Primitive {
    name = "Boolean"
    canCastFrom(that: HexType): boolean {
        return that == HexBoolean
    }
}
export const HexBoolean = new _HexBoolean()

export class OptionsType extends HexType {
    types: HexType[]
    constructor(
        ...types: HexType[]
    ) {
        super()
        this.types = types.filter((x, i, s) => s.indexOf(x)==i)
    }
    get name() {
        return this.types.map(x=>x.name).join(" | ")
    }
    canCastFrom(that: HexType): boolean {

        if (that instanceof OptionsType) {
            return that.types.map((x) => this.types.includes(x)).reduce((p,c)=> p && c)
        } else {
            return false
        }
    }
}

// export class Tuple extends HexType {
//     constructor(
//         public types: HexType[]
//     ) {super()}
//     get name() {
//         return `[${this.types.map(x=>x.name).join(", ")}]`
//     }
//     private get options() {
//         return new OptionsType(...this.types)
//     }
//     canCastFrom(type: HexType): boolean {
//         if (!(type instanceof Tuple)) return false
//         return type.types.map((x, i) => x.canCastFrom(this.types[i])).reduce((p,c)=>p&&c)
//     }
// }

export class List extends HexType {
    constructor(
        public type: HexType
    ) {super()}
    get name() {
        let name = this.type.name
        return `${name.includes(" ") ?  `(${name})` : name}[]`
    }
    canCastFrom(that: HexType): boolean {
        if (!(that instanceof List)) return false
        return this.type.canCastFrom(that.type)
    }
}

function positionInIterator(x: string, keys: MapIterator<string>) {
    let i = 0
    for (let key of keys) {
        if (x == key) return i
        else i++
    }
    return -1
}

// export class Class extends Executable {

//     constructor(
//         public name: string,
//         public symbols: Map<string, Expression>,
//         public fields: Map<string, Expression>,
//     ) {
//         super()
//         // If constructor is not defined, then 
//         if (!symbols.has("constructor") && !fields.has("constructor")) {
//             symbols.set("constructor", new HardcodedExpr(new Native([], new ClassInstance(this)), [Patterns.EmptyList], 1))
//         }
//         let constr = this.getConstructor()
//         if (!(constr.type instanceof Executable)) throw new CodeError("Somehow have a constructor with a non-executable type?")
//         if ((constr.type.returnType instanceof ClassInstance)) throw new CodeError(`${this.name}'s constructor does not return a class instance.`)
//     }
//     getConstructor() {return (this.symbols.get("constructor") || this.fields.get("constructor") as Expression)}
//     get paramTypes() { return (this.getConstructor().type as Executable).paramTypes}
//     get returnType() { return (this.getConstructor().type as Executable).returnType}
//     canCastFrom(that: HexType): boolean {
//         return false
//     }
// }
// export class ClassInstance extends HexType {
//     name: string;
//     constructor(
//         public parent: Class,
//     ) {
//         super()
//         this.name = "I" + parent.name
//     }
//     canCastFrom(that: HexType): boolean {
//         return this.name == that.name
//     }
//     getAccessHex(compiler: Compiler, name: string): Pattern[] {
//         if (this.parent instanceof Builtin) return this.parent.getAccessHex(compiler, name)
//         return super.getAccessHex(compiler, name)
//     }
//     getFieldType(property: string): HexType | undefined {
//         return this.parent.getFieldType(property)
//     }
//     getFieldHex(compiler: Compiler, getter: Pattern[], property: string): Pattern[] | undefined {
//         return this.parent.getFieldHex(compiler, getter, property)
//     }
//     getSymbolType(property: string): HexType | undefined {
//         return this.parent.getSymbolType(property)
//     }
//     getSymbolHex(compiler: Compiler, property: string): Pattern[] | undefined {
//         return this.parent.getSymbolHex(compiler, property)
//     }
// }

