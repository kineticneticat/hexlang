import { CodeRefrence } from "../Util";
import { Token, TokenKind } from "./Token";

export class Lexer {
    static tokenise(text: string, file?: string) {
        let tokens: Token[] = []
        let lexer = new Lexer(text, 0, file)
        while (lexer.remaining.length > 0) {
            let block = lexer.remaining
            let matched = false
            handle: for (let handler of handlers) {
                let match = block.match(handler.matcher)
                if (match == null) continue handle
                if (match.index != 0) continue handle
                let token = handler.handler(
                    match[0],
                    new CodeRefrence(lexer.pos, match[0].length, lexer.file)
                )
                if (token != null) tokens.push(token)
                lexer.pos += match[0].length
                matched = true
                break handle
            }
            if (!matched) {
                throw new Error(`Uknown token at pos ${lexer.pos}: ${lexer.text.slice(lexer.pos, lexer.pos+20)}`)
            }
        }
        tokens.push(new Token(TokenKind.EOF, new CodeRefrence(text.length, 0), ""))
        return tokens
    }
    constructor (
        public text: string,
        public pos: number = 0,
        public file?: string
    ) {}
    hasRemaining() {return this.pos < this.text.length}
    get remaining() { return this.text.slice(this.pos)}
}


type TokenHandler = {matcher: RegExp|string, handler: (section: string, source: CodeRefrence) => (Token|null)}

function basicHandler(matcher: string|RegExp, kind: TokenKind) {
    return {
        matcher: matcher,
        handler: (str: string, source: CodeRefrence) => new Token(kind, source, str)
    }
}
function nullHandler(matcher: string|RegExp) {
    return {
        matcher: matcher,
        handler: (_: string, source: CodeRefrence) => null
    }
}

const handlers: TokenHandler[] = [
    nullHandler(/\s+/),
    {
        matcher: /[+-]?(?:\d+\.\d+|\d+|\.\d+)/,
        handler: (section, source) => new Token(TokenKind.NUMBERLITERAL, source, section)
    },
    {
        matcher: /"[\w\W]*?"/,
        handler: (section, source) => new Token(TokenKind.STRINGLITERAL, source, section.slice(1, -1))
    },
    basicHandler("let", TokenKind.LET),
    basicHandler("const", TokenKind.CONST),
    basicHandler("if", TokenKind.IF),
    basicHandler("elif", TokenKind.ELIF),
    basicHandler("else", TokenKind.ELSE),
    basicHandler("for", TokenKind.FOR),
    basicHandler("in", TokenKind.IN),
    basicHandler("while", TokenKind.WHILE),
    basicHandler("function", TokenKind.FUNCTION),
    basicHandler("return", TokenKind.RETURN),
    basicHandler("class", TokenKind.CLASS),
    basicHandler("native", TokenKind.NATIVE),
    basicHandler("import", TokenKind.IMPORT),
    basicHandler("from", TokenKind.FROM),
    basicHandler("export", TokenKind.EXPORT),
    basicHandler("true", TokenKind.TRUE),
    basicHandler("false", TokenKind.FALSE),
    {
        matcher: /[a-zA-Z_][0-9a-zA-Z_/']*/,
        handler: (section, source) => new Token(TokenKind.SYMBOL, source, section)
    },
    basicHandler("==", TokenKind.EQUALITY),
    basicHandler("!=", TokenKind.INEQUALITY),
    basicHandler("<=", TokenKind.LESSOREQUAL),
    basicHandler(">=", TokenKind.GREATEROREQUAL),
    basicHandler("<", TokenKind.LESSTHAN),
    basicHandler(">", TokenKind.GREATERTHAN),
    basicHandler("&&", TokenKind.BOOLAND),
    basicHandler("\\|\\|", TokenKind.BOOLOR),
    basicHandler("!", TokenKind.BOOLNOT),
    basicHandler("\\+", TokenKind.PLUS),
    basicHandler("-", TokenKind.DASH),
    basicHandler("\\*\\*", TokenKind.DOUBLEASTERISK),
    basicHandler("\\*", TokenKind.ASTERISK),
    basicHandler("/", TokenKind.SLASH),
    basicHandler("=", TokenKind.EQUALS),
    basicHandler(":", TokenKind.COLON),
    basicHandler("\\&", TokenKind.AND),
    basicHandler("\\|", TokenKind.OR),
    basicHandler("~", TokenKind.NOT),
    basicHandler("\\.", TokenKind.DOT),
    basicHandler("\\,", TokenKind.COMMA),
    basicHandler("\\(", TokenKind.OPENBRACKET),
    basicHandler("\\)", TokenKind.CLOSEBRACKET),
    basicHandler("\\[", TokenKind.OPENSQUARE),
    basicHandler("\\]", TokenKind.CLOSESQUARE),
    basicHandler("{", TokenKind.OPENCURLY),
    basicHandler("}", TokenKind.CLOSECURLY),
    basicHandler(";", TokenKind.SEMICOLON),
]

const keywords = [
    "let",
    "const",
    "if",
    "elif",
    "else",
    "for",
    "while"
]