import { HexType } from "../compiler/types/Types";
import { Token, TokenKind } from "../lexer/Token";
import { BlockStmt, parseStmt, Statement } from "./Statements";

class ParserFrame {
    constructor(
        public variables: {name: string, type: HexType, mutablility: boolean}[] = []
    ) {}
}

export class Parser {
    frameStack: ParserFrame[]
    constructor (
        public tokens: Token[],
        public pos: number = 0
    ) {
        this.frameStack = [new ParserFrame()]
    }
    get variables() { return this.frameStack.map(x => x.variables).flat()}
    pushFrame() {this.frameStack.push(new ParserFrame())}
    popFrame() {this.frameStack.pop()}
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
    checkRedef(name: string, perp: Token) {
        if (this.variables.find(x => x.name == name) != undefined) throw perp.source.Error(`Cannot redefine variable ${name}`)
    }
}

export function parse(tokens: Token[]) {
    let parser = new Parser(tokens)
    let stmts = [] as Statement[]
    while (parser.hasTokens) {
        stmts.push(parseStmt(parser))
    }
    return new BlockStmt(stmts)
}