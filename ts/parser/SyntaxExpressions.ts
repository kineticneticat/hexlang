import { Compiler } from "../compiler/Compiler"
import { Pattern } from "../compiler/Hex/Hex"
import { Patterns } from "../compiler/Hex/Patterns"
// import { Builtins } from "../compiler/types/Builtins"
// import { Class, ClassInstance, Closure, Native, HexAny, HexNumber, HexString, HexType, HexUndefined, HexVoid, List, OptionsType, Executable, HexBoolean } from "../compiler/types/Types"
import { Token, TokenKind } from "../lexer/Token"
import { CodeError } from "../Util"
import { areBinOpArgsValid, BindingPower, getBP, getLED, getNUD } from "./LUT"
import { Parser } from "./Parser"
import { ExpressionStmt } from "./SyntaxStatements"

function blank( func: () => void) {
    func()
    return []
}

export interface SyntaxExpression {
}

export class NumberLiteralExpr implements SyntaxExpression {
    value: number
    constructor(value: string) {
        this.value = parseFloat(value)
    }
}
export class StringLiteralExpr implements SyntaxExpression {
    constructor(
        public value: string
    ) {}
}
export class BooleanLiteralExpr implements SyntaxExpression {
    constructor(
        public value: boolean
    ) {}
}
export class SymbolExpr implements SyntaxExpression {
    constructor(
        public name: string,
    ) {}
}
export class UndefinedExpr implements SyntaxExpression {
}

export class BinaryExpression implements SyntaxExpression {
    constructor(
        public left: SyntaxExpression,
        public operation: TokenKind,
        public right: SyntaxExpression
    ) {}
}

export class AssignmentExpr implements SyntaxExpression {
    constructor(
        public assignee: SyntaxExpression,
        public value: SyntaxExpression
    ) {}
}

export class MemberExpr implements SyntaxExpression {
    constructor(
        public parent: SyntaxExpression,
        public prop: string
    ) {}
}

export class CallExpr implements SyntaxExpression {
    constructor(
        public method: SyntaxExpression,
        public args: SyntaxExpression[]
    ) {}
}

export class ArrayExpr implements SyntaxExpression {
    constructor(
        public contents: SyntaxExpression[]
    ) {}
}

export function parseExpr(parser: Parser, bindingPower: BindingPower=BindingPower.DEFAULT): SyntaxExpression {
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
            parser.advance()
            return new SymbolExpr(name)
        case TokenKind.TRUE:
            return new BooleanLiteralExpr(true)
        case TokenKind.FALSE:
            return new BooleanLiteralExpr(false)
        default:
            throw parser.current.source.Error(`Tried to parse ${TokenKind[parser.current.kind]} as a primary.`)
    }
}

export function parseBinaryExpr(parser: Parser, left: SyntaxExpression, bp: BindingPower) {
    let op = parser.advance()
    let right = parseExpr(parser, getBP(op))
    return new BinaryExpression(left, op.kind, right)
}

export function parseGroupingExpr(parser: Parser) {
    parser.expect(TokenKind.OPENBRACKET)
    let expr = parseExpr(parser, BindingPower.DEFAULT)
    parser.expect(TokenKind.CLOSEBRACKET)
    return expr
}

export function parseAssignmentExpr(parser: Parser, left: SyntaxExpression, bp: BindingPower) {
    parser.expect(TokenKind.EQUALS)
    let right = parseExpr(parser, bp)
    return new AssignmentExpr(
        left,
        right
    )
}

export function parseMemberExpr(parser: Parser, left: SyntaxExpression, bp: BindingPower) {
    parser.expect(TokenKind.DOT)
    let member = parser.expect(TokenKind.SYMBOL).data
    return new MemberExpr(
        left,
        member
    )
}

export function parseCallExpr(parser: Parser, left: SyntaxExpression, bp: BindingPower) {
    parser.expect(TokenKind.OPENBRACKET)
    let args = [] as SyntaxExpression[]
    while (parser.hasTokens && parser.current.kind != TokenKind.CLOSEBRACKET) {
        args.push(parseExpr(parser, BindingPower.ASSIGNMENT))
        if (parser.current.kind != TokenKind.EOF && (parser.current.kind as TokenKind) != TokenKind.CLOSEBRACKET) {
            parser.expect(TokenKind.COMMA)
        }
    }
    parser.expect(TokenKind.CLOSEBRACKET)
    return new CallExpr(
        left,
        args
    )
}

export function parseArrayExpr(parser: Parser) {
    parser.expect(TokenKind.OPENSQUARE)
    let contents = [] as SyntaxExpression[]
    while (parser.hasTokens && parser.current.kind != TokenKind.CLOSESQUARE) {
        contents.push(parseExpr(parser, BindingPower.LOGICAL))
        if (parser.current.kind != TokenKind.EOF && (parser.current.kind as TokenKind) != TokenKind.CLOSESQUARE) {
            parser.expect(TokenKind.COMMA)
        }
    }
    parser.expect(TokenKind.CLOSESQUARE)
    return new ArrayExpr(contents)
}