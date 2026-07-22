import { BoundExpression } from "../3-Binder/BoundExpressions"
import { HardcodedExpr } from "./Types"
import { Compiler } from "../4-Compiler/Compiler"
import { Pattern } from "../Hex/Hex"
import { Patterns } from "../Hex/Patterns"
import { HexType, NativeFunction, HexVector, HexEntity, HexNumber, HexAny, HexVoid } from "./Types"

export class Builtin extends HexType {
    
    constructor(
        public name: string,
        public symbols: Map<string, BoundExpression>,
        public fields: Map<string, BoundExpression>
    ) { super()}
    canCastFrom(type: HexType): boolean {
        if (!(type instanceof Builtin)) return false
        return this.name == type.name
    }
    getAccessHex(compiler: Compiler, name: string): Pattern[] {
        let builtin = Builtins.get(name) as HardcodedExpr
        // console.log(builtin)
        return builtin.compile(compiler)
    }
}

const IBuiltin = (name: string, symbols: [string, BoundExpression][], fields: [string, BoundExpression][]) => new HardcodedExpr(new Builtin(name, new Map(symbols), new Map(fields)), [])

export function getBuiltin(name: string) {
    for (let [k,v] of Builtins) {
        if (name == k) return v
    }
    return undefined
}

export const Builtins = new Map<string, HardcodedExpr>([
    ["world", IBuiltin("World", [
        ["raycast", IBuiltin("Raycast", [], [
            ["block", new HardcodedExpr(new NativeFunction([HexVector, HexVector], HexVector), [Patterns.BlockRaycast], -1)],
            ["face", new HardcodedExpr(new NativeFunction([HexVector, HexVector], HexVector), [Patterns.FaceRaycast], -1)],
            ["entity", new HardcodedExpr(new NativeFunction([HexVector, HexVector], HexEntity), [Patterns.EntityRaycast], -1)],
        ])]
    ], [
        ["caster", new HardcodedExpr(HexEntity, [Patterns.Caster], 1)],
        ["time", new HardcodedExpr(new NativeFunction([], HexNumber), [Patterns.GameTime], 1)],
    ])],
    ["io", IBuiltin("IO", [
        ["print", new HardcodedExpr(new NativeFunction([HexAny], HexAny), [Patterns.Reveal], 0)],
    ], [])]
])