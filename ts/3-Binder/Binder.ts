import { SyntaxStatement } from "../2-Parser/SyntaxStatements";
import { Builtins } from "../types/Builtins";
import { HexType } from "../types/Types";
import { CodeRefrence } from "../Util";

class BinderFrame {
    constructor(
        public variables: {name: string, type: HexType, mutable: boolean}[] = [],
        public caller: {name: string, returnType: HexType|null}
    ) {}
}

export class Binder {
    frames: BinderFrame[]
    constructor() {
        this.frames = [new BinderFrame([], {name:"Global", returnType:null})]
    }
    static bind(syntaxTree: SyntaxStatement) {
        let binder = new Binder() 
        return syntaxTree.bind(binder)
    }

    get variables() {return this.frames.map(x => x.variables).flat()}
    get currentFrame() {return this.frames[this.frames.length-1]}
    pushFrame(name:string, returnType: HexType) {this.frames.push(new BinderFrame([], {name:name, returnType:returnType}))}
    popFrame() {return this.frames.pop()}
    getVarType(name: string) {
        let type: HexType | undefined
        if ((type = this.variables.find(x => x.name == name)?.type) != undefined) return type
        for (let [k, v] of Builtins) {
            if (name == k) return v.type
        }
        return undefined
    }
    varExists(name: string) { return this.getVarType(name) != undefined}
    define(name: string, type: HexType, mutable: boolean) {
        this.frames[this.frames.length-1].variables.push({name:name,type:type,mutable:mutable})
    }
}