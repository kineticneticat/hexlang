import { SyntaxStatement } from "../2-Parser/SyntaxStatements";

export class Binder {
    static bind(syntaxTree: SyntaxStatement) {
        let binder = new Binder()
        return syntaxTree.bind(binder)
    }
}