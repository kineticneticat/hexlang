import { Compiler } from "../compiler/Compiler"
import { Pattern } from "../compiler/Hex/Hex"
import { Patterns } from "../compiler/Hex/Patterns"
import { Builtins } from "../compiler/types/Builtins"
import { Class, ClassInstance, Closure, Native, HexAny, HexNumber, HexString, HexType, HexUndefined, HexVoid, List, OptionsType, Executable, HexBoolean } from "../compiler/types/Types"
import { Token, TokenKind } from "../lexer/Token"
import { CodeError } from "../Util"
import { areBinOpArgsValid, BindingPower, getBP, getLED, getNUD, getTokenPattern } from "./LUT"
import { Parser } from "./Parser"
import { ExpressionStmt } from "./Statements"

function blank( func: () => void) {
    func()
    return []
}

export interface Expression {
    type: HexType
    compile(compiler: Compiler): Pattern[]
}

export class NumberLiteralExpr implements Expression {
    value: number
    type = HexNumber
    constructor(value: string) {
        this.value = parseFloat(value)
    }
    compile(compiler: Compiler): Pattern[] {
        compiler.workingStackSize++
        return [Patterns.Number(this.value)]
    }
}
export class StringLiteralExpr implements Expression {
    type = HexString
    constructor(
        public value: string
    ) {}
    compile(compiler: Compiler): Pattern[] {
        compiler.workingStackSize++
        return [Patterns.NYI]
    }
}
export class BooleanLiteralExpr implements Expression {
    type = HexBoolean
    constructor(
        public value: boolean
    ) {}
    compile(compiler: Compiler): Pattern[] {
        compiler.workingStackSize++
        return [this.value? Patterns.True : Patterns.False]
    }
}
export class SymbolExpr implements Expression {
    constructor(
        public name: string,
        public type: HexType
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return this.type.getAccessHex(compiler, this.name)
    }
}
export class UndefinedExpr implements Expression {
    type = HexUndefined
    compile(compiler: Compiler): Pattern[] {
        compiler.workingStackSize++
        return [Patterns.Null]
    }
}

export class BinaryExpression implements Expression {
    constructor(
        public left: Expression,
        public operation: TokenKind,
        public right: Expression,
        public type: HexType
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return [
            this.left.compile(compiler),
            this.right.compile(compiler),
            getTokenPattern(this.operation),
            blank( () => compiler.workingStackSize--),
        ].flat()
    }
}

export class AssignmentExpr implements Expression {
    type = HexUndefined
    constructor(
        public assignee: Expression,
        public value: Expression
    ) {}
    compile(compiler: Compiler): Pattern[] {
        if (this.assignee instanceof SymbolExpr) {
            return compiler.setVariable(this.assignee.name, this.value.type, this.value.compile(compiler))
        } else if (this.assignee instanceof MemberExpr) {
            return this.assignee.parent.type.setFieldHex(compiler, this.assignee.compile(compiler), this.assignee.prop, this.value.compile(compiler))
        }
        throw new CodeError(`Tried to assign to non symbol/member ${this.assignee.type.name}`)
    }
}

export class MemberExpr implements Expression {
    constructor(
        public parent: Expression,
        public prop: string,
        public type: HexType
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return this.parent.type.getStaticHex(compiler, this.parent, this.prop)
    }
}

export class CallExpr implements Expression {
    constructor(
        public method: Expression,
        public args: Expression[],
        public type: HexType, // return type
    ) {}
    compile(compiler: Compiler): Pattern[] {
        if (this.method.type instanceof Class) {
            return new CallExpr(this.method.type.getConstructor(), this.args, this.type).compile(compiler)
        }
        if (this.method.type instanceof Native) {
            return [
                this.args.map(x => x.compile(compiler)).flat(),
                this.method.compile(compiler)
            ].flat()
        }
        if (!(this.method.type instanceof Closure)) throw new CodeError("Tried to execute non-executable")
        if (this.method.type.leftovers == undefined) throw new CodeError("Somehow tried executing a Closure with no defined leftovers")
        return [
            this.args.map(x => x.compile(compiler)).flat(),
            this.method.compile(compiler),
            Patterns.Splat,
            Patterns.ExecuteCont,
            this.method.type.returnType == HexVoid ? Patterns.Bookkeepers("v".repeat(this.method.type.leftovers+1)) : Patterns.Bookkeepers("v".repeat(this.method.type.leftovers+1-1) + "-"),
        ].flat()
    }
}

export class ArrayExpr implements Expression {
    constructor(
        public contents: Expression[],
        public type: List
    ) {}
    compile(compiler: Compiler): Pattern[] {
        let length = this.contents.length
        let hex =  this.contents.map(x => x.compile(compiler)).flat().concat(Patterns.Number(length), Patterns.MakeList)
        compiler.workingStackSize -= length-1
        return hex
    }
}

export function parseExpr(parser: Parser, bindingPower: BindingPower=BindingPower.DEFAULT): Expression {
    let nud = getNUD(parser.current)
    let left = nud(parser)
    while (getBP(parser.current) > bindingPower) {
        let led = getLED(parser.current)
        left = led(parser, left, bindingPower)
    }
    return left
}

export function parsePrimaryExpr(parser: Parser) {
    switch (parser.current.kind) {
        case TokenKind.NUMBERLITERAL:
            return new NumberLiteralExpr(parser.advance().data)
        case TokenKind.STRINGLITERAL:
            return new StringLiteralExpr(parser.advance().data)
        case TokenKind.SYMBOL:
            let name = parser.current.data
            let type = parser.variables.find(x => x.name == name)?.type
            if (type == undefined) {
                if (!Builtins.has(name)) throw parser.current.source.Error(`Variable ${name} is undefined`)
                type = Builtins.get(name)?.type as HexType
            }
            parser.advance()
            return new SymbolExpr(name, type)
        case TokenKind.TRUE:
            return new BooleanLiteralExpr(true)
        case TokenKind.FALSE:
            return new BooleanLiteralExpr(false)
        default:
            throw parser.current.source.Error(`Tried to parse ${TokenKind[parser.current.kind]} as a primary.`)
    }
}

export function parseBinaryExpr(parser: Parser, left: Expression, bp: BindingPower) {
    let op = parser.advance()
    let right = parseExpr(parser, getBP(op))
    let type = areBinOpArgsValid(left.type, right.type, op.kind)
    if (type == null) throw op.source.Error(`Types ${left.type.name} and ${right.type.name} cannot be combined with BinOp ${TokenKind[op.kind]}`)
    return new BinaryExpression(left, op.kind, right, type as HexType)
}

export function parseGroupingExpr(parser: Parser) {
    parser.expect(TokenKind.OPENBRACKET)
    let expr = parseExpr(parser, BindingPower.DEFAULT)
    parser.expect(TokenKind.CLOSEBRACKET)
    return expr
}

export function parseAssignmentExpr(parser: Parser, left: Expression, bp: BindingPower) {
    if (!(left instanceof SymbolExpr || left instanceof MemberExpr)) throw parser.current.source.Error(`Cannot assign to non symbol/member`)
    if (left instanceof SymbolExpr && !parser.variables.find(x => x.name = left.name)?.mutablility) throw parser.current.source.Error(`Cant assign to constant ${left.name}`)
    parser.expect(TokenKind.EQUALS)
    let right = parseExpr(parser, bp)
    if (!left.type.canCastFrom(right.type)) throw parser.current.source.Error(`Cannot assign ${right.type.name} to var of type ${left.type.name}`)
    return new AssignmentExpr(
        left,
        right
    )
}

export function parseMemberExpr(parser: Parser, left: Expression, bp: BindingPower) {
    parser.expect(TokenKind.DOT)
    let member = parser.expect(TokenKind.SYMBOL).data
    return new MemberExpr(
        left,
        member,
        left.type.getStaticType(member)
    )
}

export function parseCallExpr(parser: Parser, left: Expression, bp: BindingPower) {
    if (!(left.type instanceof Executable)) throw parser.current.source.Error(`Cannot execute value of type ${left.type.name}`)
    parser.expect(TokenKind.OPENBRACKET)
    let args = [] as Expression[]
    while (parser.hasTokens && parser.current.kind != TokenKind.CLOSEBRACKET) {
        args.push(parseExpr(parser, BindingPower.ASSIGNMENT))
        if (parser.current.kind != TokenKind.EOF && (parser.current.kind as TokenKind) != TokenKind.CLOSEBRACKET) {
            parser.expect(TokenKind.COMMA)
        }
    }
    let params = left.type.paramTypes
    if (params.length > args.length) throw parser.current.source.Error(`Too few arguments for ${left.type.name}`)
    if (params.length < args.length) throw parser.current.source.Error(`Too many arguments for ${left.type.name}`)
    for (let i in params) {
        let I = parseInt(i)
        if (!params[I].canCastFrom(args[I].type)) throw parser.current.source.Error(`Cannot cast ${args[I].type.name} to ${params[I].name} (arg ${I})`)
    }
    parser.expect(TokenKind.CLOSEBRACKET)
    return new CallExpr(
        left,
        args,
        left.type.returnType
    )
}

export function parseArrayExpr(parser: Parser) {
    parser.expect(TokenKind.OPENSQUARE)
    let contents = [] as Expression[]
    while (parser.hasTokens && parser.current.kind != TokenKind.CLOSESQUARE) {
        contents.push(parseExpr(parser, BindingPower.LOGICAL))
        if (parser.current.kind != TokenKind.EOF && (parser.current.kind as TokenKind) != TokenKind.CLOSESQUARE) {
            parser.expect(TokenKind.COMMA)
        }
    }
    parser.expect(TokenKind.CLOSESQUARE)
    let options = new OptionsType(...contents.map(x => x.type))
    let type = new List(options.types.length == 0 ? HexAny : (options.types.length == 1 ? options.types[0] : options))
    return new ArrayExpr(contents, type)
}