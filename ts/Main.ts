import {readdirSync, readFileSync, writeFileSync} from "node:fs"
import { Lexer } from "./1-Lexer/Lexer"
import { Parser } from "./2-Parser/Parser"
import { argv } from "node:process"
import { CodeError } from "./Util"
import { Binder } from "./3-Binder/Binder"
import { Compiler } from "./4-Compiler/Compiler"
import { basename, extname } from "node:path"

if (argv.length <= 2) throw Error("Missing input file argument!")

let file = argv[2]
let data = readFileSync(file, "utf8")
try {
    let tokens = Lexer.tokenise(data, file)
    let syntaxTree = Parser.parse(tokens)
    // console.dir(syntaxTree, {depth: 4})
    let [boundTree, binder] = Binder.bind(syntaxTree)
    let [hex, compiler] = Compiler.compile(boundTree)
    let hextext = hex.map(x=>x.name).join("\n")
    // console.dir(hextext, {depth: 4})
    console.log(hextext)
    writeFileSync("./out/" +basename(file, extname(file))+".hexpattern", hextext)
} catch (e) {
    if (!(e instanceof CodeError)) throw e
    console.log(e.message)
}
