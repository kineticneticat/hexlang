import { Pattern } from "../compiler/Hex/Hex";
import { Patterns } from "../compiler/Hex/Patterns";
import { HexAny, HexNumber, HexType } from "../compiler/types/Types";
import { Token, TokenKind } from "../lexer/Token";
import { CodeError } from "../Util";
import { SyntaxExpression, parseBinaryExpr, parsePrimaryExpr, parseGroupingExpr, parseAssignmentExpr, parseMemberExpr, parseCallExpr, parseArrayExpr } from "./SyntaxExpressions";
import { Parser } from "./Parser";
import { parseClassStmt, parseDeclStmt, parseForStmt, parseFunctionStmt, parseIfStmt, parseNativeStmt, parseReturnStmt, parseWhileStmt, SyntaxStatement } from "./SyntaxStatements";

export enum BindingPower {
    DEFAULT,
    COMMA,
    ASSIGNMENT,
    LOGICAL,
    RELATIONAL,
    ADDITIVE,
    MULTIPLICATIVE,
    UNARY,
    CALL,
    MEMBER,
    PRIMARY
}

export type StatementHandler = (parser: Parser) => SyntaxStatement
export let StatementHandlers = new Map<TokenKind, StatementHandler>([
    [TokenKind.LET, parseDeclStmt],
    [TokenKind.CONST, parseDeclStmt],
    [TokenKind.IF, parseIfStmt],
    [TokenKind.WHILE, parseWhileStmt],
    [TokenKind.FOR, parseForStmt],
    [TokenKind.FUNCTION, parseFunctionStmt],
    [TokenKind.NATIVE, parseNativeStmt],
    [TokenKind.RETURN, parseReturnStmt],
    [TokenKind.CLASS, parseClassStmt]
])

let BindingPowers = new Map<TokenKind, BindingPower>([
    [TokenKind.NUMBERLITERAL, BindingPower.PRIMARY],
    [TokenKind.STRINGLITERAL, BindingPower.PRIMARY],
    [TokenKind.SYMBOL, BindingPower.PRIMARY],
    [TokenKind.PLUS, BindingPower.ADDITIVE],
    [TokenKind.DASH, BindingPower.ADDITIVE],
    [TokenKind.ASTERISK, BindingPower.MULTIPLICATIVE],
    [TokenKind.SLASH, BindingPower.MULTIPLICATIVE],
    [TokenKind.OPENBRACKET, BindingPower.CALL],
    [TokenKind.EQUALITY, BindingPower.RELATIONAL],
    [TokenKind.GREATERTHAN, BindingPower.RELATIONAL],
    [TokenKind.GREATEROREQUAL, BindingPower.RELATIONAL],
    [TokenKind.LESSTHAN, BindingPower.RELATIONAL],
    [TokenKind.LESSOREQUAL, BindingPower.RELATIONAL],
    [TokenKind.EQUALS, BindingPower.ASSIGNMENT],
    [TokenKind.DOT, BindingPower.MEMBER]
])
export function getBP(token: Token) {
    if (BindingPowers.has(token.kind)) return BindingPowers.get(token.kind) as BindingPower
    else return BindingPower.DEFAULT
}

type NUDHandler = (parser: Parser) => SyntaxExpression
let NUDHandlers = new Map<TokenKind, NUDHandler>([
    [TokenKind.NUMBERLITERAL, parsePrimaryExpr],
    [TokenKind.STRINGLITERAL, parsePrimaryExpr],
    [TokenKind.SYMBOL, parsePrimaryExpr],
    [TokenKind.TRUE, parsePrimaryExpr],
    [TokenKind.FALSE, parsePrimaryExpr],
    [TokenKind.OPENBRACKET, parseGroupingExpr],
    [TokenKind.OPENSQUARE, parseArrayExpr]
])
export function getNUD(token: Token) {
    if (NUDHandlers.has(token.kind)) return NUDHandlers.get(token.kind) as NUDHandler
    else throw token.source.Error(`No NUD handler found for ${TokenKind[token.kind]}`)
}

type LEDHandler = (parser: Parser, left: SyntaxExpression, bp: BindingPower) => SyntaxExpression
let LEDHandlers = new Map<TokenKind, LEDHandler>([
    [TokenKind.PLUS, parseBinaryExpr],
    [TokenKind.DASH, parseBinaryExpr],
    [TokenKind.ASTERISK, parseBinaryExpr],
    [TokenKind.SLASH, parseBinaryExpr],
    [TokenKind.EQUALITY, parseBinaryExpr],
    [TokenKind.GREATERTHAN, parseBinaryExpr],
    [TokenKind.GREATEROREQUAL, parseBinaryExpr],
    [TokenKind.LESSTHAN, parseBinaryExpr],
    [TokenKind.LESSOREQUAL, parseBinaryExpr],
    [TokenKind.EQUALS, parseAssignmentExpr],
    [TokenKind.DOT, parseMemberExpr],
    [TokenKind.OPENBRACKET, parseCallExpr]
])
export function getLED(token: Token) {
    if (LEDHandlers.has(token.kind)) return LEDHandlers.get(token.kind) as LEDHandler
    else throw token.source.Error(`No LED handler found for ${TokenKind[token.kind]}`)
}

type BinaryOpSignature = {left: HexType, right: HexType, result: HexType}
function same3(type: HexType): BinaryOpSignature {return {left: type, right: type, result: type}}
let BinaryOpSignatures = new Map<TokenKind, BinaryOpSignature[]>([
    [TokenKind.PLUS, [same3(HexNumber)]],
    [TokenKind.DASH, [same3(HexNumber)]],
    [TokenKind.ASTERISK, [same3(HexNumber)]],
    [TokenKind.SLASH, [same3(HexNumber)]],
    [TokenKind.EQUALITY, [same3(HexAny)]],
    [TokenKind.GREATERTHAN, [same3(HexNumber)]],
    [TokenKind.GREATEROREQUAL, [same3(HexNumber)]],
    [TokenKind.LESSTHAN, [same3(HexNumber)]],
    [TokenKind.LESSOREQUAL, [same3(HexNumber)]],
])
export function areBinOpArgsValid(left: HexType, right: HexType, op: TokenKind): HexType|null {
    if (!BinaryOpSignatures.has(op)) throw new Error(`No signatures for BinOp ${TokenKind[op]}`)
    let sigs = BinaryOpSignatures.get(op) as BinaryOpSignature[]
    for (let sig of sigs) {
        if (sig.left.canCastFrom(left) && sig.right.canCastFrom(right)) return sig.result
    }
    return null
}