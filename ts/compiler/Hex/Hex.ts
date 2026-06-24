export enum StartDir {
    EAST = "e",
    SOUTHEAST = "se",
    SOUTHWEST = "sw",
    WEST = "w",
    NORTHWEST = "nw",
    NORTHEAST = "ne"
}
export enum AngleSig {
    FORWARDS = "w",
    SLIGHTRIGHT = "e",
    SHARPRIGHT = "d",
    BACKWARDS = "s",
    SHARPLEFT = "a",
    SLIGHTLEFT = "q"
}


export class Pattern {
    static fromString(str: string, name: string) {
        let match = str.match(/<([ns]?[ew]),([qweasd]+)>/)
        if (match == null || match[0] != str) throw new Error(`String ${str} does not represent a pattern`)
        return new Pattern(match[1] as StartDir, match[2].split("") as AngleSig[], name)
    }
    constructor(
        public startDir: StartDir,
        public anglesigs: AngleSig[],
        public name: string
    ) {}
}