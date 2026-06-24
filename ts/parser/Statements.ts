import { Token, TokenKind } from "../lexer/Token";
import { ArrayExpr, AssignmentExpr, BinaryExpression, CallExpr, Expression, MemberExpr, NumberLiteralExpr, parseExpr, StringLiteralExpr, SymbolExpr, UndefinedExpr } from "./Expressions";
import { Parser } from "./Parser";
import { BindingPower, StatementHandler, StatementHandlers } from "./LUT";
import { Pattern } from "../compiler/Hex/Hex";
import { Compiler, Frame, LockedVariable } from "../compiler/Compiler";
import { Class, Closure, HexAny, HexType, HexUndefined, HexVoid, List, Native, OptionsType } from "../compiler/types/Types";
import { parseType } from "../compiler/types/ParseType";
import { parseName, Patterns } from "../compiler/Hex/Patterns";
import { validateHeaderName, validateHeaderValue } from "node:http";

export interface Statement {
    compile(compiler: Compiler): Pattern[]
}

export class BlockStmt implements Statement {
    constructor(
        public statements: Statement[]
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return this.statements.map(x=>x.compile(compiler)).flat()
    }
}
export class ExpressionStmt implements Statement {
    constructor(
        public expr: Expression
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return this.expr.compile(compiler)
    }
}

export class DeclarationStmt implements Statement {
    constructor(
        public varName: string,
        public mutable: boolean,
        public value: Expression,
        public type: HexType
    ) {}
    compile(compiler: Compiler): Pattern[] {
        // console.log(this.value)
        return compiler.declareVariable(this.varName, this.type, this.mutable, this.value.compile(compiler))
    }
}

type elif = {condition: Expression, block: BlockStmt}
function constructElif(compiler: Compiler, remaining: elif[], elseblock: BlockStmt): Pattern[] {
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
export class IfStatement implements Statement {
    constructor(
        public condition: Expression,
        public ifblock: BlockStmt,
        public elifs?: elif[],
        public elseblock?: BlockStmt
    ) {}
    compile(compiler: Compiler): Pattern[] {
        let aaa = (compiler: Compiler) => {
            if (this.elifs == undefined && this.elseblock == undefined) return [Patterns.EmptyList]
            else if (this.elifs == undefined) return this.elseblock?.compile(compiler) as Pattern[]
            else return constructElif(compiler, this.elifs, this.elseblock as BlockStmt)
        }
        
        let hex = [
            this.condition.compile(compiler),
            Patterns.Open,
            this.ifblock.compile(compiler),
            Patterns.Close,
            aaa(compiler),
            Patterns.Switch,
            Patterns.Execute
        ].flat()
        return hex
    }
}

export class ForStatement implements Statement {
    constructor(
        public variable: string,
        public range: Expression,
        public block: BlockStmt
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return []
    }
}

export class WhileStatement implements Statement {
    constructor(
        public condition: Expression,
        public block: BlockStmt
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return []
    }
}

export class FunctionStatement implements Statement {
    constructor(
        public name: string,
        public args: LockedVariable[],
        public type: Closure,
        public body: BlockStmt,
        public capturedSymbols: LockedVariable[]
    ) {}
    compile(compiler: Compiler): Pattern[] {
        compiler.pushFrame(
            this.capturedSymbols,
            this.args
        )
        let body = this.body.compile(compiler)
        let frame = compiler.popFrame() as Frame
        this.type.leftovers = frame.totalVariableSize
        let hex = [
            compiler.declareVariable(this.name, this.type, true, [
                this.capturedSymbols.map( x => compiler.getVariable(x.name)).flat(),
                Patterns.Open,
                Patterns.Number(-(this.capturedSymbols.length + this.args.length)),
                Patterns.PushFromStack,
                body,
                // this.type.returntype == HexVoid ? Patterns.Bookkeepers("v".repeat(frame.totalVariableSize+1)) : Patterns.Bookkeepers("v".repeat(frame.totalVariableSize+1-1) + "-"),
                Patterns.Close,
                (() => { compiler.workingStackSize++; return []})(),
                Patterns.Number(1+this.capturedSymbols.length),
                Patterns.MakeList,
                (() => {compiler.workingStackSize -= 1+this.capturedSymbols.length; return []})()
            ].flat()),
        ].flat()
        return hex
    }
}

export class ReturnStatement implements Statement {
    constructor(
        public value? : Expression
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return [
            this.value != undefined ? this.value.compile(compiler) : [],
            Patterns.Number(compiler.currentFrame.totalVariableSize),
            Patterns.CopyFromStack,
            Patterns.Execute
        ].flat()
    }
}

export class NativeStmt implements Statement {
    constructor(
        public name: string,
        // public args: {name: string, type: HexType}[],
        public type: Native,
        public body: Pattern[],
    ) {}
    compile(compiler: Compiler): Pattern[] {
        
        return compiler.declareVariable(this.name, this.type, false, this.body)
    }
}

export class ClassStatement implements Statement {
    constructor(
        type: Class
    ) {}
    compile(compiler: Compiler): Pattern[] {
        return []
    }
}

export function parseStmt(parser: Parser): Statement {
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
    let stmts = [] as Statement[]
    while (parser.hasTokens && parser.current.kind != TokenKind.CLOSECURLY) {
        stmts.push(parseStmt(parser))
    }
    parser.expect(TokenKind.CLOSECURLY)
    return new BlockStmt(stmts)
}

export function parseDeclStmt(parser: Parser) {
    let mutability = parser.advance().kind == TokenKind.LET
    let name = parser.expect(TokenKind.SYMBOL).data
    if (parser.variables.find(x => x.name == name) != undefined) throw parser.prev.source.Error(`Cannot redefine variable ${name}`)
    let type: HexType | undefined = undefined
    if (parser.current.kind == TokenKind.COLON) {
        parser.advance()
        type = parseType(parser)
    }
    let value: Expression | undefined = undefined
    if (parser.current.kind != TokenKind.SEMICOLON) {
        parser.expect(TokenKind.EQUALS)
        value = parseExpr(parser)
    }
    if (value == undefined && type == undefined) {
        parser.current.source.Error("Tried to define a variable without a type nor value!")
    }
    if (value != undefined &&type == undefined) {
        type = value.type
    }
    if (value == undefined && type != undefined) {
        value = new UndefinedExpr()
        type = new OptionsType(type, HexUndefined)
    }
    parser.expect(TokenKind.SEMICOLON)
    parser.frameStack[parser.frameStack.length-1].variables.push({name: name, type: type as HexType, mutablility: mutability})
    return new DeclarationStmt(name, mutability, value as Expression, type as HexType)
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
    if (parser.variables.find(x => x.name == name) != undefined) throw parser.prev.source.Error(`Cannot redefine variable ${name}`)
    parser.expect(TokenKind.IN)
    let range = parseExpr(parser, BindingPower.DEFAULT)
    if (!(new List(HexAny)).canCastFrom(range.type)) throw parser.prev.source.Error(`Cannot iterate over non-list ${range.type.name}`)
    parser.frameStack[parser.frameStack.length-1].variables.push({name: name, type: (range.type as List).type, mutablility: false})
    parser.expect(TokenKind.CLOSEBRACKET)
    let block = parseBlockStmt(parser)
    parser.frameStack[parser.frameStack.length-1].variables = parser.variables.filter(x => x.name != name)
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
    parser.checkRedef(name, parser.prev)
    
    parser.expect(TokenKind.OPENBRACKET)
    let args = [] as LockedVariable[]
    while (parser.hasTokens && parser.current.kind != TokenKind.CLOSEBRACKET) {
        let name = parser.expect(TokenKind.SYMBOL).data
        if (parser.variables.find(x => x.name == name) != undefined) throw parser.prev.source.Error(`Cannot shadow variable ${name}`)
        parser.expect(TokenKind.COLON)
        let type = parseType(parser)
        args.push(new LockedVariable(name, type))
        if (parser.current.kind != TokenKind.EOF && (parser.current.kind as TokenKind) != TokenKind.CLOSEBRACKET) {
            parser.expect(TokenKind.COMMA)
        }
    }
    parser.expect(TokenKind.CLOSEBRACKET)
    parser.expect(TokenKind.COLON)
    let returntype = parseType(parser)
    let closure = new Closure(args.map(x => x.type), returntype)
    parser.pushFrame()
    args.forEach(x => parser.frameStack[parser.frameStack.length-1].variables.push({name: x.name, type: x.type, mutablility: false}))
    let body = parseBlockStmt(parser)
    parser.popFrame()
    let captures = searchStmtSymbols(body).filter(x => parser.variables.find(y => x.name == y.name) != undefined).map(x => new LockedVariable(x.name, x.type))
    parser.frameStack[parser.frameStack.length-1].variables.push({name: name, type: closure, mutablility: true})
    parser.frameStack[parser.frameStack.length-1].variables = parser.variables.filter(x => args.find(y => x.name == y.name) == undefined)
    return new FunctionStatement(name, args, closure, body, captures)
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
    parser.checkRedef(name, parser.prev)
    
    parser.expect(TokenKind.OPENBRACKET)
    let args = [] as {name: string, type: HexType}[]
    while (parser.hasTokens && parser.current.kind != TokenKind.CLOSEBRACKET) {
        let name = parser.expect(TokenKind.SYMBOL).data
        if (parser.variables.find(x => x.name == name) != undefined) throw parser.prev.source.Error(`Cannot shadow variable ${name}`)
        parser.expect(TokenKind.COLON)
        let type = parseType(parser)
        args.push({name: name, type: type})
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
    let native = new Native(args.map(x=>x.type), returntype)
    parser.frameStack[parser.frameStack.length-1].variables.push({name: name, type: native, mutablility: false})
    return new NativeStmt(name, native, body )
}

export function parseClassStmt(parser: Parser) {
    parser.expect(TokenKind.CLASS)
    let name = parser.expect(TokenKind.SYMBOL).data
    if (parser.variables.find(x => x.name == name) != undefined) throw parser.prev.source.Error(`Cannot redefine variable ${name}`)
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
    let type = new Class(name, new Map(), new Map())
    parser.frameStack[parser.frameStack.length-1].variables.push({name: name, type: type, mutablility:false})
    return new ClassStatement(type)
}

export function searchStmtSymbols(stmt: Statement): {name: string, type: HexType}[] {
    if (stmt instanceof BlockStmt) {
        return unique(stmt.statements.map(searchStmtSymbols).flat())
    } else if (stmt instanceof ExpressionStmt) {
        return searchExprSymbols(stmt.expr)
    } else if (stmt instanceof DeclarationStmt) {
        return unique([
            {name: stmt.varName, type: stmt.type},
            searchExprSymbols(stmt.value)
        ].flat())
    } else if (stmt instanceof IfStatement) {
        let out = [searchExprSymbols(stmt.condition), searchStmtSymbols(stmt.ifblock)].flat()
        if (stmt.elifs != undefined) out = out.concat(stmt.elifs.map(elif => [searchExprSymbols(elif.condition), searchStmtSymbols(elif.block)].flat()).flat())
        if (stmt.elseblock != undefined) out = out.concat(searchStmtSymbols(stmt.elseblock))
        return unique(out)
    } else if (stmt instanceof ForStatement) {
        return unique([
            searchExprSymbols(stmt.range),
            searchStmtSymbols(stmt.block)
        ].flat())
    } else if (stmt instanceof WhileStatement) {
        return unique([
            searchExprSymbols(stmt.condition),
            searchStmtSymbols(stmt.block)
        ].flat())
    } else if (stmt instanceof FunctionStatement) {
        return unique([
            {name: stmt.name, type: stmt.type},
            searchStmtSymbols(stmt.body)
        ].flat())
    } else return []
}
function searchExprSymbols(expr: Expression): {name: string, type: HexType}[] {
    if (expr instanceof SymbolExpr) {
        return [{name: expr.name, type: expr.type}]
    } else if (expr instanceof BinaryExpression) {
        return unique([
            searchExprSymbols(expr.left),
            searchExprSymbols(expr.right)
        ].flat())
    } else if (expr instanceof AssignmentExpr) {
        return unique([
            searchExprSymbols(expr.assignee),
            searchExprSymbols(expr.value)
        ].flat())
    }  else if (expr instanceof MemberExpr) {
        return searchExprSymbols(expr.parent)
    } else if (expr instanceof CallExpr) {
        return unique([
            searchExprSymbols(expr.method),
            expr.args.map(searchExprSymbols).flat()
        ].flat())
    } else if (expr instanceof ArrayExpr) {
        return unique(expr.contents.map(searchExprSymbols).flat())
    } else return []
}

function unique(arr: {name: string, type: HexType}[]): {name: string, type: HexType}[] {
    return arr.filter((x, i) => arr.findIndex(y => y.name == x.name) === i)
}