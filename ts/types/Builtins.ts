// import { Class, ClassInstance, Native, HardcodedExpr, HexAny, HexEntity, HexNumber, HexType, HexVector, HexVoid } from "./Types";
// import { Compiler } from "../Compiler";
// import { CodeError } from "../../Util";
// import { Pattern } from "../Hex/Hex";
// import { SyntaxExpression } from "../../parser/SyntaxExpressions";
// import { Patterns } from "../Hex/Patterns";



// export class Builtin extends HexType {
    
//     constructor(
//         public name: string,
//         public symbols: Map<string, Expression>,
//         public fields: Map<string, Expression>
//     ) { super()}
//     canCastFrom(type: HexType): boolean {
//         if (!(type instanceof Builtin)) return false
//         return this.name == type.name
//     }
//     getAccessHex(compiler: Compiler, name: string): Pattern[] {
//         let builtin = Builtins.get(name) as HardcodedExpr
//         // console.log(builtin)
//         return builtin.compile(compiler)
//     }
// }

// const IBuiltin = (name: string, symbols: [string, Expression][], fields: [string, Expression][]) => new HardcodedExpr(new Builtin(name, new Map(symbols), new Map(fields)), [])

// export const Builtins = new Map<string, HardcodedExpr>([
//     ["world", IBuiltin("World", [
//         ["raycast", IBuiltin("Raycast", [], [
//             ["block", new HardcodedExpr(new Native([HexVector, HexVector], HexVector), [Patterns.BlockRaycast], -1)],
//             ["face", new HardcodedExpr(new Native([HexVector, HexVector], HexVector), [Patterns.FaceRaycast], -1)],
//             ["entity", new HardcodedExpr(new Native([HexVector, HexVector], HexEntity), [Patterns.EntityRaycast], -1)],
//         ])]
//     ], [
//         ["caster", new HardcodedExpr(HexEntity, [Patterns.Caster], 1)],
//         ["time", new HardcodedExpr(new Native([], HexNumber), [Patterns.GameTime], 1)],
//     ])],
//     ["io", IBuiltin("IO", [
//         ["print", new HardcodedExpr(new Native([HexAny], HexVoid), [Patterns.Reveal, Patterns.Bookkeepers("v")], -1)],
//     ], [])]
// ])