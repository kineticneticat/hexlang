import { Token, TokenKind } from "../1-Lexer/Token"
import { SyntaxBlock, SyntaxStatement, parseStmt } from "./SyntaxStatements"


export class Parser {
    constructor (
        public tokens: Token[],
        public pos: number = 0
    ) {}
    get current() {
        return this.tokens[this.pos]
    }
    get prev() {
        return this.tokens[this.pos-1]
    }
    advance() {
        this.pos++
        return this.tokens[this.pos-1]
    }
    expect(kind: TokenKind) {
        if (this.current.kind != kind) throw this.current.source.Error(`Expected a ${TokenKind[kind]}, got ${TokenKind[this.current.kind]}`)
        return this.advance()
    }
    get hasTokens() {
        return this.pos < this.tokens.length && this.current.kind != TokenKind.EOF
    }
}

export function parse(tokens: Token[]) {
    let parser = new Parser(tokens)
    let stmts = [] as SyntaxStatement[]
    while (parser.hasTokens) {
        stmts.push(parseStmt(parser))
    }
    return new SyntaxBlock(stmts)
}