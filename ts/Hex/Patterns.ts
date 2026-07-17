import { CodeError } from "../Util";
import { AngleSig, Pattern, StartDir } from "./Hex";

export const Patterns = {
    NYI: (name: string) => Pattern.fromString("<se,sss>", `NYI: ${name}`),
    Number: numberpatterns,
    DeleteNIotasUnder: deleteNIotasUnder,
    Bookkeepers: literalBookkeepers,
    Null: Pattern.fromString("<e,d>", "Nullary Reflection"),
    Add: Pattern.fromString("<ne,waaw>", "Additive Distillation"),
    Subtract: Pattern.fromString("<nw,wddw>", "Subtractive Distillation"),
    Multipy: Pattern.fromString("<se,waqaw>", "Multipicative Distillation"),
    Divide: Pattern.fromString("<ne,wdedw>", "Division Distillation"),
    Execute: Pattern.fromString("<se,deaqq>", "Hermes' Gambit"),
    ExecuteCont: Pattern.fromString("<nw,qwaqde>", "Iris' Gambit"),
    MakeList: Pattern.fromString("<sw,ewdqdwe>", "Flock's Gambit"),
    Splat: Pattern.fromString("<nw,qwaeawq>", "Flock's Disintegration"),
    StackSize: Pattern.fromString("<nw,qwaeawqaeaqa>", "Flock's Reflection"),
    PushFromStack: Pattern.fromString("<w,ddad>", "Fisherman's Gambit"),
    CopyFromStack: Pattern.fromString("<e,aada>", "Fisherman's Gambit II"),
    Open: Pattern.fromString("<w,qqq>", "{"),
    Close: Pattern.fromString("<e,eee>", "}"),
    EmptyList: Pattern.fromString("<ne,qqaeaae>", "Vacant Reflection"),
    Switch: Pattern.fromString("<se,awdd>", "Augur's Exaltation"),
    Equality: Pattern.fromString("<e,ad>", "Equality Distillation"),
    Inequality: Pattern.fromString("<e,ad>", "Equality Distillation"),
    GreaterThan: Pattern.fromString("<e,ad>", "Equality Distillation"),
    GreaterOrEqual: Pattern.fromString("<e,ad>", "Equality Distillation"),
    LessThan: Pattern.fromString("<e,ad>", "Equality Distillation"),
    LessOrEqual: Pattern.fromString("<e,ad>", "Equality Distillation"),
    Reveal: Pattern.fromString("<ne,de>", "Reveal"),
    Duplicate: Pattern.fromString("<e,aadaa>", "Gemini Decomposition"),
    Swap: Pattern.fromString("<e,aawdd>", "Jester's Gambit"),
    CopyUnder: Pattern.fromString("<e,aaedd>", "Prospector's Gambit"),
    BlockRaycast: Pattern.fromString("<e,wqaawdd>", "Archer's Distillation"),
    FaceRaycast: Pattern.fromString("<e,weddwaa>", "Architect's Distillation"),
    EntityRaycast: Pattern.fromString("<e,weaqa>", "Scout's Distillation"),
    ReadFromHand: Pattern.fromString("<e,aqqqqq>", "Scribe's Reflection"),
    WriteToHand: Pattern.fromString("<e,deeeee>", "Scribe's Gambit"),
    Caster: Pattern.fromString("<ne,qaq>", "Mind's Reflection"),
    LookDir: Pattern.fromString("<e,wa>", "Alidade's Purification"),
    EyePos: Pattern.fromString("<e,aa>", "Compass' Purification"),
    SplitVector: Pattern.fromString("<e,qeeeee>", "Vector Disintegration"),
    GameTime: Pattern.fromString("<nw,ddwaa>", "Timekeeper's Reflection"),
    True: Pattern.fromString("<se,aqae>", "True Reflection"),
    False: Pattern.fromString("<ne,dedq>", "False Reflection"),
}
const PatternNames = new Map(Object.values(Patterns).filter(x => x instanceof Pattern).map(x => [x.name, x]))

export function parseName(name: string) {
    if (PatternNames.has(name)) {
        return PatternNames.get(name) as Pattern
    } else if (name.startsWith("Bookkeeper's Gambit: ")) {
        return Patterns.Bookkeepers(name.slice(21))
    } else if (name.startsWith("Numerical Reflection: ")) {
        return Patterns.Number(parseFloat(name.slice(22)))
    } else throw new CodeError(`Cant parse pattern ${name}`)
}

function numberpatterns(n: number) {
    if (n % 1 != 0) throw new Error(`non-integers NYI: ${n}`)
    let name = `Numerical Reflection: ${n}`
    let pattern = n < 0 ? "dded,en<" : "aaqa,es<"
    while (n > 0) {
        if (n % 2 == 0) {
            pattern = "a" + pattern
            n /= 2
        } else {
            pattern = "w" + pattern
            n -= 1
        }
    }
    pattern = pattern.split("").reverse().join("") + ">"
    return Pattern.fromString(pattern, name)
}

function deleteNIotasUnder(n: number): Pattern {
    if (n==0) {
        return Pattern.fromString("<se,a>", `Bookkeeper's Gambit: v`)
    }
    return Pattern.fromString("<se,ae" + "w".repeat(n-1) + ">", `Bookkeeper's Gambit: v${"-".repeat(n-1)}`)
}

function literalBookkeepers(str: string) {
    let mask = str.split("")
    if (!mask.every(x => x == "-" || x == "v")) throw new Error(`Cant parse bookkeepers mask ${str}`)
    let startDir = mask[0] == "-" ? StartDir.EAST : StartDir.SOUTHEAST
    let anglesigs = mask[0] == "-" ? [] : [AngleSig.SHARPLEFT]

    for (let i=1; i<mask.length;i++) {
        if (mask[i] == "-") {
            if (mask[i-1] == "-") {
                anglesigs.push(AngleSig.FORWARDS)
            } else {
                anglesigs.push(AngleSig.SLIGHTRIGHT)
            }
        } else {
            if (mask[i-1] == "-") {
                anglesigs.push(AngleSig.SLIGHTRIGHT, AngleSig.SHARPLEFT)
            } else {
                anglesigs.push(AngleSig.SHARPRIGHT, AngleSig.SHARPLEFT)
            }
        }
    }
    return new Pattern(startDir, anglesigs, `Bookkeeper's Gambit: ${str}`)
}