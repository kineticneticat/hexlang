import { Token, TokenKind } from "../1-Lexer/Token"
import { Parser } from "../2-Parser/Parser"
import { HexNumber, HexString, HexType, HexVoid, OptionsType, Primitive } from "./Types"

enum TypeBindingPowers {
    Default,
    OR
}

type TypeNUDHandler = (parser: Parser) => HexType
type TypeLEDHandler = (parser: Parser, left: HexType, bp: TypeBindingPowers) => HexType

let PrimaryTypes = new Map<string, Primitive>([
    ["number", HexNumber],
    ["string", HexString],
    ["void", HexVoid]
])

let TypeNUDHandlers = new Map<TokenKind, TypeNUDHandler>([
    [TokenKind.SYMBOL, parsePrimaryType]
])
function getNUD(token: Token) {
    if (TypeNUDHandlers.has(token.kind)) return TypeNUDHandlers.get(token.kind) as TypeNUDHandler
    else throw token.source.Error(`No type NUD found for ${TokenKind[token.kind]}`)
}
let TypeLEDHandler = new Map<TokenKind, TypeLEDHandler>([
    [TokenKind.OR, parseBinaryType]
])
function getLED(token: Token) {
    if (TypeLEDHandler.has(token.kind)) return TypeLEDHandler.get(token.kind) as TypeLEDHandler
    else throw token.source.Error(`No type LED found for ${TokenKind[token.kind]}`)
}
let TypeBPs = new Map<TokenKind, TypeBindingPowers>([
    [TokenKind.OR, TypeBindingPowers.OR],
])
function getBP(token: Token) {
    if (TypeBPs.has(token.kind)) return TypeBPs.get(token.kind) as TypeBindingPowers
    else return TypeBindingPowers.Default
}

export function parseType(parser: Parser, bp: TypeBindingPowers = TypeBindingPowers.Default): HexType {
    let nud = getNUD(parser.current)
    let left = nud(parser)
    while (getBP(parser.current) > bp) {
        let led = getLED(parser.current)
        left = led(parser, left, bp)
    }
    return left
}

function parsePrimaryType(parser: Parser): HexType {
    let type = parser.advance().data
    if (!PrimaryTypes.has(type)) throw Error(`No primitive of type ${type}`)
    return PrimaryTypes.get(type) as HexType
}

function parseBinaryType(parser: Parser, left: HexType, bp: TypeBindingPowers) {
    let op = parser.advance()
    switch (op.kind) {
        case TokenKind.OR:
            return new OptionsType(left, parseType(parser, getBP(op)))
        default: throw new Error(`No type operator of kind ${TokenKind[op.kind]}`)
    }
}