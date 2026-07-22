import { Compiler } from "../4-Compiler/Compiler"
import { Pattern } from "../Hex/Hex"
import { Patterns } from "../Hex/Patterns"
import { CodeError, CodeRefrence } from "../Util"
import { BindingPower, getBP, getLED, getNUD } from "./LUT"
import { Parser } from "./Parser"
import { BoundArray, BoundBinaryExpr, BoundBooleanLiteral, BoundCallClass, BoundCallClosure, BoundCallNative, BoundCallStatic, BoundExpression, BoundMember, BoundMemberAssignment, BoundNumberLiteral, BoundStringLiteral, BoundSymbol, BoundUndefined, BoundVariableAssignment } from "../3-Binder/BoundExpressions"
import { Binder } from "../3-Binder/Binder"
import { Class, ClosureFunction, HexType, HexUndefined, List, NativeFunction, OptionsType, StaticFunction } from "../types/Types"
import { TokenKind } from "../1-Lexer/Token"
import { SyntaxExpressionStmt } from "./SyntaxStatements"

function blank( func: () => void) {
    func()
    return []
}

export interface SyntaxExpression {
    source: CodeRefrence
    bind(binder: Binder): BoundExpression
}

export class SyntaxNumberLiteral implements SyntaxExpression {
    value: number
    constructor(value: string, public source: CodeRefrence) {
        this.value = parseFloat(value)
    }
    bind(binder: Binder): BoundExpression {
        return new BoundNumberLiteral(this.value, this.source)
    }
}
export class SyntaxStringLiteral implements SyntaxExpression {
    constructor(
        public value: string,
        public source: CodeRefrence
    ) {}
    bind(binder: Binder): BoundExpression {
        return new BoundStringLiteral(this.value, this.source)
    }
}
export class SyntaxBooleanLiteral implements SyntaxExpression {
    constructor(
        public value: boolean,
        public source: CodeRefrence
    ) {}
    bind(binder: Binder): BoundExpression {
        return new BoundBooleanLiteral(this.value, this.source)
    }
}
export class SyntaxSymbol implements SyntaxExpression {
    constructor(
        public name: string,
        public source: CodeRefrence
    ) {}
    bind(binder: Binder): BoundExpression {
        if (!binder.varExists(this.name)) throw this.source.Error(`Variable ${this.name} is not defined`)
        let type = binder.getVarType(this.name) as HexType
        let bound = new BoundSymbol(this.name, type, this.source)
        binder.noteUse(this.name, bound)
        return bound
    }
}
export class SyntaxUndefined implements SyntaxExpression {
    constructor(public source: CodeRefrence) {}
    bind(binder: Binder): BoundExpression {
        return new BoundUndefined(this.source)
    }
}

export class SyntaxBinaryExpr implements SyntaxExpression {
    constructor(
        public left: SyntaxExpression,
        public operation: TokenKind,
        public right: SyntaxExpression,
        public source: CodeRefrence
    ) {}
    bind(binder: Binder): BoundExpression {
        let left = this.left.bind(binder)
        let right = this.right.bind(binder)
        return new BoundBinaryExpr(
            left.type.getOperator(this.operation, right.type, this.source),
            left,
            right,
            this.source
        )
    }
}

export class SyntaxAssignment implements SyntaxExpression {
    constructor(
        public assignee: SyntaxExpression,
        public value: SyntaxExpression,
        public source: CodeRefrence
    ) {}
    bind(binder: Binder): BoundExpression {
        let assignee = this.assignee.bind(binder)
        let value = this.value.bind(binder)
        if (!assignee.type.canCastFrom(value.type)) {
            throw this.source.Error(`Cast assign value of type ${value.type.name} to ${assignee.type.name}`)
        }
        if (assignee instanceof BoundSymbol) {
            binder.noteUse(assignee.name, assignee)
            return new BoundVariableAssignment(
                assignee,
                value,
                this.source
            )
        } else if(assignee instanceof BoundMember) {
            let root = assignee.parent as BoundMember | BoundSymbol
            while (root instanceof BoundMember) {
                if(!(root.parent instanceof BoundMember) || !(root.parent instanceof BoundSymbol)) throw assignee.source.Error(`Can only assign to members derived from a symbol.`)
                root = root.parent
            }
            binder.noteUse(root.name, root)
            return new BoundMemberAssignment(
                assignee,
                value,
                this.source
            )
        } else throw this.source.Error(`Cant assign to non symbol or member`)
    }
}

export class SyntaxMember implements SyntaxExpression {
    constructor(
        public parent: SyntaxExpression,
        public prop: string,
        public source: CodeRefrence
    ) {}
    bind(binder: Binder): BoundExpression {
        return new BoundMember(
            this.parent.bind(binder),
            this.prop,
            this.source
        )
    }
}

export class SyntaxCall implements SyntaxExpression {
    constructor(
        public method: SyntaxExpression,
        public args: SyntaxExpression[],
        public source: CodeRefrence
    ) {}
    bind(binder: Binder): BoundExpression {
        let method = this.method.bind(binder)
        if (method.type instanceof ClosureFunction) {
            return new BoundCallClosure(
                method,
                this.args.map(x => x.bind(binder)),
                method.type,
                this.source
            )
        } else if (method.type instanceof StaticFunction) {
            return new BoundCallStatic(
                method, this.args.map(x => x.bind(binder)),
                method.type.returnType,
                this.source
            )
        } else if (method.type instanceof NativeFunction) {
            return new BoundCallNative(
                method,
                this.args.map(x => x.bind(binder)),
                method.type.returnType,
                this.source
            )
        } else if (method.type instanceof Class) {
            return new BoundCallClass(
                method, this.args.map(x => x.bind(binder)),
                method.type.returnType,
                this.source
            )
        } else {
            throw this.source.Error("Tried to call an uncallable value")
        }
    }
}

export class SyntaxArray implements SyntaxExpression {
    constructor(
        public contents: SyntaxExpression[],
        public source: CodeRefrence
    ) {}
    bind(binder: Binder): BoundExpression {
        let contents = this.contents.map(x=>x.bind(binder))
        return new BoundArray(
            contents,
            new List(new OptionsType(...contents.map(x=>x.type))),
            this.source
        )
    }
}

export function parseExpr(parser: Parser, bindingPower: BindingPower=BindingPower.DEFAULT): SyntaxExpression {
    let nud = getNUD(parser.current)
    let left = nud(parser)
    while (getBP(parser.current) > bindingPower) {
        let led = getLED(parser.current)
        left = led(parser, left, bindingPower)
    }
    return left
}

export function parsePrimaryExpr(parser: Parser) {
    switch (parser.current.kind) {
        case TokenKind.NUMBERLITERAL:
            return new SyntaxNumberLiteral(parser.current.data, parser.advance().source)
        case TokenKind.STRINGLITERAL:
            return new SyntaxStringLiteral(parser.current.data, parser.advance().source)
        case TokenKind.SYMBOL:
            let name = parser.current.data
            return new SyntaxSymbol(name, parser.advance().source)
        case TokenKind.TRUE:
            return new SyntaxBooleanLiteral(true, parser.advance().source)
        case TokenKind.FALSE:
            return new SyntaxBooleanLiteral(false, parser.advance().source)
        default:
            throw parser.current.source.Error(`Tried to parse ${TokenKind[parser.current.kind]} as a primary.`)
    }
}

export function parseBinaryExpr(parser: Parser, left: SyntaxExpression, bp: BindingPower) {
    let op = parser.advance()
    let right = parseExpr(parser, getBP(op))
    return new SyntaxBinaryExpr(left, op.kind, right, 
        left.source.until(right.source)
    )
}

export function parseGroupingExpr(parser: Parser) {
    parser.expect(TokenKind.OPENBRACKET)
    let expr = parseExpr(parser, BindingPower.DEFAULT)
    parser.expect(TokenKind.CLOSEBRACKET)
    return expr
}

export function parseAssignmentExpr(parser: Parser, left: SyntaxExpression, bp: BindingPower) {
    parser.expect(TokenKind.EQUALS)
    let right = parseExpr(parser, bp)
    return new SyntaxAssignment(
        left,
        right,
        left.source.until(right.source)
    )
}

export function parseMemberExpr(parser: Parser, left: SyntaxExpression, bp: BindingPower) {
    parser.expect(TokenKind.DOT)
    let right = parser.expect(TokenKind.SYMBOL)
    return new SyntaxMember(
        left,
        right.data,
        left.source.until(right.source)
    )
}

export function parseCallExpr(parser: Parser, left: SyntaxExpression, bp: BindingPower) {
    parser.expect(TokenKind.OPENBRACKET)
    let args = [] as SyntaxExpression[]
    while (parser.hasTokens && parser.current.kind != TokenKind.CLOSEBRACKET) {
        args.push(parseExpr(parser, BindingPower.ASSIGNMENT))
        if (parser.current.kind != TokenKind.EOF && (parser.current.kind as TokenKind) != TokenKind.CLOSEBRACKET) {
            parser.expect(TokenKind.COMMA)
        }
    }
    let cb = parser.expect(TokenKind.CLOSEBRACKET)
    return new SyntaxCall(
        left,
        args,
        left.source.until(cb.source)
    )
}

export function parseArrayExpr(parser: Parser) {
    let ob = parser.expect(TokenKind.OPENSQUARE)
    let contents = [] as SyntaxExpression[]
    while (parser.hasTokens && parser.current.kind != TokenKind.CLOSESQUARE) {
        contents.push(parseExpr(parser, BindingPower.LOGICAL))
        if (parser.current.kind != TokenKind.EOF && (parser.current.kind as TokenKind) != TokenKind.CLOSESQUARE) {
            parser.expect(TokenKind.COMMA)
        }
    }
    let cb = parser.expect(TokenKind.CLOSESQUARE)
    return new SyntaxArray(contents,
        ob.source.until(cb.source)
    )
}
export function findExprSymbols(expr: SyntaxExpression): string[] {
    if (expr instanceof SyntaxNumberLiteral) return []
    else if (expr instanceof SyntaxStringLiteral) return []
    else if (expr instanceof SyntaxBooleanLiteral) return []
    else if (expr instanceof SyntaxUndefined) return []
    else if (expr instanceof SyntaxSymbol) return [expr.name]
    else if (expr instanceof SyntaxBinaryExpr) return unique([findExprSymbols(expr.left), findExprSymbols(expr.right)].flat())
    else if (expr instanceof SyntaxAssignment) return unique([findExprSymbols(expr.assignee), findExprSymbols(expr.value)].flat())
    else if (expr instanceof SyntaxMember) return findExprSymbols(expr.parent)
    else if (expr instanceof SyntaxCall) return unique([findExprSymbols(expr.method), expr.args.map(findExprSymbols).flat()].flat())
    else if (expr instanceof SyntaxArray) return unique(expr.contents.map(findExprSymbols).flat())
    else throw new Error("what")
}

function unique<T>(list:T[]) {
    return list.filter((x,i,a) => a.findIndex(y => y==x) == i)
}