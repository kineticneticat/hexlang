import { BoundExpression } from "../3-Binder/BoundExpressions";
import { BiMap, CodeError, CodeRefrence } from "../Util";
import { Compiler, ImmutableVariable } from "../4-Compiler/Compiler";
import { Pattern } from "../Hex/Hex";
import { Patterns } from "../Hex/Patterns";
import { TokenKind } from "../1-Lexer/Token";

export abstract class HexType {
    abstract name: string
    symbols = new Map<string, BoundExpression>([])
    getSymbolHex(compiler: Compiler, property: string): Pattern[] | undefined {
        if (!this.symbols.has(property)) return undefined
        let prop = this.symbols.get(property) as BoundExpression
        let doer = prop.compile(compiler)as Pattern[]
        return [doer].flat()
    }
    getSymbolType(property: string): HexType | undefined {
        if (!this.symbols.has(property)) return undefined
        return (this.symbols.get(property) as BoundExpression).type as HexType
    }
    setSymbolHex(compiler: Compiler, property: string, value: Pattern[]): Pattern[] {
        throw new CodeError(`Cant set Symbols on type ${this.name}`)
    }

    fields = new Map<string, BoundExpression>([])
    getFieldHex(compiler: Compiler, getter: Pattern[], property: string): Pattern[] | undefined {
        if (!this.fields.has(property)) return undefined
        let prop = this.fields.get(property) as BoundExpression
        let doer = prop.compile(compiler)as Pattern[]
        return [getter, doer].flat()
    }
    getFieldType(property: string): HexType | undefined {
        if (!this.fields.has(property)) return undefined
        return (this.fields.get(property) as BoundExpression).type as HexType
    }
    setFieldHex(compiler: Compiler, getter: Pattern[], property: string, value: Pattern[]): Pattern[] {
        throw new CodeError(`Cant set Fields on type ${this.name}`)
    }

    getIndexHex(compiler: Compiler, getter: Pattern[], property: Pattern[]): Pattern[] {
        throw new CodeError(`Cant access Indices on type ${this.name}`)
    }
    getIndexType(property: Pattern[]): HexType | null {
        return null
        // throw new CodeError(`Cant access Indices on type ${this.name}`)
    }
    setIndexHex(compiler: Compiler, getter: Pattern[], property: Pattern[], value: Pattern[]): Pattern[] {
        throw new CodeError(`Cant set Indices on type ${this.name}`)
    }

    operators = new BiMap<TokenKind, string, [HexType, Pattern[]]>()
    getOperator(operator: TokenKind, rightType: HexType, source?: CodeRefrence) {
        if (!this.operators.has(operator, rightType.name))
            throw source?.Error(`No valid operator exists for combination ${this.name} ${TokenKind[operator]} ${rightType.name}`)
        return this.operators.get(operator, rightType.name) as [HexType, Pattern[]]
    }

    getAccessHex(compiler: Compiler, name: string, lastUse?: boolean): Pattern[] {
        return compiler.getVariable(name, lastUse)
    }

    getStaticType(property: string) {
        let type: HexType | undefined
        if (( type = this.getSymbolType(property))) {
            return type
        } else if (( type = this.getFieldType(property))) {
            return type
        } else {
            // console.log(new Error().stack)
            throw new CodeError(`Tried to type ${property} on ${this.name}, but couldn't find the prop.`)
        }
    }
    getStaticHex(compiler: Compiler, parent: BoundExpression, property: string): Pattern[] {
        if (this.getSymbolType(property)) {
            return this.getSymbolHex(compiler, property) as Pattern[]
        } else if (this.getFieldType(property)) {
            return this.getFieldHex(compiler, parent.compile(compiler), property) as Pattern[]
        }
        throw new CodeError(`Tried to access ${property} on ${this.name}, but couldn't find the prop.`)
    }
    setStaticHex(compiler: Compiler, parent: BoundExpression, property: string, value: Pattern[]): Pattern[] {
        if (this.getSymbolType(property)) {
            return this.setSymbolHex(compiler, property, value) as Pattern[]
        } else if (this.getFieldType(property)) {
            return this.setFieldHex(compiler, parent.compile(compiler), property, value) as Pattern[]
        }
        throw new CodeError(`Tried to set ${property} on ${this.name}, but couldn't find the prop.`)
    }

    // true if `that` can be cast to `this`, false otherwise
    // i.e number can cast to any, but any cant cast to number
    abstract canCastFrom(that: HexType): boolean
    static ErrorNonequal(A: HexType, B: HexType) {
        throw new Error(`Type ${B.name} cannot be cast to ${A.name}`)
    }
}

export class HardcodedExpr implements BoundExpression {
    source = new CodeRefrence(0, 0);
    constructor(
        public type: HexType,
        public hex: Pattern[],
        public wssdelta: number = 0
    ) { }
    compile(compiler: Compiler): Pattern[] {
        compiler.workingStackSize += this.wssdelta;
        return this.hex;
    }
}

export abstract class Executable extends HexType {
    abstract paramTypes: HexType[]
    abstract returnType: HexType
}

export class NativeFunction extends Executable {
    constructor(
        public paramTypes: HexType[],
        public returnType: HexType,
    ) {super()}
    get name() {
        return `<${this.paramTypes.map(x=>x?.name).join(", ")}> => ${this.returnType.name}`
    }
    canCastFrom(type: HexType): boolean {
        if (!(type instanceof ClosureFunction)) return false
        return this.name == type.name
    }
}

export class ClosureFunction extends Executable {
    constructor(
        public captures: ImmutableVariable[],
        public paramTypes: HexType[],
        public returnType: HexType,
    ) {super()}
    get name() {
        return `(${this.paramTypes.map(x=>x.name).join(", ")})+${this.captures.length} => ${this.returnType.name}`
    }
    canCastFrom(type: HexType): boolean {
        if (!(type instanceof ClosureFunction)) return false
        return this.name == type.name
    }
}

export class StaticFunction extends Executable {
    constructor(
        public paramTypes: HexType[],
        public returnType: HexType
    ) {super()}
    get name() {
        return `(${this.paramTypes.map(x=>x.name).join(", ")}) => ${this.returnType.name}`
    }
    canCastFrom(that: HexType): boolean {
        if (!(that instanceof StaticFunction)) return false
        return this.name == that.name
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
    operators: BiMap<TokenKind, string, [HexType, Pattern[]]> = new BiMap<TokenKind, string, [HexType, Pattern[]]>([
        [[TokenKind.PLUS, "number"], [this, [Patterns.Add]]],
        [[TokenKind.DASH, "number"], [this, [Patterns.Subtract]]],
        [[TokenKind.ASTERISK, "number"], [this, [Patterns.Multipy]]],
        [[TokenKind.SLASH, "number"], [this, [Patterns.Divide]]],
        [[TokenKind.DOUBLEASTERISK, "number"], [this, [Patterns.Power]]],
        [[TokenKind.EQUALITY, "number"], [this, [Patterns.Equality]]],
        [[TokenKind.INEQUALITY, "number"], [this, [Patterns.Inequality]]],
        [[TokenKind.GREATERTHAN, "number"], [this, [Patterns.GreaterThan]]],
        [[TokenKind.GREATEROREQUAL, "number"], [this, [Patterns.GreaterOrEqual]]],
        [[TokenKind.LESSTHAN, "number"], [this, [Patterns.LessThan]]],
        [[TokenKind.LESSOREQUAL, "number"], [this, [Patterns.LessOrEqual]]]
    ])
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
    fields = new Map<string, BoundExpression>([
        ["x", new HardcodedExpr(HexNumber, [Patterns.SplitVector, Patterns.Bookkeepers("-vv")])],
        ["y", new HardcodedExpr(HexNumber, [Patterns.SplitVector, Patterns.Bookkeepers("v-v")])],
        ["z", new HardcodedExpr(HexNumber, [Patterns.SplitVector, Patterns.Bookkeepers("vv-")])],
    ])
    canCastFrom(that: HexType): boolean {
        return that == HexVector
    }
}
export const HexVector = new _HexVector
class _HexEntity extends Primitive {
    name = "Entity"
    fields: Map<string, HardcodedExpr> = new Map([
        ["eyepos", new HardcodedExpr(HexVector, [Patterns.EyePos])],
        ["lookdir", new HardcodedExpr(HexVector, [Patterns.LookDir])],
    ])
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
            return that.types.map((x) => !!this.types.find(y => x.name == y.name)).reduce((p,c)=> p || c)
        } else {
            return !!this.types.find(x => x.name == that.name)
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
    return undefined
}

export class Class extends Executable {

    constructor(
        public name: string,
        public symbols: Map<string, BoundExpression>,
        public fields: Map<string, BoundExpression>,
        public properties: Map<string, HexType>
    ) {
        super()
        // If constructor is not defined, then 
        if (!symbols.has("constructor") && !fields.has("constructor")) {
            let internalSize = this.fields.size + this.properties.size
            let hex = internalSize == 0 ? [Patterns.EmptyList] : 1 ? [Patterns.Null, Patterns.SingleList] : [Patterns.Null, Patterns.Integer(internalSize), Patterns.DuplicateNTimes, Patterns.Integer(internalSize), Patterns.MakeList]
            symbols.set("constructor", new HardcodedExpr(new NativeFunction([], new ClassInstance(this)), hex, 1))
        }
        let constr = this.getConstructor()!
        if (!(constr.type instanceof Executable)) throw new CodeError("Somehow have a constructor with a non-executable type?")
        if (!(constr.type.returnType instanceof ClassInstance)) throw new CodeError(`${this.name}'s constructor does not return a class instance.`)
        
        let size = fields.size
        let i = 0
        for (let name of properties.keys()) {
            fields.set(name, new HardcodedExpr(properties.get(name)!, [Patterns.Integer(size + i), Patterns.AccessList]))
            i++
        }
    }
    getConstructor() {return (this.symbols.get("constructor") || this.fields.get("constructor"))}
    get paramTypes() { return (this.getConstructor()?.type as Executable)?.paramTypes}
    get returnType() { return (this.getConstructor()?.type as Executable)?.returnType}
    canCastFrom(that: HexType): boolean {
        return false
    }
}
export class ClassInstance extends HexType {
    name: string;
    constructor(
        public parent: Class,
    ) {
        super()
        this.name = "I" + parent.name
    }
    canCastFrom(that: HexType): boolean {
        return this.name == that.name
    }
    getFieldType(property: string): HexType | undefined {
        return this.parent.getFieldType(property)
    }
    getFieldHex(compiler: Compiler, getter: Pattern[], property: string): Pattern[] | undefined {
        return this.parent.getFieldHex(compiler, getter, property)
    }
    setFieldHex(compiler: Compiler, getter: Pattern[], property: string, value: Pattern[]): Pattern[] {
        let pos = positionInIterator(property, this.parent.fields.keys())
        if (pos == undefined) throw new CodeError(`Property ${property} doesnt seem to exist in fields of ${this.name}`)
        return [
            getter,
            Patterns.Integer(pos),
            value,
            Patterns.SetList
        ].flat()
    }
    getSymbolType(property: string): HexType | undefined {
        return this.parent.getSymbolType(property)
    }
    getSymbolHex(compiler: Compiler, property: string): Pattern[] | undefined {
        return this.parent.getSymbolHex(compiler, property)
    }
    // setSymbolHex(compiler: Compiler, property: string, value: Pattern[]): Pattern[] {
    //     return this.parent.setSymbolHex(compiler, property, value)
    // }
}



