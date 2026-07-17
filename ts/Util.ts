import { readFileSync } from "node:fs"

export class CodeError extends Error {

}

export class CodeRefrence {
    constructor(
        public start: number,
        public length: number,
        public file?: string
    ) {}
    Error(message: string) {
        // console.log(`[${this.start}:${this.length}] ${this.source}`)
        return new CodeError(`[${this.start}:${this.length}] in ${this.file}\n` + message)
    }
    until(that: CodeRefrence) {
        return new CodeRefrence(this.start, (that.start + that.length)-this.start, this.file)
    }
    refrence() {
        if (!this.file) throw new Error ("Cant show a file refrence with no file!")
        return readFileSync(this.file, "utf-8").slice(this.start, this.start+this.length)
    }
}

export class BiMap<A,B,V> {
    map: Map<A, Map<B, V>>
    constructor(array?: [[A, B], V][]) {
        this.map = new Map()
        if (array) array.forEach(x => this.set(x[0][0], x[0][1], x[1]))
    }
    set(a: A, b:B, v:V) {
        let inner = this.map.get(a)
        if (!inner) {
            inner = new Map<B, V>()
        }
        inner.set(b, v)
        this.map.set(a, inner)
    }
    get(a: A, b: B) {
        return this.map.get(a)?.get(b)
    }
    has(a: A, b: B) {
        return this.map.get(a)?.has(b) ?? false
    }
}