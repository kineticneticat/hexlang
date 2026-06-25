import {readdirSync, readFileSync, writeFileSync} from "node:fs"
import { tokenise } from "./lexer/Lexer"
import { parse } from "./parser/Parser"
import { argv } from "node:process"
import { CodeError } from "./Util"

if (argv.length <= 2) throw Error("Missing input file argument!")

let file = argv[2]
let data = readFileSync(file, "utf8")
try {
    let tokens = tokenise(data)
    let ast = parse(tokens)
    console.dir(ast, {depth: 4})

    // console.dir(ast, {depth: 4})
    // let hex = Compiler.compile(ast)
    // console.log((ast.statements[1] as FunctionStatement))
    // let hextext = hex.hex.map(x=>x.name).join("\n")
    // console.dir(hextext, {depth: 4})
    // console.log(hextext)
    // writeFileSync("./out/" +basename(file, extname(file))+".hexpattern", hextext)
} catch (e) {
    if (!(e instanceof CodeError)) throw e
    console.log(e.message)
}
