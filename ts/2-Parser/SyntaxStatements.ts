import { TokenKind } from "../1-Lexer/Token"
import { Binder } from "../3-Binder/Binder"
import { BoundStatement, BoundBlock, BoundExpressionStmt, BoundDeclaration, BoundIf, BoundFor, BoundWhile, BoundFunction, BoundReturn, BoundNative, BoundClass } from "../3-Binder/BoundStatements"
import { Pattern } from "../4-Compiler/Hex/Hex"
import { parseName } from "../4-Compiler/Hex/Patterns"
import { parseType } from "../types/ParseType"
import { HexType, HexUndefined, OptionsType } from "../types/Types"
import { StatementHandlers, StatementHandler, BindingPower } from "./LUT"
import { Parser } from "./Parser"
import { SyntaxExpression, parseExpr, SyntaxUndefined } from "./SyntaxExpressions"

export interface SyntaxStatement {
    bind(binder: Binder): BoundStatement
}

export class SyntaxBlock implements SyntaxStatement {
    constructor(
        public statements: SyntaxStatement[]
    ) {}
    bind(binder: Binder): BoundBlock {
        return new BoundBlock(this.statements.map(x => x.bind(binder)))
    }
}
export class SyntaxExpressionStmt implements SyntaxStatement {
    constructor(
        public expr: SyntaxExpression
    ) {}
    bind(binder: Binder): BoundStatement {
        return new BoundExpressionStmt(this.expr.bind(binder))
    }
}

export class SyntaxDeclaration implements SyntaxStatement {
    constructor(
        public varName: string,
        public mutable: boolean,
        public value: SyntaxExpression,
        public explicitType?: HexType
    ) {}
    bind(binder: Binder): BoundStatement {
        // check variable doesnt already exist
        return new BoundDeclaration(this.varName, this.mutable, this.value.bind(binder), this.explicitType || HexUndefined)
    }
}

type elif = {condition: SyntaxExpression, block: SyntaxBlock}
export class SyntaxIf implements SyntaxStatement {
    constructor(
        public condition: SyntaxExpression,
        public ifblock: SyntaxBlock,
        public elifs: elif[],
        public elseblock?: SyntaxBlock
    ) {}
    bind(binder: Binder): BoundStatement {
        return new BoundIf(
            this.condition.bind(binder),
            this.ifblock.bind(binder),
            this.elifs.map(x=>{return {condition: x.condition.bind(binder), block: x.block.bind(binder)}}),
            this.elseblock?.bind(binder)
        )
    }
}

export class SyntaxFor implements SyntaxStatement {
    constructor(
        public variable: string,
        public range: SyntaxExpression,
        public block: SyntaxBlock
    ) {}
    bind(binder: Binder): BoundStatement {
        // check variable doesnt exist
        return new BoundFor(
            this.variable,
            this.range.bind(binder),
            this.block.bind(binder)
        )
    }
}

export class SyntaxWhile implements SyntaxStatement {
    constructor(
        public condition: SyntaxExpression,
        public block: SyntaxBlock
    ) {}
    bind(binder: Binder): BoundStatement {
        return new BoundWhile(
            this.condition.bind(binder),
            this.block.bind(binder)
        )
    }
}

export class SyntaxFunction implements SyntaxStatement {
    constructor(
        public name: string,
        public args: {name: string, explicitType: HexType}[],
        public explicitReturnType: HexType,
        public body: SyntaxBlock,
    ) {}
    bind(binder: Binder): BoundStatement {
        return new BoundFunction(
            this.name,
            this.args.length,
            this.body.bind(binder),
            [] // Find captures in syntax body
        )
    }
}

export class SyntaxReturn implements SyntaxStatement {
    constructor(
        public value? : SyntaxExpression
    ) {}
    bind(binder: Binder): BoundStatement {
        return new BoundReturn(this.value?.bind(this.bind))
    }
}

export class SyntaxNative implements SyntaxStatement {
    constructor(
        public name: string,
        public args: {name: string, explicitType: HexType}[],
        public explicitReturnType: HexType,
        public body: Pattern[],
    ) {}
    bind(binder: Binder): BoundStatement {
        return new BoundNative(
            this.name,
            this.args.length,
            this.body
        )
    }
}

export class SyntaxClass implements SyntaxStatement {
    constructor(
        public name: string
    ) {}
    bind(binder: Binder): BoundStatement {
        return new BoundClass()
    }
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
    return new SyntaxExpressionStmt(expr)
}

function parseBlockStmt(parser: Parser) {
    parser.expect(TokenKind.OPENCURLY)
    let stmts = [] as SyntaxStatement[]
    while (parser.hasTokens && parser.current.kind != TokenKind.CLOSECURLY) {
        stmts.push(parseStmt(parser))
    }
    parser.expect(TokenKind.CLOSECURLY)
    return new SyntaxBlock(stmts)
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
        value = new SyntaxUndefined()
        type = new OptionsType(type, HexUndefined)
    }
    parser.expect(TokenKind.SEMICOLON)
    return new SyntaxDeclaration(name, mutability, value as SyntaxExpression, type)
}

export function parseIfStmt(parser: Parser) {
    parser.expect(TokenKind.IF)
    parser.expect(TokenKind.OPENBRACKET)
    let condition = parseExpr(parser, BindingPower.DEFAULT)
    parser.expect(TokenKind.CLOSEBRACKET)
    let ifblock = parseBlockStmt(parser)
    if (parser.current.kind != TokenKind.ELIF && parser.current.kind != TokenKind.ELSE) {
        return new SyntaxIf(condition, ifblock, [])
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
        return new SyntaxIf(condition, ifblock, elifs, elseblock)
    }
    return new SyntaxIf(condition, ifblock, elifs)
}

export function parseForStmt(parser: Parser) {
    parser.expect(TokenKind.FOR)
    parser.expect(TokenKind.OPENBRACKET)
    let name = parser.expect(TokenKind.SYMBOL).data
    parser.expect(TokenKind.IN)
    let range = parseExpr(parser, BindingPower.DEFAULT)
    parser.expect(TokenKind.CLOSEBRACKET)
    let block = parseBlockStmt(parser)
    return new SyntaxFor(name, range, block)
}

export function parseWhileStmt(parser: Parser) {
    parser.expect(TokenKind.WHILE)
    parser.expect(TokenKind.OPENBRACKET)
    let cond = parseExpr(parser, BindingPower.DEFAULT)
    parser.expect(TokenKind.CLOSEBRACKET)
    let block = parseBlockStmt(parser)
    return new SyntaxWhile(cond, block)
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
    return new SyntaxFunction(name, args, returntype, body)
}

export function parseReturnStmt(parser: Parser) {
    parser.expect(TokenKind.RETURN)
    if (parser.current.kind == TokenKind.SEMICOLON) {
        return new SyntaxReturn()
    } else {
        let value = parseExpr(parser, BindingPower.DEFAULT)
        parser.expect(TokenKind.SEMICOLON)
        return new SyntaxReturn(value)
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
    return new SyntaxNative(name, args, returntype, body)
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
    return new SyntaxClass(name)
}