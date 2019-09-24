import {readFile} from "fs-extra"
import {parseStringPromise} from "xml2js"

import {simplify} from "./simplify"
import {compile} from "./compile"

export const transform = async (input: string, output: string) => {
    const content = await readFile(input)
    const parsed = await parseStringPromise(content)
    const simplified = simplify(parsed)
    await compile(output)(simplified)
}

transform("./sandbox/otapi/schema.xsd", "./sandbox/otapi/types.ts")