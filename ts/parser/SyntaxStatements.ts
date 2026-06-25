import { Token, TokenKind } from "../lexer/Token";
import { ArrayExpr, AssignmentExpr, BinaryExpression, CallExpr, SyntaxExpression, MemberExpr, NumberLiteralExpr, parseExpr, StringLiteralExpr, SymbolExpr, UndefinedExpr } from "./SyntaxExpressions";
import { Parser } from "./Parser";
import { BindingPower, StatementHandler, StatementHandlers } from "./LUT";
import { Pattern } from "../compiler/Hex/Hex";
import { Compiler, Frame, LockedVariable } from "../compiler/Compiler";
import { Closure, HexAny, HexType, HexUndefined, HexVoid, List, Native, OptionsType } from "../compiler/types/Types";
import { parseType } from "../compiler/types/ParseType";
import { parseName, Patterns } from "../compiler/Hex/Patterns";
import { validateHeaderName, validateHeaderValue } from "node:http";

export interface SyntaxStatement {
}

export class BlockStmt implements SyntaxStatement {
    constructor(
        public statements: SyntaxStatement[]
    ) {}
}
export class ExpressionStmt implements SyntaxStatement {
    constructor(
        public expr: SyntaxExpression
    ) {}
}

export class DeclarationStmt implements SyntaxStatement {
    constructor(
        public varName: string,
        public mutable: boolean,
        public value: SyntaxExpression,
        public explicitType?: HexType
    ) {}
}

type elif = {condition: SyntaxExpression, block: BlockStmt}
export class IfStatement implements SyntaxStatement {
    constructor(
        public condition: SyntaxExpression,
        public ifblock: BlockStmt,
        public elifs?: elif[],
        public elseblock?: BlockStmt
    ) {}
}

export class ForStatement implements SyntaxStatement {
    constructor(
        public variable: string,
        public range: SyntaxExpression,
        public block: BlockStmt
    ) {}
}

export class WhileStatement implements SyntaxStatement {
    constructor(
        public condition: SyntaxExpression,
        public block: BlockStmt
    ) {}
}

export class FunctionStatement implements SyntaxStatement {
    constructor(
        public name: string,
        public args: {name: string, explicitType: HexType}[],
        public explicitReturnType: HexType,
        public body: BlockStmt,
    ) {}
}

export class ReturnStatement implements SyntaxStatement {
    constructor(
        public value? : SyntaxExpression
    ) {}
}

export class NativeStmt implements SyntaxStatement {
    constructor(
        public name: string,
        public args: {name: string, explicitType: HexType}[],
        public explicitReturnType: HexType,
        public body: Pattern[],
    ) {}
}

export class ClassStatement implements SyntaxStatement {
    constructor(
        public name: string
    ) {}
}

export function parseStmt(parser: Parser): SyntaxStatement {
    if (StatementHandlers.has(parser.current.kind)) {
        return (StatementHandlers.get(parser.current.kind) as StatementHandler)(parser)
    }
    let exprstmt = parseExprStmt(parser)
    parser.expect(TokenKind.SEMICOLON)
    return exprstmt
}

function parseExprStmt(parser: Parser) {
    let expr = parseExpr(parser, BindingPower.DEFAULT)
    return new ExpressionStmt(expr)
}

function parseBlockStmt(parser: Parser) {
    parser.expect(TokenKind.OPENCURLY)
    let stmts = [] as SyntaxStatement[]
    while (parser.hasTokens && parser.current.kind != TokenKind.CLOSECURLY) {
        stmts.push(parseStmt(parser))
    }
    parser.expect(TokenKind.CLOSECURLY)
    return new BlockStmt(stmts)
}

export function parseDeclStmt(parser: Parser) {
    let mutability = parser.advance().kind == TokenKind.LET
    let name = parser.expect(TokenKind.SYMBOL).data
    let type: HexType | undefined = undefined
    if (parser.current.kind == TokenKind.COLON) {
        parser.advance()
        type = parseType(parser)
    }
    let value: SyntaxExpression | undefined = undefined
    if (parser.current.kind != TokenKind.SEMICOLON) {
        parser.expect(TokenKind.EQUALS)
        value = parseExpr(parser)
    }
    if (value == undefined && type == undefined) {
        parser.current.source.Error("Tried to define a variable without a type nor value!")
    }
    if (value == undefined && type != undefined) {
        value = new UndefinedExpr()
        type = new OptionsType(type, HexUndefined)
    }
    parser.expect(TokenKind.SEMICOLON)
    return new DeclarationStmt(name, mutability, value as SyntaxExpression, type)
}

export function parseIfStmt(parser: Parser) {
    parser.expect(TokenKind.IF)
    parser.expect(TokenKind.OPENBRACKET)
    let condition = parseExpr(parser, BindingPower.DEFAULT)
    parser.expect(TokenKind.CLOSEBRACKET)
    let ifblock = parseBlockStmt(parser)
    if (parser.current.kind != TokenKind.ELIF && parser.current.kind != TokenKind.ELSE) {
        return new IfStatement(condition, ifblock)
    }
    let elifs = [] as elif[]
    while (parser.current.kind == TokenKind.ELIF) {
        parser.expect(TokenKind.ELIF)
        parser.expect(TokenKind.OPENBRACKET)
        let elifcond = parseExpr(parser, BindingPower.DEFAULT)
        parser.expect(TokenKind.CLOSEBRACKET)
        let elifblock = parseBlockStmt(parser)
        elifs.push({
            condition: elifcond,
            block: elifblock
        })
    }

    if (parser.current.kind == TokenKind.ELSE) {
        parser.expect(TokenKind.ELSE)
        let elseblock = parseBlockStmt(parser)
        return new IfStatement(condition, ifblock, elifs, elseblock)
    }
    return new IfStatement(condition, ifblock, elifs)
}

export function parseForStmt(parser: Parser) {
    parser.expect(TokenKind.FOR)
    parser.expect(TokenKind.OPENBRACKET)
    let name = parser.expect(TokenKind.SYMBOL).data
    parser.expect(TokenKind.IN)
    let range = parseExpr(parser, BindingPower.DEFAULT)
    parser.expect(TokenKind.CLOSEBRACKET)
    let block = parseBlockStmt(parser)
    return new ForStatement(name, range, block)
}

export function parseWhileStmt(parser: Parser) {
    parser.expect(TokenKind.WHILE)
    parser.expect(TokenKind.OPENBRACKET)
    let cond = parseExpr(parser, BindingPower.DEFAULT)
    parser.expect(TokenKind.CLOSEBRACKET)
    let block = parseBlockStmt(parser)
    return new WhileStatement(cond, block)
}

export function parseFunctionStmt(parser: Parser) {
    parser.expect(TokenKind.FUNCTION)
    let name = parser.expect(TokenKind.SYMBOL).data
    parser.expect(TokenKind.OPENBRACKET)
    let args = [] as {name: string, explicitType: HexType}[]
    while (parser.hasTokens && parser.current.kind != TokenKind.CLOSEBRACKET) {
        let name = parser.expect(TokenKind.SYMBOL).data
        parser.expect(TokenKind.COLON)
        let type = parseType(parser)
        args.push({name: name, explicitType: type})
        if (parser.current.kind != TokenKind.EOF && (parser.current.kind as TokenKind) != TokenKind.CLOSEBRACKET) {
            parser.expect(TokenKind.COMMA)
        }
    }
    parser.expect(TokenKind.CLOSEBRACKET)
    parser.expect(TokenKind.COLON)
    let returntype = parseType(parser)
    let body = parseBlockStmt(parser)
    return new FunctionStatement(name, args, returntype, body)
}

export function parseReturnStmt(parser: Parser) {
    parser.expect(TokenKind.RETURN)
    if (parser.current.kind == TokenKind.SEMICOLON) {
        return new ReturnStatement()
    } else {
        let value = parseExpr(parser, BindingPower.DEFAULT)
        parser.expect(TokenKind.SEMICOLON)
        return new ReturnStatement(value)
    }
}

export function parseNativeStmt(parser: Parser) {
    parser.expect(TokenKind.NATIVE)
    let name = parser.expect(TokenKind.SYMBOL).data
    
    parser.expect(TokenKind.OPENBRACKET)
    let args = [] as {name: string, explicitType: HexType}[]
    while (parser.hasTokens && parser.current.kind != TokenKind.CLOSEBRACKET) {
        let name = parser.expect(TokenKind.SYMBOL).data
        parser.expect(TokenKind.COLON)
        let type = parseType(parser)
        args.push({name: name, explicitType: type})
        if (parser.current.kind != TokenKind.EOF && (parser.current.kind as TokenKind) != TokenKind.CLOSEBRACKET) {
            parser.expect(TokenKind.COMMA)
        }
    }
    parser.expect(TokenKind.CLOSEBRACKET)
    parser.expect(TokenKind.COLON)
    let returntype = parseType(parser)

    parser.expect(TokenKind.OPENCURLY)
    let body = [] as Pattern[]
    loop: while (parser.hasTokens) {
        let current = ""
        while (parser.hasTokens && parser.current.kind == TokenKind.SYMBOL) {
            current += parser.expect(TokenKind.SYMBOL).data  + " "
        }
        body.push(parseName(current.trim()))
        parser.expect(TokenKind.SEMICOLON)
        if (parser.current.kind == TokenKind.CLOSECURLY) break loop
    }
    parser.expect(TokenKind.CLOSECURLY)
    return new NativeStmt(name, args, returntype, body)
}

export function parseClassStmt(parser: Parser) {
    parser.expect(TokenKind.CLASS)
    let name = parser.expect(TokenKind.SYMBOL).data
    parser.expect(TokenKind.OPENCURLY)
    let properties = new Map<string, HexType>()
    while (parser.hasTokens && parser.current.kind != TokenKind.CLOSECURLY) {
        let name = parser.expect(TokenKind.SYMBOL).data
        parser.expect(TokenKind.COLON)
        let type = parseType(parser)
        properties.set(name, type)
        if (parser.current.kind != TokenKind.EOF && (parser.current.kind as TokenKind) != TokenKind.CLOSECURLY) {
            parser.expect(TokenKind.SEMICOLON)
        }
    }
    parser.expect(TokenKind.CLOSECURLY)
    return new ClassStatement(name)
}