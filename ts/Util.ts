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
}
