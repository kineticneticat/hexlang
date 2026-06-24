export class CodeError extends Error {

}

export class CodeRefrence {
    constructor(
        public source: string,
        public start: number,
        public length: number
    ) {}
    Error(message: string) {
        // console.log(`[${this.start}:${this.length}] ${this.source}`)
        return new CodeError(`[${this.start}:${this.length}] ${this.source}\n` + message)
    }
}
