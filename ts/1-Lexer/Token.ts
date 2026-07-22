import { CodeRefrence } from "../Util";

export enum TokenKind {
    LET,
    CONST,
    SYMBOL,
    NUMBERLITERAL,
    STRINGLITERAL,

    EQUALITY,
    INEQUALITY,
    LESSTHAN,
    GREATERTHAN,
    LESSOREQUAL,
    GREATEROREQUAL,
    BOOLAND,
    BOOLOR,
    BOOLNOT,

    PLUS,
    DASH,
    ASTERISK,
    DOUBLEASTERISK,
    SLASH,
    EQUALS,
    COLON,
    AND,
    OR,
    NOT,

    DOT,
    COMMA,

    OPENBRACKET,
    CLOSEBRACKET,
    OPENSQUARE,
    CLOSESQUARE,
    OPENCURLY,
    CLOSECURLY,

    TRUE,
    FALSE,

    IF,
    ELIF,
    ELSE,
    FOR,
    IN,
    WHILE,
    FUNCTION,
    CLASS,
    RETURN,
    NATIVE,
    IMPORT,
    FROM,
    EXPORT,

    SEMICOLON,
    EOF
}

export class Token {
    constructor(
        public kind: TokenKind,
        public source: CodeRefrence,
        public data: string
    ) {}

    toString() {
        return `${TokenKind[this.kind]}` + (this.data != "" ? `(${this.data})` : "")
    }
}