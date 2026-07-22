import { readFileSync } from "node:fs"
import { Token, TokenKind } from "../1-Lexer/Token"
import { Binder, BinderVariable, DontDelete } from "../3-Binder/Binder"
import { BoundStatement, BoundBlock, BoundExpressionStmt, BoundIf, BoundFor, BoundWhile, BoundClosureFunction, BoundReturn, BoundNative, BoundClass, BoundMutableDec, BoundConstantDec, BoundStaticFunction, BoundExport, BoundImport } from "../3-Binder/BoundStatements"
import { ImmutableVariable } from "../4-Compiler/Compiler"
import { Pattern } from "../Hex/Hex"
import { parseName } from "../Hex/Patterns"
import { Builtins, getBuiltin } from "../types/Builtins"
import { parseType } from "../types/ParseType"
import { Class, ClosureFunction, HardcodedExpr, HexType, HexUndefined, HexVoid, List, NativeFunction, OptionsType, StaticFunction } from "../types/Types"
import { CodeRefrence } from "../Util"
import { StatementHandlers, StatementHandler, BindingPower } from "./LUT"
import { Parser } from "./Parser"
import { SyntaxExpression, parseExpr, SyntaxUndefined, findExprSymbols } from "./SyntaxExpressions"
import { Lexer } from "../1-Lexer/Lexer"
import path from "node:path"
import {BoundExpression, BoundNativeValue, BoundStaticFunctionValue } from "../3-Binder/BoundExpressions"

export interface SyntaxStatement {
    source: CodeRefrence
    bind(binder: Binder): BoundStatement
}

export interface IDeclares {
    name: string
}

export class SyntaxBlock implements SyntaxStatement {
    constructor(
        public statements: SyntaxStatement[],
        public source: CodeRefrence
    ) {}
    bind(binder: Binder): BoundBlock {
        return new BoundBlock(this.statements.map(x => x.bind(binder)), this.source)
    }
}
export class SyntaxExpressionStmt implements SyntaxStatement {
    constructor(
        public expr: SyntaxExpression,
        public source: CodeRefrence
    ) {}
    bind(binder: Binder): BoundStatement {
        return new BoundExpressionStmt(this.expr.bind(binder), this.source)
    }
}

export class SyntaxDeclaration implements SyntaxStatement, IDeclares {
    constructor(
        public name: string,
        public mutable: boolean,
        public value: SyntaxExpression,
        public source: CodeRefrence,
        public explicitType?: HexType
    ) {}
    bind(binder: Binder): BoundStatement {
        if (binder.varExists(this.name)) {
            throw this.source.Error(`Can't redefine variable ${this.name}`)
        }
        let value = this.value.bind(binder)
        if (this.explicitType && !this.explicitType.canCastFrom(value.type)) {
            throw this.source.Error(`Can't assign value of type ${value.type.name} to a variable with an explicit type ${this.explicitType.name}`)
        }
        binder.define(this.name, value.type, this.mutable, this.mutable)
        if (this.mutable) {
            return new BoundMutableDec(this.name, value, this.explicitType || value.type, this.source)
        } else {
            return new BoundConstantDec(this.name, value, this.explicitType || value.type, this.source)
        }
    }
}

type elif = {condition: SyntaxExpression, block: SyntaxBlock}
export class SyntaxIf implements SyntaxStatement {
    constructor(
        public condition: SyntaxExpression,
        public ifblock: SyntaxBlock,
        public elifs: elif[],
        public source: CodeRefrence,
        public elseblock?: SyntaxBlock
    ) {}
    bind(binder: Binder): BoundStatement {
        return new BoundIf(
            this.condition.bind(binder),
            this.ifblock.bind(binder),
            this.elifs.map(x=>{return {condition: x.condition.bind(binder), block: x.block.bind(binder)}}),
            this.source,
            this.elseblock?.bind(binder)
        )
    }
}

export class SyntaxFor implements SyntaxStatement {
    constructor(
        public variable: string,
        public range: SyntaxExpression,
        public block: SyntaxBlock,
        public source: CodeRefrence
    ) {}
    bind(binder: Binder): BoundStatement {
        if (binder.varExists(this.variable)) throw this.source.Error(`Cant redefine variable ${this.variable} in a for-loop`)
        let range = this.range.bind(binder)
        if (!(range.type instanceof List)) throw this.source.Error(`Cant iterate over non-list ${range.type.name}`)
        binder.define(this.variable, (range.type as List).type, true, true)
        return new BoundFor(
            this.variable,
            range,
            this.block.bind(binder),
            this.source
        )
    }
}

export class SyntaxWhile implements SyntaxStatement {
    constructor(
        public condition: SyntaxExpression,
        public block: SyntaxBlock,
        public source: CodeRefrence
    ) {}
    bind(binder: Binder): BoundStatement {
        return new BoundWhile(
            this.condition.bind(binder),
            this.block.bind(binder),
            this.source
        )
    }
}

export class SyntaxFunction implements SyntaxStatement, IDeclares {
    constructor(
        public name: string,
        public args: ImmutableVariable[],
        public returnType: HexType,
        public body: SyntaxBlock,
        public source: CodeRefrence
    ) {}
    bind(binder: Binder): BoundStaticFunction | BoundClosureFunction {
        binder.pushFrame(this.name, this.returnType)
        this.args.forEach(x => binder.define(x.name, x.type, false, true))
        let body = this.body.bind(binder)
        binder.popFrame()
        let ret: BoundStatement | undefined
        if ((ret = body.statements[body.statements.length-1]) instanceof BoundReturn) ret.earlyReturn = false
        let captures = findStmtSymbols(this.body)
            .filter(x => this.args.find(y => y.name == x) == undefined)
            .filter(x => getBuiltin(x) == undefined)
            .map(x=>new ImmutableVariable(x, binder.getVarType(x) as HexType))
        if (captures.length == 0) {
            binder.define(this.name, new StaticFunction(this.args.map(x=>x.type), this.returnType), false, false)
            return new BoundStaticFunction(
                this.name, this.args, body, this.returnType, this.source
            )
        } else {
            captures.forEach(x=> binder.varExists(x.name))
            binder.define(this.name, new ClosureFunction(captures, this.args.map(x=>x.type),this.returnType), false, true)
            return new BoundClosureFunction(
                this.name,
                this.args,
                body,
                captures,
                this.returnType,
                this.source
            )
        }
    }
}

export class SyntaxReturn implements SyntaxStatement {
    constructor(
        public source: CodeRefrence,
        public value? : SyntaxExpression
    ) {}
    bind(binder: Binder): BoundStatement {
        let returnType = binder.currentFrame.caller.returnType
        if (returnType == null) throw this.source.Error(`Tried to return in the global scope`)
        if (returnType == HexVoid && this.value) throw this.source.Error(`Tried to return from a void function.`)
        if (returnType != HexVoid && !this.value) throw this.source.Error(`Tried to return nothing to a function that should return ${returnType.name}`)
        if (returnType == HexVoid && !this.value) return new BoundReturn(this.source)
        let value = this.value!.bind(binder)
        if (!returnType.canCastFrom(value.type)) throw this.source.Error(`Tried to return a ${value.type.name} from a ${returnType.name}-valued function.`)
        return new BoundReturn(this.source, value)
    }
}

export class SyntaxNative implements SyntaxStatement, IDeclares {
    constructor(
        public name: string,
        public args: ImmutableVariable[],
        public returnType: HexType,
        public body: Pattern[],
        public source: CodeRefrence
    ) {}
    bind(binder: Binder): BoundNative {
        if (binder.varExists(this.name)) {
            throw this.source.Error(`Cant redefine native ${this.name}`)
        }
        binder.define(this.name, new NativeFunction(this.args.map(x=>x.type), this.returnType), false, false)
        return new BoundNative(
            this.name,
            this.args,
            this.body,
            this.returnType,
            this.source
        )
    }
}

export class SyntaxClass implements SyntaxStatement, IDeclares {
    constructor(
        public name: string,
        public entries: Map<string, ClassEntry>,
        public source: CodeRefrence
    ) {}
    bind(binder: Binder): BoundClass {
        if (binder.varExists(this.name)) {
            throw this.source.Error(`Cant redefine class ${this.name}`)
        }
        let symbols = new Map<string, BoundExpression>()
        let fields = new Map<string, BoundExpression>()
        let properties = new Map<string, HexType>()
        for (let name of this.entries.keys()) {
            let entry = this.entries.get(name)!
            if (entry instanceof SyntaxDeclaration) {
                if (entry.explicitType && entry.value instanceof SyntaxUndefined) {
                    properties.set(entry.name, entry.explicitType)
                } else {
                    symbols.set(entry.name, entry.value.bind(binder))
                }
            } else if (entry instanceof SyntaxFunction) {
                let func = entry.bind(binder)
                if (func instanceof BoundStaticFunction) {
                    symbols.set(entry.name, new BoundStaticFunctionValue(func.args, new StaticFunction(func.args.map(x=>x.type), func.returnType), func.body, func.source))
                } else throw func.source.Error(`Cant use captured values inside class method`)
            } else if (entry instanceof SyntaxNative) {
                let native = entry.bind(binder)
                symbols.set(entry.name, new BoundNativeValue(native.args, new NativeFunction(native.args.map(x=>x.type), native.returnType), native.body, native.source))
            } else if (entry instanceof SyntaxClass) {
                let cls = entry.bind(binder)
                symbols.set(entry.name, new HardcodedExpr(cls.type, []))
            }
        }
        
        let type = new Class(this.name, symbols, fields, properties)
        binder.define(this.name, type, false, false)
        return new BoundClass(this.name, type, this.source)
    }
}

export class SyntaxImport implements SyntaxStatement {
    constructor(
        public variables: string[],
        public file: string,
        public source: CodeRefrence
    ) {}
    bind(binder: Binder): BoundStatement {
        if (!this.source.file) throw this.source.Error(`Cant import a file when the current file is unknown`)
        this.file = path.resolve(path.dirname(this.source.file), this.file)
        let text = readFileSync(this.file, "utf8")
        let tokens = Lexer.tokenise(text, this.file)
        let syntaxTree = Parser.parse(tokens)
        let [boundTree, subbinder] = Binder.bind(syntaxTree)

        // subbinder.exports.forEach(x => binder.define(x.name, x.type, x.mutable, x.onStack))
        let typedimports = [] as BinderVariable[]
        for (let variable of this.variables) {
            let other = subbinder.exports.find(x => x.name == variable)
            if (!other) throw this.source.Error(`Imported variable ${variable} is not exported/does not exist in file ${this.file}`)
            binder.define(variable, other.type, other.mutable, other.onStack)
            typedimports.push(other)
        }
        return new BoundImport(typedimports, boundTree, this.source)
    }
}


export class SyntaxExport implements SyntaxStatement {
    constructor(
        public declaration: SyntaxStatement & IDeclares,
        public source: CodeRefrence
    ) {
        this.source = this.source.until(declaration.source)
    }
    bind(binder: Binder): BoundStatement {
        let bound = new BoundExport(this.declaration.bind(binder) as BoundStatement & IDeclares, this.source)
        binder.variables.find(x => x.name == this.declaration.name)!.lastUse = new DontDelete()
        binder.export(this.declaration.name)
        return bound
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
    return new SyntaxExpressionStmt(expr, expr.source)
}

function parseBlockStmt(parser: Parser) {
    let ob = parser.expect(TokenKind.OPENCURLY)
    let stmts = [] as SyntaxStatement[]
    while (parser.hasTokens && parser.current.kind != TokenKind.CLOSECURLY) {
        stmts.push(parseStmt(parser))
    }
    let cb = parser.expect(TokenKind.CLOSECURLY)
    return new SyntaxBlock(stmts, ob.source.until(cb.source))
}

export function parseDeclStmt(parser: Parser) {
    let mutability = parser.current.kind == TokenKind.LET
    let kw = parser.advance()
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
        throw parser.current.source.Error("Tried to define a variable without a type nor value!")
    }
    if (value == undefined && type != undefined) {
        value = new SyntaxUndefined(parser.current.source)
        type = new OptionsType(type, HexUndefined)
    }
    let sc = parser.expect(TokenKind.SEMICOLON)
    return new SyntaxDeclaration(name, mutability, value as SyntaxExpression, kw.source.until(sc.source), type)
}

export function parseIfStmt(parser: Parser) {
    let kw = parser.expect(TokenKind.IF)
    parser.expect(TokenKind.OPENBRACKET)
    let condition = parseExpr(parser, BindingPower.DEFAULT)
    parser.expect(TokenKind.CLOSEBRACKET)
    let ifblock = parseBlockStmt(parser)
    if (parser.current.kind != TokenKind.ELIF && parser.current.kind != TokenKind.ELSE) {
        return new SyntaxIf(condition, ifblock, [], kw.source.until(ifblock.source))
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
        return new SyntaxIf(condition, ifblock, elifs, kw.source.until(elseblock.source), elseblock)
    }
    return new SyntaxIf(condition, ifblock, elifs, kw.source.until(elifs[elifs.length-1].block.source))
}

export function parseForStmt(parser: Parser) {
    let kw = parser.expect(TokenKind.FOR)
    parser.expect(TokenKind.OPENBRACKET)
    let name = parser.expect(TokenKind.SYMBOL).data
    parser.expect(TokenKind.IN)
    let range = parseExpr(parser, BindingPower.DEFAULT)
    parser.expect(TokenKind.CLOSEBRACKET)
    let block = parseBlockStmt(parser)
    return new SyntaxFor(name, range, block, kw.source.until(block.source))
}

export function parseWhileStmt(parser: Parser) {
    let kw = parser.expect(TokenKind.WHILE)
    parser.expect(TokenKind.OPENBRACKET)
    let cond = parseExpr(parser, BindingPower.DEFAULT)
    parser.expect(TokenKind.CLOSEBRACKET)
    let block = parseBlockStmt(parser)
    return new SyntaxWhile(cond, block, kw.source.until(block.source))
}

export function parseFunctionStmt(parser: Parser) {
    let kw = parser.expect(TokenKind.FUNCTION)
    let name = parser.expect(TokenKind.SYMBOL).data
    parser.expect(TokenKind.OPENBRACKET)
    let args = [] as ImmutableVariable[]
    while (parser.hasTokens && parser.current.kind != TokenKind.CLOSEBRACKET) {
        let name = parser.expect(TokenKind.SYMBOL).data
        parser.expect(TokenKind.COLON)
        let type = parseType(parser)
        args.push(new ImmutableVariable(name, type))
        if (parser.current.kind != TokenKind.EOF && (parser.current.kind as TokenKind) != TokenKind.CLOSEBRACKET) {
            parser.expect(TokenKind.COMMA)
        }
    }
    parser.expect(TokenKind.CLOSEBRACKET)
    parser.expect(TokenKind.COLON)
    let returntype = parseType(parser)
    let body = parseBlockStmt(parser)
    return new SyntaxFunction(name, args, returntype, body, kw.source.until(body.source))
}

export function parseReturnStmt(parser: Parser) {
    let kw = parser.expect(TokenKind.RETURN)
    if (parser.current.kind == TokenKind.SEMICOLON) {
        let sc = parser.advance()
        return new SyntaxReturn(kw.source.until(sc.source))
    } else {
        let value = parseExpr(parser, BindingPower.DEFAULT)
        let sc = parser.expect(TokenKind.SEMICOLON)
        return new SyntaxReturn(kw.source.until(sc.source), value)
    }
}

export function parseNativeStmt(parser: Parser) {
    let kw = parser.expect(TokenKind.NATIVE)
    let name = parser.expect(TokenKind.SYMBOL).data
    
    parser.expect(TokenKind.OPENBRACKET)
    let args = [] as ImmutableVariable[]
    while (parser.hasTokens && parser.current.kind != TokenKind.CLOSEBRACKET) {
        let name = parser.expect(TokenKind.SYMBOL).data
        parser.expect(TokenKind.COLON)
        let type = parseType(parser)
        args.push(new ImmutableVariable(name, type))
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
        while (parser.hasTokens && parser.current.kind != TokenKind.SEMICOLON && parser.current.kind != TokenKind.CLOSEBRACKET) {
            let spacer = parser.peek.kind == TokenKind.COLON ? "" : " "
            current += parser.advance().data + spacer
        }
        body = body.concat(parseName(current.trim()))
        parser.expect(TokenKind.SEMICOLON)
        if (parser.current.kind == TokenKind.CLOSECURLY) break loop
    }
    let cb = parser.expect(TokenKind.CLOSECURLY)
    return new SyntaxNative(name, args, returntype, body, kw.source.until(cb.source))
}

type ClassEntry = SyntaxDeclaration | SyntaxFunction | SyntaxNative | SyntaxClass

export function parseClassStmt(parser: Parser) {
    let kw = parser.expect(TokenKind.CLASS)
    let name = parser.expect(TokenKind.SYMBOL).data
    parser.expect(TokenKind.OPENCURLY)
    let properties = new Map<string, ClassEntry>()
    while (parser.hasTokens && parser.current.kind != TokenKind.CLOSECURLY) {
        switch (parser.current.kind) {
            case TokenKind.LET:
                let dec = parseDeclStmt(parser)
                properties.set(dec.name, dec)
                if (<TokenKind>parser.current.kind != TokenKind.EOF && (parser.current.kind as TokenKind) != TokenKind.CLOSECURLY) {
                    parser.expect(TokenKind.SEMICOLON)
                }
                continue
            case TokenKind.FUNCTION:
                let func = parseFunctionStmt(parser)
                properties.set(func.name, func)
                continue
            case TokenKind.NATIVE:
                let native = parseNativeStmt(parser)
                properties.set(native.name, native)
                continue
            case TokenKind.CLASS:
                let cls = parseClassStmt(parser)
                properties.set(cls.name, cls)
                continue
            default:
                throw parser.current.source.Error(`Tried to declare a class property of type ${parser.current.toString()}`)
        }
    }
    let cb = parser.expect(TokenKind.CLOSECURLY)
    return new SyntaxClass(name, properties, kw.source.until(cb.source))
}

export function parseImportStmt(parser: Parser) {
    let kw = parser.expect(TokenKind.IMPORT)
    let variables = [] as string[]
    while (parser.hasTokens && parser.current.kind != TokenKind.FROM) {
        variables.push(parser.expect(TokenKind.SYMBOL).data)
        if (parser.current.kind == TokenKind.COMMA) parser.expect(TokenKind.COMMA)
    }
    parser.expect(TokenKind.FROM)
    let file = parser.expect(TokenKind.STRINGLITERAL).data + ".hexlang"
    let sc = parser.expect(TokenKind.SEMICOLON)
    return new SyntaxImport(variables, file, kw.source.until(sc.source))
}

export function parseExportStatement(parser: Parser) {
    let kw = parser.expect(TokenKind.EXPORT)
    switch (parser.current.kind) {
        case TokenKind.LET:
        case TokenKind.CONST:
            return new SyntaxExport(parseDeclStmt(parser), kw.source)
        case TokenKind.FUNCTION:
            return new SyntaxExport(parseFunctionStmt(parser), kw.source)
        case TokenKind.NATIVE:
            return new SyntaxExport(parseNativeStmt(parser), kw.source)
        case TokenKind.CLASS:
            return new SyntaxExport(parseClassStmt(parser), kw.source)
        default: 
            throw kw.source.Error(`Cant export a ${TokenKind[parser.current.kind]}-statement`)
    }
}

export function findStmtSymbols(stmt: SyntaxStatement): string[] {
    if (stmt instanceof SyntaxBlock) return unique(stmt.statements.map(findStmtSymbols).flat())
    else if (stmt instanceof SyntaxExpressionStmt) return findExprSymbols(stmt.expr)
    else if (stmt instanceof SyntaxDeclaration) return unique([findExprSymbols(stmt.value)].flat())
    else if (stmt instanceof SyntaxIf) return unique([findExprSymbols(stmt.condition), findStmtSymbols(stmt.ifblock), stmt.elifs.map(x => [findExprSymbols(x.condition), findStmtSymbols(x.block)].flat()).flat(), stmt.elseblock ? findStmtSymbols(stmt.elseblock) : [] ].flat())
    else if (stmt instanceof SyntaxFor) return unique([findExprSymbols(stmt.range), findStmtSymbols(stmt.block)].flat())
    else if (stmt instanceof SyntaxWhile) return unique([findExprSymbols(stmt.condition), findStmtSymbols(stmt.block)].flat())
    else if (stmt instanceof SyntaxFunction) return findStmtSymbols(stmt.body)
    else if (stmt instanceof SyntaxReturn) return stmt.value ? findExprSymbols(stmt.value) : []
    else if (stmt instanceof SyntaxNative) return []
    else if (stmt instanceof SyntaxClass) return [] // do classes properly at somepoint lmao
    else throw new Error("what")
}

function unique<T>(list:T[]) {
    return list.filter((x,i,a) => a.findIndex(y => y==x) == i)
}